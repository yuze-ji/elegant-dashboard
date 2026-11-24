import { Notice } from "obsidian";
import { DashboardSettings, FocusTarget, focusTargetKey } from "./types";
import { addDays, startOfDay, toKey } from "./dates";
import { Strings } from "./i18n";
import { Ticker } from "./ticker";

export type FocusMode = "countdown" | "accumulate" | "pomodoro";
export type PomodoroPhase = "work" | "short" | "long";

/**
 * Owns the focus-timer state. Lives on the plugin (not the view) so the timer
 * keeps running when the dashboard tab is closed or re-rendered.
 */
export class FocusEngine {
  mode: FocusMode = "countdown";
  running = false;
  /** Target length of a countdown session, in seconds. */
  targetSeconds: number;
  /** Seconds left in countdown mode. */
  remaining: number;
  /** Seconds elapsed in accumulate mode. */
  elapsed = 0;
  /** Pomodoro: which phase is on the clock, and how many work rounds of the
   *  current cycle are done (0..rounds). Breaks never bank focus minutes. */
  phase: PomodoroPhase = "work";
  round = 0;
  /** Length of the current pomodoro phase, for the progress ring. */
  private phaseSeconds = 0;
  /** Seconds counted but not yet written to the focus log. */
  private unsaved = 0;
  /** Calendar day (YYYY-MM-DD) that `unsaved` should be banked under. */
  private unsavedDayKey: string = toKey(new Date());
  /** Minutes already banked during the current run, for the completion notice. */
  private sessionMinutes = 0;
  private ticker: Ticker | null = null;
  /**
   * Wall-clock time of the previous tick. Ticks are counted by elapsed real
   * time rather than "+1 second per tick" so a delayed or coalesced tick (the
   * Obsidian window regaining focus after being hidden) still banks the actual
   * time that passed instead of quietly losing it.
   */
  private lastTickMs: number | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private settings: DashboardSettings,
    private save: () => Promise<void>,
    private strings: () => Strings
  ) {
    this.targetSeconds = Math.max(60, settings.focusDefaultMinutes * 60);
    this.remaining = this.targetSeconds;
  }

  /** The task / project this session's minutes are attributed to, if any. */
  get target(): FocusTarget | null {
    return this.settings.focusTarget;
  }

  /**
   * Re-points the attribution. Allowed mid-session: whole minutes already
   * banked stay where they were, the pending remainder is flushed to the
   * old target first so nothing earned on one thing lands on another.
   */
  async setTarget(target: FocusTarget | null): Promise<void> {
    const same =
      (target === null && this.settings.focusTarget === null) ||
      (target !== null &&
        this.settings.focusTarget !== null &&
        focusTargetKey(target) === focusTargetKey(this.settings.focusTarget));
    if (same) return;
    await this.flush();
    this.settings.focusTarget = target;
    await this.save();
    this.emit();
  }

  /** Minutes ever attributed to a task / project. */
  targetTotal(target: { kind: string; id: string }): number {
    const entry = this.settings.focusTargets[focusTargetKey(target)];
    if (!entry) return 0;
    return Object.values(entry.log).reduce((s, v) => s + v, 0);
  }

  /**
   * Repoints this engine at a *replaced* settings object — e.g. after
   * `importSettings` swaps in a whole new one — so banked focus time keeps
   * landing in the current focusLog instead of the one from before the
   * import. Ordinary edits mutate the existing object in place and don't
   * need this.
   */
  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  get progress(): number {
    if (this.mode === "countdown") {
      if (this.targetSeconds <= 0) return 0;
      return (this.targetSeconds - this.remaining) / this.targetSeconds;
    }
    if (this.mode === "pomodoro") {
      if (this.phaseSeconds <= 0) return 0;
      return (this.phaseSeconds - this.remaining) / this.phaseSeconds;
    }
    return this.targetSeconds > 0 ? Math.min(this.elapsed / this.targetSeconds, 1) : 0;
  }

  get displaySeconds(): number {
    return this.mode === "accumulate" ? this.elapsed : this.remaining;
  }

  private lengthOf(phase: PomodoroPhase): number {
    const s = this.settings;
    const mins =
      phase === "work" ? s.pomodoroWork : phase === "short" ? s.pomodoroShort : s.pomodoroLong;
    return Math.max(60, Math.round(mins) * 60);
  }

  /** Puts `phase` on the clock (not started). */
  private loadPhase(phase: PomodoroPhase) {
    this.phase = phase;
    this.phaseSeconds = this.lengthOf(phase);
    this.remaining = this.phaseSeconds;
  }

  /**
   * Work → short break, or a long one after `pomodoroRounds` work rounds;
   * any break → the next work round. Banks the pending seconds first, so a
   * work phase's last minute lands before the break starts. Returns the
   * notice to show.
   */
  private async advancePhase(): Promise<string> {
    await this.flush();
    const t = this.strings();
    const s = this.settings;
    let notice: string;
    if (this.phase === "work") {
      this.round += 1;
      if (this.round >= s.pomodoroRounds) {
        this.loadPhase("long");
        notice = t.pomodoroCycleDone(this.round, s.pomodoroLong);
        this.round = 0;
      } else {
        this.loadPhase("short");
        notice = t.pomodoroWorkDone(s.pomodoroShort);
      }
    } else {
      this.loadPhase("work");
      notice = t.pomodoroBreakDone(this.round + 1, s.pomodoroRounds);
    }
    this.sessionMinutes = 0;
    return notice;
  }

  /** Skips the rest of the current pomodoro phase (work minutes so far are kept). */
  async skipPhase() {
    if (this.mode !== "pomodoro") return;
    const wasRunning = this.running;
    this.stopInterval();
    this.running = false;
    const notice = await this.advancePhase();
    new Notice(notice, 6000);
    if (wasRunning && this.settings.pomodoroAutoStart) this.start();
    else this.emit();
  }

  todayMinutes(): number {
    return this.settings.focusLog[toKey(new Date())] || 0;
  }

  monthMinutes(): number {
    const prefix = toKey(new Date()).slice(0, 7);
    return Object.entries(this.settings.focusLog)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((s, [, v]) => s + v, 0);
  }

  /**
   * Writes whole elapsed minutes into the focus log, keeping the remainder.
   * Banks under `unsavedDayKey` — the day those seconds were earned on — not
   * "today", so a session flushed after midnight does not credit the wrong day.
   */
  private async flush(): Promise<number> {
    const minutes = Math.floor(this.unsaved / 60);
    if (minutes <= 0) return 0;
    this.unsaved -= minutes * 60;
    const key = this.unsavedDayKey;
    this.settings.focusLog[key] = (this.settings.focusLog[key] || 0) + minutes;
    const target = this.settings.focusTarget;
    if (target) {
      const tk = focusTargetKey(target);
      const entry = (this.settings.focusTargets[tk] ??= {
        kind: target.kind,
        id: target.id,
        name: target.name,
        log: {},
      });
      entry.name = target.name;
      entry.log[key] = (entry.log[key] || 0) + minutes;
      // Focusing on a habit for a full pomodoro's worth (pomodoroWork minutes,
      // accumulated over the day) counts as doing it: check it off
      // automatically (only ever sets, never un-checks a manual tick).
      if (
        target.kind === "habit" &&
        entry.log[key] >= Math.max(1, this.settings.pomodoroWork) &&
        this.settings.habits.some((h) => h.id === target.id)
      ) {
        (this.settings.habitLog[target.id] ??= {})[key] = true;
      }
    }
    this.sessionMinutes += minutes;
    await this.save();
    // Notify subscribers so the stats and the trend chart pick up the new total.
    this.emit();
    return minutes;
  }

  setTargetMinutes(minutes: number): boolean {
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) return false;
    this.targetSeconds = Math.round(minutes) * 60;
    if (!this.running && this.mode === "countdown") this.remaining = this.targetSeconds;
    this.emit();
    return true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTickMs = Date.now();
    // Idle time before this start() (e.g. the engine sitting untouched
    // overnight) must not be misread as elapsed session time on resume.
    if (this.unsaved === 0) this.unsavedDayKey = toKey(new Date());
    this.ticker = new Ticker();
    this.ticker.start(() => void this.tick());
    this.emit();
  }

  private async tick() {
    const now = Date.now();
    // Whole seconds since the previous tick — normally 1, but larger after a
    // throttled or coalesced tick, so no real time goes uncounted.
    const from = this.lastTickMs ?? now - 1000;
    const deltaSeconds = Math.round((now - from) / 1000);
    this.lastTickMs = now;
    if (deltaSeconds <= 0) return;

    // The countdown / count-up display doesn't care which calendar day the
    // seconds fall on, so it advances by the full delta in one shot.
    if (this.mode === "accumulate") {
      this.elapsed += deltaSeconds;
    } else {
      this.remaining = Math.max(0, this.remaining - deltaSeconds);
    }

    // A pomodoro break is rest, not focus: the clock runs, the log doesn't.
    if (this.mode === "pomodoro" && this.phase !== "work") {
      if (this.remaining <= 0) await this.endPhase();
      this.emit();
      return;
    }

    // The *log*, on the other hand, must not dump a whole session (or a big
    // catch-up jump after the window was hidden overnight) onto whichever day
    // happens to be current when it is flushed — so bank it one midnight at a
    // time. In the common case (deltaSeconds small, no boundary crossed) this
    // loop runs once.
    let cursor = from;
    let left = deltaSeconds;
    while (left > 0) {
      const dayKey = toKey(new Date(cursor));
      if (dayKey !== this.unsavedDayKey) {
        // Whatever sub-minute remainder was pending belongs to the day that
        // is ending; once mixed with the new day's seconds it can no longer
        // be attributed correctly, so it is dropped (at most 59s) rather than
        // silently relabelled onto the wrong day.
        this.unsaved = 0;
        this.unsavedDayKey = dayKey;
      }
      const nextMidnight = startOfDay(addDays(new Date(cursor), 1)).getTime();
      const untilMidnight = Math.max(1, Math.round((nextMidnight - cursor) / 1000));
      const chunk = Math.min(left, untilMidnight);
      this.unsaved += chunk;
      cursor += chunk * 1000;
      left -= chunk;
    }
    // Bank every full minute, so today's total climbs during the session
    // instead of jumping only when the countdown ends.
    if (this.unsaved >= 60) void this.flush();

    if (this.mode === "countdown" && this.remaining <= 0) {
      this.stopInterval();
      this.running = false;
      await this.flush();
      new Notice(this.strings().focusDone(this.sessionMinutes));
      this.sessionMinutes = 0;
    }
    if (this.mode === "pomodoro" && this.remaining <= 0) await this.endPhase();

    this.emit();
  }

  /** A pomodoro phase ran out: announce, move on, and keep going if auto-start is on. */
  private async endPhase() {
    this.stopInterval();
    this.running = false;
    const notice = await this.advancePhase();
    new Notice(notice, 8000);
    if (this.settings.pomodoroAutoStart) this.start();
  }

  private stopInterval() {
    this.ticker?.stop();
    this.ticker = null;
    this.lastTickMs = null;
  }

  async pause() {
    if (!this.running) return;
    this.stopInterval();
    this.running = false;
    await this.flush();
    this.emit();
  }

  async reset() {
    this.stopInterval();
    const wasAccumulate = this.mode === "accumulate";
    await this.flush();
    const banked = this.sessionMinutes;
    this.running = false;
    this.remaining = this.targetSeconds;
    this.elapsed = 0;
    this.unsaved = 0;
    this.unsavedDayKey = toKey(new Date());
    this.sessionMinutes = 0;
    if (this.mode === "pomodoro") {
      this.round = 0;
      this.loadPhase("work");
    }
    if (wasAccumulate && banked > 0) {
      new Notice(this.strings().focusSaved(banked));
    }
    this.emit();
  }

  async switchMode(mode: FocusMode): Promise<boolean> {
    if (this.running) {
      new Notice(this.strings().stopBeforeSwitch);
      return false;
    }
    await this.flush();
    this.mode = mode;
    this.remaining = this.targetSeconds;
    this.elapsed = 0;
    this.unsaved = 0;
    this.unsavedDayKey = toKey(new Date());
    this.sessionMinutes = 0;
    if (mode === "pomodoro") {
      this.round = 0;
      this.loadPhase("work");
    }
    this.emit();
    return true;
  }

  unload() {
    this.stopInterval();
    void this.flush();
    this.listeners.clear();
  }
}
