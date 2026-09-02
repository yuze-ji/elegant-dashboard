import { Notice } from "obsidian";
import { AlarmItem, DashboardSettings, newId } from "./types";
import { Strings } from "./i18n";
import { daysBetween, isoWeekday, startOfDay, toKey } from "./dates";
import { Ticker } from "./ticker";

/** "YYYY-MM-DDTHH:MM" — the granularity at which an alarm may fire once. */
export function alarmStamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${toKey(d)}T${hh}:${mm}`;
}

export function normalizeTime(raw: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * The moment this alarm came due inside `(from, to]`, or null. Checking a range
 * rather than "is it this minute" is what makes the alarm survive Chromium's
 * background throttling, which stretches our 1s tick out to 60s when the
 * Obsidian window is hidden.
 */
export function dueBetween(alarm: AlarmItem, from: number, to: number): Date | null {
  if (!alarm.enabled) return null;
  const time = normalizeTime(alarm.time);
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);

  // The window is short, so only the day at each end can hold an occurrence.
  const candidates = new Set<number>();
  for (const base of [new Date(from), new Date(to)]) {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    candidates.add(d.getTime());
  }

  for (const ts of [...candidates].sort((a, b) => a - b)) {
    if (ts <= from || ts > to) continue;
    const d = new Date(ts);
    if (alarm.days.length > 0 && !alarm.days.includes(isoWeekday(d))) continue;
    return d;
  }
  return null;
}

/** Next moment this alarm would ring, or null if it never will. */
export function nextRingAt(alarm: AlarmItem, from: Date = new Date()): Date | null {
  if (!alarm.enabled) return null;
  const time = normalizeTime(alarm.time);
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  // Eight days covers any weekday pattern, including "today, later".
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= from.getTime()) continue;
    if (alarm.days.length > 0 && !alarm.days.includes(isoWeekday(d))) continue;
    return d;
  }
  return null;
}

/** Repeating two-tone chirp, built on WebAudio so no asset ships with the plugin. */
class AlarmTone {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;

  start() {
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      void this.ctx.resume?.();
      this.beep();
      this.timer = window.setInterval(() => this.beep(), 1600);
    } catch {
      /* audio unavailable — the notice still fires */
    }
  }

  private beep() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const chirps: Array<[number, number]> = [
      [0, 880],
      [0.24, 1174.66],
    ];
    for (const [offset, freq] of chirps) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Ramped rather than switched, so it reads as a chime instead of a click.
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.22);
    }
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    try {
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }
}

/** Longest an unattended alarm keeps chiming before it gives up. */
const AUTO_DISMISS_MS = 60_000;

/**
 * How far back a single check may reach. Long enough to cover a throttled
 * background tick, short enough that alarms missed while the machine slept stay
 * missed instead of all going off at once on wake.
 */
const CATCH_UP_MS = 5 * 60_000;

/**
 * Owns the alarm list and the once-a-second check. Lives on the plugin so
 * alarms still fire while the dashboard tab is closed.
 */
export class AlarmEngine {
  /** The alarm currently sounding, if any. */
  ringing: AlarmItem | null = null;

  private ticker: Ticker | null = null;
  private autoDismissId: number | null = null;
  private notice: Notice | null = null;
  private tone: AlarmTone | null = null;
  private listeners = new Set<() => void>();
  /** End of the range covered by the last check. */
  private lastCheck = Date.now();
  private readonly onWake = () => void this.tick();

  constructor(
    private settings: DashboardSettings,
    private save: () => Promise<void>,
    private strings: () => Strings
  ) {}

  /**
   * Repoints this engine at a *replaced* settings object — e.g. after
   * `importSettings` swaps in a whole new one — so the background tick keeps
   * checking real data instead of the object from before the import.
   * Ordinary edits mutate the existing object in place and don't need this.
   */
  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
  }

  load() {
    if (this.ticker) return;
    this.lastCheck = Date.now();
    this.ticker = new Ticker();
    this.ticker.start(() => void this.tick());
    // Belt and braces: if the worker ever is throttled, returning to the window
    // still checks immediately, and the catch-up window covers the gap.
    window.addEventListener("focus", this.onWake);
    document.addEventListener("visibilitychange", this.onWake);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  list(): AlarmItem[] {
    return this.settings.alarms;
  }

  /** Alarms sorted by time of day, for display. */
  sorted(): AlarmItem[] {
    return [...this.settings.alarms].sort((a, b) => a.time.localeCompare(b.time));
  }

  async add(time = "08:00"): Promise<AlarmItem> {
    const alarm: AlarmItem = {
      id: newId(),
      time,
      label: "",
      enabled: true,
      days: [],
      lastFired: null,
    };
    this.settings.alarms.push(alarm);
    await this.save();
    this.emit();
    return alarm;
  }

  /**
   * `silent` saves without notifying subscribers — used for the label field, so
   * typing a name does not tear down the row the user is still interacting with.
   */
  async update(id: string, patch: Partial<AlarmItem>, silent = false): Promise<void> {
    const alarm = this.settings.alarms.find((a) => a.id === id);
    if (!alarm) return;
    Object.assign(alarm, patch);
    // Re-arming a changed alarm must not be blocked by an old fire stamp.
    if (patch.time !== undefined || patch.days !== undefined || patch.enabled === true) {
      alarm.lastFired = null;
    }
    await this.save();
    if (!silent) this.emit();
  }

  /** Returns the removed alarm and its position, so a caller can offer undo. */
  async remove(id: string): Promise<{ item: AlarmItem; index: number } | null> {
    const index = this.settings.alarms.findIndex((a) => a.id === id);
    if (index < 0) return null;
    if (this.ringing?.id === id) this.dismiss();
    const [item] = this.settings.alarms.splice(index, 1);
    await this.save();
    this.emit();
    return { item, index };
  }

  /** Re-inserts an alarm removed by `remove`, in its original position. */
  async restore(item: AlarmItem, index: number): Promise<void> {
    const at = Math.min(index, this.settings.alarms.length);
    this.settings.alarms.splice(at, 0, item);
    await this.save();
    this.emit();
  }

  private async tick() {
    const now = Date.now();
    const from = Math.max(this.lastCheck, now - CATCH_UP_MS);
    this.lastCheck = now;

    // Deadline reminders share this same background-safe tick rather than
    // running their own Worker — one alarm ringing does not make a due
    // reminder any less worth surfacing, so this runs regardless of `ringing`.
    void this.checkDeadlineReminders();

    if (this.ringing) return;

    for (const alarm of this.settings.alarms) {
      const due = dueBetween(alarm, from, now);
      if (!due) continue;
      // Second guard: a reload resets lastCheck, and the stamp keeps that from
      // re-ringing an alarm that already went off this minute.
      const stamp = alarmStamp(due);
      if (alarm.lastFired === stamp) continue;
      alarm.lastFired = stamp;
      await this.save();
      this.ring(alarm);
      return;
    }
  }

  /**
   * One-time, quieter cousin of the alarm ring: a plain Notice, no sound, no
   * banner to dismiss. Fires as soon as the day count drops to
   * `remindDaysBefore` *or under* — not on an exact match — so a reminder
   * whose window was missed while the app was closed still lands late
   * instead of never, the same trade-off `dueBetween`'s catch-up window makes
   * for alarms. `overdue` deadlines (days < 0) are excluded: reminding about
   * something already past due is a different feature than this one.
   */
  private async checkDeadlineReminders() {
    const today = startOfDay(new Date());
    let changed = false;
    for (const d of this.settings.deadlines) {
      if (d.remindDaysBefore == null || d.reminded) continue;
      const days = daysBetween(today, new Date(d.date + "T00:00:00"));
      if (days < 0 || days > d.remindDaysBefore) continue;
      d.reminded = true;
      changed = true;
      const t = this.strings();
      new Notice(t.deadlineReminderNotice(d.title, days), 10_000);
    }
    if (changed) await this.save();
  }

  private ring(alarm: AlarmItem) {
    const t = this.strings();
    this.ringing = alarm;
    const label = alarm.label.trim() || t.alarmUntitled;
    this.notice = new Notice(t.alarmRinging(alarm.time, label), 0);
    if (this.settings.alarmSound) {
      this.tone = new AlarmTone();
      this.tone.start();
    }
    this.autoDismissId = window.setTimeout(() => this.dismiss(), AUTO_DISMISS_MS);
    this.emit();
  }

  dismiss() {
    if (!this.ringing) return;
    this.ringing = null;
    if (this.autoDismissId !== null) {
      window.clearTimeout(this.autoDismissId);
      this.autoDismissId = null;
    }
    this.tone?.stop();
    this.tone = null;
    this.notice?.hide();
    this.notice = null;
    this.emit();
  }

  unload() {
    this.dismiss();
    this.ticker?.stop();
    this.ticker = null;
    window.removeEventListener("focus", this.onWake);
    document.removeEventListener("visibilitychange", this.onWake);
    this.listeners.clear();
  }
}
