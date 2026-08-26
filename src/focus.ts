import { Notice } from "obsidian";
import { DashboardSettings } from "./types";
import { toKey } from "./dates";
import { Strings } from "./i18n";

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
  /** Minutes already banked during the current run, for the completion notice. */
  private sessionMinutes = 0;
  private intervalId: number | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private settings: DashboardSettings,
    private save: () => Promise<void>,
    private strings: () => Strings
  ) {
    this.targetSeconds = Math.max(60, settings.focusDefaultMinutes * 60);
    this.remaining = this.targetSeconds;
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

  /** Writes whole elapsed minutes into the focus log, keeping the remainder. */
  private async flush(): Promise<number> {
    const minutes = Math.floor(this.unsaved / 60);
    if (minutes <= 0) return 0;
    this.unsaved -= minutes * 60;
    const key = toKey(new Date());
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
    this.intervalId = window.setInterval(() => this.tick(), 1000);
    this.emit();
  }

  private async tick() {
    this.unsaved++;

    if (this.mode === "countdown") {
      if (this.remaining > 0) this.remaining--;
      // Bank every full minute, so today's total climbs during the session
      // instead of jumping only when the countdown ends.
      if (this.unsaved >= 60) void this.flush();
      if (this.remaining <= 0) {
        this.stopInterval();
        this.running = false;
        await this.flush();
        new Notice(this.strings().focusDone(this.sessionMinutes));
        this.sessionMinutes = 0;
      }
    } else {
      this.elapsed++;
      // Persist every full minute so a crash cannot lose a long session.
      if (this.unsaved >= 60) void this.flush();
    }

    this.emit();
  }

  private stopInterval() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
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
