import { TaskItem } from "../types";
import { Ctx, card } from "../ui";
import { addDays, isoWeekday, startOfDay, toKey } from "../dates";
import { normalizeTime } from "../alarm";
import { compareTime } from "./deadlines";
import { renderNoteButton } from "../noteLink";
import { Store, deadlineProgress } from "../mutations";

interface Entry {
  /** "HH:MM" or null for all-day; sorted first within a day. */
  time: string | null;
  icon: string;
  text: string;
  note: string | null;
}

/**
 * The next seven days as a list — deadlines, tasks due that day and alarms
 * that will ring, in clock order — pulled from data the other modules own,
 * the way the Today card is. The calendar page answers "what's on the
 * 19th?"; this answers "what's coming?", which is the question most
 * mornings actually ask.
 */
export function renderAgenda(parent: HTMLElement, ctx: Ctx, tasks: TaskItem[]) {
  const { t, settings } = ctx;
  const store: Store = { settings, save: ctx.save };
  const root = card(parent, `🗓️ ${t.agenda}`);
  root.addClass("ed-agenda");
  const list = root.createDiv({ cls: "ed-agenda-list" });

  const today = startOfDay(new Date());

  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    const key = toKey(day);
    const iso = isoWeekday(day);
    const entries: Entry[] = [];

    for (const d of settings.deadlines) {
      if (d.done || d.date !== key) continue;
      const { done, total } = deadlineProgress(store, d.id);
      entries.push({
        time: d.time,
        icon: "⏳",
        text: total > 0 ? `${d.title}  ${done}/${total}` : d.title,
        note: d.note,
      });
    }
    for (const task of tasks) {
      if (task.done || task.dueDate !== key) continue;
      entries.push({ time: null, icon: "✅", text: task.name, note: task.note });
    }
    for (const a of settings.alarms) {
      if (!a.enabled) continue;
      const rings =
        a.repeat === "once"
          ? a.date === key
          : a.repeat === "daily" || a.days.length === 0 || a.days.includes(iso);
      if (!rings) continue;
      entries.push({
        time: normalizeTime(a.time),
        icon: "⏰",
        text: a.label.trim() || t.alarmUntitled,
        note: null,
      });
    }
    entries.sort((a, b) => compareTime({ time: a.time }, { time: b.time }));

    const head = list.createDiv({ cls: "ed-agenda-day" });
    if (i === 0) head.addClass("is-today");
    head.createSpan({
      text: `${t.formatDayTitle(day.getMonth() + 1, day.getDate())} ${t.weekdayShort[iso - 1]}`,
    });
    if (i === 0) head.createSpan({ cls: "ed-agenda-tag", text: t.agendaToday });
    else if (i === 1) head.createSpan({ cls: "ed-agenda-tag", text: t.agendaTomorrow });

    if (entries.length === 0) {
      list.createDiv({ cls: "ed-agenda-empty", text: t.agendaNothing });
      continue;
    }
    for (const e of entries) {
      const row = list.createDiv({ cls: "ed-agenda-row" });
      row.createSpan({ cls: "ed-agenda-time", text: e.time ?? "—" });
      row.createSpan({ cls: "ed-agenda-icon", text: e.icon });
      row.createSpan({ cls: "ed-agenda-text", text: e.text, title: e.text });
      renderNoteButton(row, ctx.app, settings.lang, e.note);
    }
  }
}
