import { requestUrl } from "obsidian";
import { DeadlineItem, newId } from "./types";
import { toKey } from "./dates";
import { Store } from "./mutations";

/**
 * Just enough iCalendar to pull exam dates out of a university timetable:
 * VEVENT blocks with UID / SUMMARY / DTSTART. Recurring events (RRULE) are
 * taken at their first occurrence only — a weekly lecture is not a deadline,
 * and the keyword filter is what keeps those out anyway.
 */
export interface IcsEvent {
  uid: string;
  summary: string;
  /** YYYY-MM-DD, local. */
  date: string;
  /** HH:MM local, or null for an all-day event. */
  time: string | null;
}

export function parseIcs(text: string): IcsEvent[] {
  // Unfold: a line starting with a space or tab continues the previous one.
  const unfolded = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of unfolded.split("\n")) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.uid && cur.summary && cur.date) events.push(cur as IcsEvent);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const name = head.split(";")[0].toUpperCase();
    if (name === "UID") cur.uid = value.trim();
    else if (name === "SUMMARY") cur.summary = unescapeText(value).trim();
    else if (name === "DTSTART") {
      const parsed = parseDt(value.trim(), /VALUE=DATE(?![-T])/i.test(head));
      if (parsed) {
        cur.date = parsed.date;
        cur.time = parsed.time;
      }
    }
  }
  return events;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
}

/** 20261216T180000Z / 20261216T180000 / 20261216 → local date + time. */
function parseDt(v: string, dateOnly: boolean): { date: string; time: string | null } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, hh, mm, , z] = m;
  if (dateOnly || hh === undefined) return { date: `${y}-${mo}-${d}`, time: null };
  const dt = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm))
    : new Date(+y, +mo - 1, +d, +hh, +mm);
  if (Number.isNaN(dt.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: toKey(dt), time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
}

export async function fetchIcs(url: string): Promise<string> {
  const u = url.trim().replace(/^webcal:\/\//i, "https://");
  const res = await requestUrl({ url: u });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return res.text;
}

export interface IcsImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Merges events into the deadline list. Matched by UID: an existing deadline
 * is updated in place (title / date / time; a moved date re-arms its
 * reminder), a new one is created, one the user deleted stays deleted.
 * Past events and those not matching a keyword (when any are set) are
 * skipped.
 */
export async function importIcsEvents(
  store: Store,
  events: IcsEvent[],
  keywords: string[]
): Promise<IcsImportResult> {
  const s = store.settings;
  const today = toKey(new Date());
  const kws = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const deleted = new Set(s.icsDeletedUids);
  const byUid = new Map<string, DeadlineItem>();
  for (const d of s.deadlines) if (d.icsUid) byUid.set(d.icsUid, d);

  const result: IcsImportResult = { added: 0, updated: 0, skipped: 0 };
  for (const ev of events) {
    if (ev.date < today || deleted.has(ev.uid)) {
      result.skipped++;
      continue;
    }
    if (kws.length > 0 && !kws.some((k) => ev.summary.toLowerCase().includes(k))) {
      result.skipped++;
      continue;
    }
    const existing = byUid.get(ev.uid);
    if (existing) {
      let changed = false;
      if (existing.title !== ev.summary) {
        existing.title = ev.summary;
        changed = true;
      }
      if (existing.date !== ev.date || existing.time !== ev.time) {
        existing.date = ev.date;
        existing.time = ev.time;
        existing.reminded = false;
        changed = true;
      }
      if (changed) result.updated++;
      continue;
    }
    s.deadlines.push({
      id: newId(),
      title: ev.summary,
      date: ev.date,
      time: ev.time,
      remindDaysBefore: null,
      remindMinutesBefore: null,
      reminded: false,
      done: false,
      note: null,
      icsUid: ev.uid,
    });
    byUid.set(ev.uid, s.deadlines[s.deadlines.length - 1]);
    result.added++;
  }
  if (result.added || result.updated) await store.save();
  return result;
}
