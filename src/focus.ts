import { Notice } from "obsidian";
import { DashboardSettings } from "./types";
import { addDays, startOfDay, toKey } from "./dates";
import { Strings } from "./i18n";
import { Ticker } from "./ticker";

export type FocusMode = "countdown" | "accumulate";

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
    return this.targetSeconds > 0 ? Math.min(this.elapsed / this.targetSeconds, 1) : 0;
  }

  get displaySeconds(): number {
    return this.mode === "countdown" ? this.remaining : this.elapsed;
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
    if (this.mode === "countdown") {
      this.remaining = Math.max(0, this.remaining - deltaSeconds);
    } else {
      this.elapsed += deltaSeconds;
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

    this.emit();
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
    this.emit();
    return true;
  }

  unload() {
    this.stopInterval();
    void this.flush();
    this.listeners.clear();
  }
}
