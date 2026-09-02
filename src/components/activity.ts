import { ActivityData } from "../types";
import { Ctx, HEAT_COLORS, badge, card, heatLevel } from "../ui";
import {
  addDays,
  eachDay,
  endOfMonth,
  isoWeekday,
  startOfDay,
  startOfIsoWeek,
  startOfMonth,
  toKey,
} from "../dates";

type ViewMode = "week" | "month" | "year";

// Chunky, GitHub-heatmap-but-bigger cells rather than a dense dot grid — the
// row scrolls horizontally (see .ed-scroll), so there's no ceiling forcing
// 365 days into one screen width the way a fixed-size card would.
const CELL = 20;
const GAP = 5;
const STEP = CELL + GAP;
// The month strip is already offset by the weekday gutter via CSS margin-left,
// so month labels position from 0 relative to the grid.

export function renderActivity(parent: HTMLElement, ctx: Ctx, activity: ActivityData) {
  const { t } = ctx;
  const root = card(parent, t.noteActivity);
  root.addClass("ed-activity");
  root.createDiv({ cls: "ed-divider" });
  const body = root.createDiv();

  let mode: ViewMode = "year";
  const tooltip = document.body.createDiv({ cls: "ed-tooltip" });
  ctx.onCleanup(() => tooltip.remove());

  const stats = (dates: string[]) => {
    let activeDays = 0;
    let totalFiles = 0;
    let newFiles = 0;
    for (const d of dates) {
      const c = activity.modified[d] || 0;
      if (c > 0) activeDays++;
      totalFiles += c;
      newFiles += (activity.created[d] || []).length;
    }
    return { activeDays, totalFiles, newFiles };
  };

  const renderBadges = (host: HTMLElement, dates: string[]) => {
    const row = host.createDiv({ cls: "ed-badges" });
    const s = stats(dates);
    badge(row, `${s.activeDays} ${t.activeDays}`);
    badge(row, `${s.totalFiles} ${t.fileUpdates}`);
    badge(row, `${s.newFiles} ${t.newNotes}`);
    return row;
  };

  const attachTooltip = (el: HTMLElement, dateStr: string) => {
    el.addEventListener("mouseenter", () => {
      tooltip.empty();
      const d = new Date(dateStr + "T00:00:00");
      const wk = t.weekdayFull[isoWeekday(d) - 1];
      tooltip.createDiv({
        cls: "ed-tooltip-date",
        text: `${t.formatDayTitle(d.getMonth() + 1, d.getDate())} ${wk}`,
      });
      tooltip.createDiv({
        cls: "ed-tooltip-count",
        text: `${activity.modified[dateStr] || 0} ${t.fileActivity}`,
      });
      const focus = ctx.settings.focusLog[dateStr] || 0;
      if (focus > 0) {
        tooltip.createDiv({
          cls: "ed-tooltip-focus",
          text: `⏱️ ${focus} ${t.minutesFocused}`,
        });
      }
      const created = activity.created[dateStr] || [];
      if (created.length > 0) {
        tooltip.createDiv({ cls: "ed-tooltip-new", text: t.added });
        created.slice(0, 6).forEach((n) =>
          tooltip.createDiv({ cls: "ed-tooltip-file", text: n })
        );
        if (created.length > 6) {
          tooltip.createDiv({ cls: "ed-tooltip-file", text: t.andMore(created.length) });
        }
      }
      tooltip.addClass("is-visible");
    });
    el.addEventListener("mousemove", (e: MouseEvent) => {
      const pad = 14;
      const w = tooltip.offsetWidth;
      const h = tooltip.offsetHeight;
      let x = e.clientX + pad;
      let y = e.clientY + pad;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
      if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
      tooltip.style.left = `${Math.max(8, x)}px`;
      tooltip.style.top = `${Math.max(8, y)}px`;
    });
    el.addEventListener("mouseleave", () => tooltip.removeClass("is-visible"));
  };

  const buildTabs = (host: HTMLElement) => {
    const tabs = host.createDiv({ cls: "ed-tabs" });
    const mk = (id: ViewMode, label: string) => {
      const b = tabs.createEl("button", { cls: "ed-tab", text: label });
      if (mode === id) b.addClass("is-active");
      b.onclick = () => {
        mode = id;
        draw();
      };
    };
    mk("week", t.weekView);
    mk("month", t.monthView);
    mk("year", t.yearView);
    return tabs;
  };

  const buildLegend = (host: HTMLElement) => {
    const legend = host.createDiv({ cls: "ed-legend" });
    legend.createSpan({ text: t.less });
    HEAT_COLORS.forEach((c) => {
      const box = legend.createDiv({ cls: "ed-legend-box" });
      box.style.background = c;
    });
    legend.createSpan({ text: t.more });
    return legend;
  };

  const drawYear = () => {
    const today = startOfDay(new Date());
    const start = addDays(today, -364);
    const todayStr = toKey(today);

    const bar = body.createDiv({ cls: "ed-year-bar" });
    bar.createDiv({ cls: "ed-range", text: t.last365days });
    buildTabs(bar);
    buildLegend(bar);

    const scroll = body.createDiv({ cls: "ed-scroll" });
    const monthsRow = scroll.createDiv({ cls: "ed-months" });
    const grid = scroll.createDiv({ cls: "ed-grid-body" });

    const wkLabels = grid.createDiv({ cls: "ed-wk-labels" });
    t.weekdayShort.forEach((w, i) => {
      wkLabels.createDiv({ cls: "ed-wk-label", text: i % 2 === 0 ? w : "" });
    });

    const gridEl = grid.createDiv({ cls: "ed-grid" });
    let cursor = startOfIsoWeek(start);
    let weekIndex = 0;
    let lastMonth = -1;

    while (cursor.getTime() <= today.getTime()) {
      const col = gridEl.createDiv({ cls: "ed-week-col" });
      for (let i = 0; i < 7; i++) {
        const day = addDays(cursor, i);
        const inRange = day.getTime() >= start.getTime() && day.getTime() <= today.getTime();
        const cell = col.createDiv({ cls: "ed-pill" });
        if (!inRange) {
          cell.addClass("is-blank");
          continue;
        }
        const key = toKey(day);
        const count = activity.modified[key] || 0;
        cell.dataset.level = String(heatLevel(count));
        if (key === todayStr) cell.addClass("is-today");
        attachTooltip(cell, key);

        if (day.getDate() <= 7 && day.getMonth() !== lastMonth) {
          lastMonth = day.getMonth();
          const label = monthsRow.createSpan({
            cls: "ed-month-label",
            text: t.monthNames[day.getMonth()],
          });
          label.style.left = `${weekIndex * STEP}px`;
        }
      }
      cursor = addDays(cursor, 7);
      weekIndex++;
    }

    renderBadges(body, eachDay(start, today));
  };

  const drawMonth = () => {
    const now = new Date();
    const first = startOfMonth(now);
    const last = endOfMonth(now);
    const todayStr = toKey(now);

    const top = body.createDiv({ cls: "ed-month-top" });
    top.createDiv({
      cls: "ed-month-title",
      text: t.formatMonthTitle(now.getFullYear(), now.getMonth() + 1),
    });
    buildTabs(top);

    const weekdays = body.createDiv({ cls: "ed-cal-weekdays" });
    t.weekdayShort.forEach((w) => weekdays.createDiv({ cls: "ed-cal-wk-label", text: w }));

    const grid = body.createDiv({ cls: "ed-cal-grid" });
    const lead = isoWeekday(first) - 1;
    for (let i = 0; i < lead; i++) grid.createDiv({ cls: "ed-cal-cell is-empty" });

    for (let d = 1; d <= last.getDate(); d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), d);
      const key = toKey(day);
      const count = activity.modified[key] || 0;
      const cell = grid.createDiv({ cls: "ed-cal-cell", text: String(d) });
      cell.dataset.level = String(heatLevel(count));
      if (key === todayStr) cell.addClass("is-today");
      attachTooltip(cell, key);
    }

    const bottom = body.createDiv({ cls: "ed-month-bottom" });
    buildLegend(bottom);
    renderBadges(bottom, eachDay(first, last));
  };

  const drawWeek = () => {
    const now = startOfDay(new Date());
    const start = addDays(now, -6);
    const todayStr = toKey(now);

    const top = body.createDiv({ cls: "ed-week-top" });
    top.createDiv({ cls: "ed-week-range", text: t.formatRange(start, now) });
    buildTabs(top);

    const row = body.createDiv({ cls: "ed-week-row" });
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const key = toKey(day);
      const count = activity.modified[key] || 0;
      const cardEl = row.createDiv({ cls: "ed-week-card" });
      if (key === todayStr) cardEl.addClass("is-today");
      cardEl.createDiv({
        cls: "ed-week-day",
        text: t.weekdayShort[isoWeekday(day) - 1],
      });
      const dot = cardEl.createDiv({ cls: "ed-week-dot" });
      dot.dataset.level = String(heatLevel(count));
      attachTooltip(dot, key);
      cardEl.createDiv({ cls: "ed-week-count", text: String(count) });
      cardEl.createDiv({
        cls: "ed-week-date",
        text: `${day.getMonth() + 1}.${day.getDate()}`,
      });
    }

    renderBadges(body, eachDay(start, now));
  };

  const draw = () => {
    body.empty();
    tooltip.removeClass("is-visible");
    if (mode === "year") drawYear();
    else if (mode === "month") drawMonth();
    else drawWeek();
  };

  draw();
}
