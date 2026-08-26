import { Ctx, HoverTooltip, badge, card, empty } from "../ui";
import { LineGeometry, drawLineChart, lineHitTest, themeColors } from "../charts";
import { FocusEngine } from "../focus";
import { addDays, isoWeekday, startOfDay, toKey } from "../dates";

type Range = 7 | 30 | 365;

export function renderFocusHistory(parent: HTMLElement, ctx: Ctx, engine: FocusEngine) {
  const { t } = ctx;
  const root = card(parent, `⏱️ ${t.focusHistory}`);
  root.createDiv({ cls: "ed-divider" });
  const body = root.createDiv();

  let range: Range = 30;
  const tooltip = new HoverTooltip(ctx.onCleanup);
  const colors = themeColors();

  // One observer for the component, re-pointed on each draw, so repeated
  // redraws cannot pile up observers on detached nodes.
  let ro: ResizeObserver | null = null;
  ctx.onCleanup(() => ro?.disconnect());

  const draw = () => {
    body.empty();
    ro?.disconnect();

    const log = ctx.settings.focusLog;
    if (Object.keys(log).length === 0) {
      empty(body, t.noFocusData);
      return;
    }

    const today = startOfDay(new Date());
    const start = addDays(today, -(range - 1));
    const dates: string[] = [];
    for (let d = start; d.getTime() <= today.getTime(); d = addDays(d, 1)) {
      dates.push(toKey(d));
    }
    const values = dates.map((d) => log[d] || 0);

    // ---- range tabs
    const bar = body.createDiv({ cls: "ed-year-bar" });
    bar.createDiv({
      cls: "ed-range",
      text: t.last365days.replace(/365/, String(range)),
    });
    const tabs = bar.createDiv({ cls: "ed-tabs" });
    const mkTab = (r: Range, label: string) => {
      const b = tabs.createEl("button", { cls: "ed-tab", text: label });
      if (range === r) b.addClass("is-active");
      b.onclick = () => {
        range = r;
        draw();
      };
    };
    mkTab(7, t.weekView);
    mkTab(30, t.monthView);
    mkTab(365, t.yearView);

    // ---- chart
    const chartWrap = body.createDiv({ cls: "ed-focus-chart" });
    const canvas = chartWrap.createEl("canvas", { cls: "ed-chart-canvas" });

    let geo: LineGeometry | null = null;
    let hover = -1;

    const labels = dates.map((d) => {
      const dt = new Date(d + "T00:00:00");
      return `${dt.getMonth() + 1}/${dt.getDate()}`;
    });

    const paint = () => {
      const w = Math.max(280, chartWrap.clientWidth || 520);
      geo = drawLineChart(
        canvas,
        w,
        200,
        { labels, values, color: "#6B9E8A", colors, formatY: (v) => `${Math.round(v)}` },
        hover
      );
    };
    paint();

    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const idx = lineHitTest(geo, e.clientX - r.left);
      if (idx !== hover) {
        hover = idx;
        paint();
      }
      if (idx === -1) {
        tooltip.hide();
        return;
      }
      const dt = new Date(dates[idx] + "T00:00:00");
      tooltip.el.empty();
      tooltip.el.createDiv({
        cls: "ed-tooltip-date",
        text: `${t.formatDayTitle(dt.getMonth() + 1, dt.getDate())} ${
          t.weekdayFull[isoWeekday(dt) - 1]
        }`,
      });
      tooltip.el.createDiv({
        cls: "ed-tooltip-count",
        text: `${values[idx]} ${t.minuteUnit}`,
      });
      tooltip.show();
      tooltip.move(e);
    });

    canvas.addEventListener("mouseleave", () => {
      if (hover !== -1) {
        hover = -1;
        paint();
      }
      tooltip.hide();
    });

    ro = new ResizeObserver(() => {
      if (chartWrap.clientWidth > 0) paint();
    });
    ro.observe(chartWrap);

    // ---- summary badges
    const total = values.reduce((s, v) => s + v, 0);
    const activeDays = values.filter((v) => v > 0).length;
    const best = Math.max(0, ...values);
    const bestIdx = values.indexOf(best);

    const row = body.createDiv({ cls: "ed-badges" });
    badge(row, `${t.totalFocus} ${formatMinutes(total, t.hoursUnit, t.minuteUnit)}`);
    badge(
      row,
      `${t.avgPerDay} ${activeDays > 0 ? Math.round(total / activeDays) : 0} ${t.minuteUnit}`
    );
    badge(row, `${t.activeDaysShort} ${activeDays} ${t.daysUnit}`);
    if (best > 0) {
      const d = new Date(dates[bestIdx] + "T00:00:00");
      badge(row, `${t.bestDay} ${best} ${t.minuteUnit} (${d.getMonth() + 1}/${d.getDate()})`);
    }
    badge(row, `${t.streak} ${currentStreak(log)} ${t.daysUnit}`);
  };

  draw();

  // Redraw whenever a minute is banked. The engine emits every second, so
  // compare the logged total and skip the ticks that changed nothing.
  let lastTotal = totalMinutes(ctx.settings.focusLog);
  const unsubscribe = engine.onChange(() => {
    const now = totalMinutes(ctx.settings.focusLog);
    if (now === lastTotal) return;
    lastTotal = now;
    draw();
  });
  ctx.onCleanup(unsubscribe);
}

function totalMinutes(log: Record<string, number>): number {
  return Object.values(log).reduce((s, v) => s + v, 0);
}

function formatMinutes(mins: number, hoursUnit: string, minuteUnit: string): string {
  if (mins < 60) return `${mins} ${minuteUnit}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ${hoursUnit}` : `${h} ${hoursUnit} ${m} ${minuteUnit}`;
}

/**
 * Consecutive days with focus time, counting back from today. Today not being
 * logged yet does not break the streak — only a gap before it does.
 */
function currentStreak(log: Record<string, number>): number {
  let day = startOfDay(new Date());
  if (!(log[toKey(day)] > 0)) day = addDays(day, -1);
  let streak = 0;
  while (log[toKey(day)] > 0) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
