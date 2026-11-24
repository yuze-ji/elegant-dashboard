/** Small date helpers so the plugin does not depend on moment. */

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

/** ISO weekday: Monday = 1 … Sunday = 7 */
export function isoWeekday(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function startOfIsoWeek(d: Date): Date {
  return startOfDay(addDays(d, -(isoWeekday(d) - 1)));
}

export function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function eachDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur.getTime() <= end.getTime()) {
    out.push(toKey(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatTime(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${hh}:${mm}`;
}

/**
 * Whole calendar days from `a` to `b` (positive when `b` is later), ignoring
 * time of day. Diffing through `startOfDay` first and rounding afterwards
 * keeps a DST-shortened or -lengthened day from throwing the count off by one.
 */
export function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/**
 * The next due date for a repeating task, strictly after both its current
 * due date and today — so a daily task finished three days late comes back
 * tomorrow, not three times over. `days` are ISO weekdays for "weekly";
 * empty means "same weekday next week". Monthly keeps the day-of-month and
 * clamps (31st → 30th) rather than overflowing into the month after.
 */
export function nextOccurrence(
  repeat: "daily" | "weekly" | "monthly",
  days: number[],
  dueDate: string | null,
  today: Date = new Date()
): string {
  const due = dueDate ? new Date(dueDate + "T00:00:00") : startOfDay(today);
  const floor = startOfDay(due.getTime() > startOfDay(today).getTime() ? due : today);

  if (repeat === "daily") return toKey(addDays(floor, 1));

  if (repeat === "weekly") {
    const wanted = days.length > 0 ? days : [isoWeekday(due)];
    for (let i = 1; i <= 7; i++) {
      const d = addDays(floor, i);
      if (wanted.includes(isoWeekday(d))) return toKey(d);
    }
    return toKey(addDays(floor, 7));
  }

  // monthly
  const dayOfMonth = due.getDate();
  let cursor = new Date(due.getFullYear(), due.getMonth(), 1);
  for (let i = 0; i < 24; i++) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(dayOfMonth, lastDay));
    if (candidate.getTime() > floor.getTime()) return toKey(candidate);
  }
  return toKey(addDays(floor, 30));
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
