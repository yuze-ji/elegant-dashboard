import { ProjectItem } from "../types";
import { Ctx, card, empty } from "../ui";
import { addDays, addMonths, daysBetween, startOfDay, startOfMonth } from "../dates";
import { withAlpha } from "../charts";
import { PRIORITY_COLOR } from "./projects";

/**
 * A project needs a due date to appear here at all — a bar has to end
 * somewhere. The start is always `createdAt` (stamped once, never edited;
 * see mutations.ts), so there's nothing to configure beyond setting a due
 * date on the project itself.
 */
export function renderGantt(parent: HTMLElement, ctx: Ctx, projects: ProjectItem[]) {
  const { t } = ctx;
  const root = card(parent, `📅 ${t.ganttTitle}`);

  const withDates = projects
    .filter((p): p is ProjectItem & { dueDate: string } => !!p.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (withDates.length === 0) {
    empty(root, t.ganttNoDates);
    return;
  }

  const today = startOfDay(new Date());
  const parseDay = (key: string) => startOfDay(new Date(key + "T00:00:00"));

  // Earliest start to latest end across every bar, padded a little and
  // stretched to include today so its marker line is never clipped off.
  let rangeStart = today;
  let rangeEnd = today;
  for (const p of withDates) {
    const start = parseDay(p.createdAt);
    const end = parseDay(p.dueDate);
    if (start.getTime() < rangeStart.getTime()) rangeStart = start;
    if (end.getTime() > rangeEnd.getTime()) rangeEnd = end;
  }
  rangeStart = addDays(rangeStart, -2);
  rangeEnd = addDays(rangeEnd, 2);
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd));
  const pct = (d: Date) => (daysBetween(rangeStart, d) / totalDays) * 100;

  // ---- month axis
  const header = root.createDiv({ cls: "ed-gantt-header" });
  header.createDiv({ cls: "ed-gantt-label-spacer" });
  const axis = header.createDiv({ cls: "ed-gantt-axis" });
  let cursor = startOfMonth(rangeStart);
  while (cursor.getTime() <= rangeEnd.getTime()) {
    if (cursor.getTime() >= rangeStart.getTime()) {
      const label = axis.createSpan({
        cls: "ed-gantt-month",
        text: t.monthNames[cursor.getMonth()],
      });
      label.style.left = `${pct(cursor)}%`;
    }
    cursor = addMonths(cursor, 1);
  }

  // ---- rows
  const body = root.createDiv({ cls: "ed-gantt-body" });
  for (const p of withDates) {
    const start = parseDay(p.createdAt);
    const end = parseDay(p.dueDate);
    const left = pct(start);
    // A project due the same day it was created (or a very short one) would
    // otherwise render as an invisible sliver — floor it to something
    // clickable/visible without distorting the longer bars.
    const width = Math.max(pct(end) - left, 1.5);
    const overdue = p.status !== "done" && end.getTime() < today.getTime();

    const row = body.createDiv({ cls: "ed-gantt-row" });
    if (overdue) row.addClass("is-overdue");
    row.createDiv({ cls: "ed-gantt-label", text: p.name });

    const track = row.createDiv({ cls: "ed-gantt-track" });
    if (today.getTime() >= rangeStart.getTime() && today.getTime() <= rangeEnd.getTime()) {
      const todayLine = track.createDiv({ cls: "ed-gantt-today" });
      todayLine.style.left = `${pct(today)}%`;
    }

    const color = PRIORITY_COLOR[p.priority] || "#8A9BA3";
    const bar = track.createDiv({ cls: "ed-gantt-bar" });
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.style.background = withAlpha(color, 0.22);
    bar.setAttr(
      "aria-label",
      `${p.name} · ${p.createdAt} → ${p.dueDate} · ${p.progress}%`
    );
    const fill = bar.createDiv({ cls: "ed-gantt-bar-fill" });
    fill.style.width = `${Math.max(0, Math.min(100, p.progress))}%`;
    fill.style.background = color;

    row.createDiv({ cls: "ed-gantt-pct", text: `${p.progress}%` });
  }
}
