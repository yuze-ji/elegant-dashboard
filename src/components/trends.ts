import { VaultStats } from "../types";
import { Ctx, HoverTooltip, TAG_COLORS, empty } from "../ui";
import {
  BarGeometry,
  DonutGeometry,
  barHitTest,
  donutHitTest,
  drawBarChart,
  drawDonut,
  themeColors,
} from "../charts";

export function renderTrends(parent: HTMLElement, ctx: Ctx, stats: VaultStats, months: string[]) {
  const { t } = ctx;
  const row = parent.createDiv({ cls: "ed-card ed-chart-row" });
  const colors = themeColors();
  const tooltip = new HoverTooltip(ctx.onCleanup);

  // ---- monthly word trend
  const trendCol = row.createDiv({ cls: "ed-chart-col" });
  trendCol.createDiv({ cls: "ed-chart-title", text: t.wordTrend });
  const trendCanvas = trendCol.createEl("canvas", { cls: "ed-chart-canvas" });

  // ---- tag distribution
  const tagCol = row.createDiv({ cls: "ed-chart-col ed-chart-col-narrow" });
  tagCol.createDiv({ cls: "ed-chart-title", text: t.tagRatio });
  const tagCanvas = tagCol.createEl("canvas", { cls: "ed-chart-canvas" });
  const hasTags = stats.topTags.length > 0;
  if (!hasTags) empty(tagCol, t.noTags);

  const monthLabels = months.map((m) => t.monthNames[parseInt(m.slice(5, 7), 10) - 1]);
  const monthValues = months.map((m) => stats.monthlyWords[m] || 0);
  const tagEntries = stats.topTags.map(([label, value], i) => ({
    label,
    value,
    color: TAG_COLORS[i % TAG_COLORS.length],
  }));
  const tagTotal = tagEntries.reduce((s, e) => s + e.value, 0);

  let barGeo: BarGeometry | null = null;
  let donutGeo: DonutGeometry | null = null;
  let barHover = -1;
  let donutHover = -1;

  const paint = () => {
    const trendW = Math.max(240, trendCol.clientWidth || 320);
    barGeo = drawBarChart(
      trendCanvas,
      trendW,
      160,
      { labels: monthLabels, values: monthValues, color: "#9AD0B4", colors },
      barHover
    );

    if (hasTags) {
      const tagW = Math.max(180, Math.min(tagCol.clientWidth || 200, 240));
      donutGeo = drawDonut(tagCanvas, tagW, 160, tagEntries, colors, donutHover);
    }
  };

  paint();

  // ---- hover interaction: bar chart

  const localPos = (canvas: HTMLCanvasElement, e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  trendCanvas.addEventListener("mousemove", (e: MouseEvent) => {
    const { x } = localPos(trendCanvas, e);
    const idx = barHitTest(barGeo, x);
    if (idx !== barHover) {
      barHover = idx;
      paint();
    }
    if (idx === -1) {
      tooltip.hide();
      return;
    }
    tooltip.el.empty();
    tooltip.el.createDiv({
      cls: "ed-tooltip-date",
      text: formatMonth(months[idx], ctx),
    });
    tooltip.el.createDiv({
      cls: "ed-tooltip-count",
      text: `${monthValues[idx].toLocaleString()} ${t.wordsUnit}`,
    });
    tooltip.show();
    tooltip.move(e);
  });

  trendCanvas.addEventListener("mouseleave", () => {
    if (barHover !== -1) {
      barHover = -1;
      paint();
    }
    tooltip.hide();
  });

  // ---- hover interaction: donut

  if (hasTags) {
    tagCanvas.addEventListener("mousemove", (e: MouseEvent) => {
      const { x, y } = localPos(tagCanvas, e);
      const idx = donutHitTest(donutGeo, x, y);
      if (idx !== donutHover) {
        donutHover = idx;
        paint();
      }
      if (idx === -1) {
        tooltip.hide();
        return;
      }
      const entry = tagEntries[idx];
      tooltip.el.empty();
      const head = tooltip.el.createDiv({ cls: "ed-tooltip-date" });
      const swatch = head.createSpan({ cls: "ed-tooltip-swatch" });
      swatch.style.background = entry.color;
      head.createSpan({ text: entry.label });
      const pct = tagTotal > 0 ? Math.round((entry.value / tagTotal) * 100) : 0;
      tooltip.el.createDiv({
        cls: "ed-tooltip-count",
        text: `${entry.value} ${t.notesUnit} · ${pct}%`,
      });
      tooltip.show();
      tooltip.move(e);
    });

    tagCanvas.addEventListener("mouseleave", () => {
      if (donutHover !== -1) {
        donutHover = -1;
        paint();
      }
      tooltip.hide();
    });
  }

  // Redraw on resize so the canvases stay crisp. Painting resizes the canvases,
  // which would re-trigger the observer, so coalesce into an animation frame and
  // skip repaints where the measured width did not actually change.
  let lastWidth = -1;
  let frame = 0;
  const ro = new ResizeObserver(() => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      const w = row.clientWidth;
      if (w === lastWidth) return;
      lastWidth = w;
      paint();
    });
  });
  ro.observe(row);
  ctx.onCleanup(() => {
    if (frame) window.cancelAnimationFrame(frame);
    ro.disconnect();
  });
}

function formatMonth(key: string, ctx: Ctx): string {
  const year = parseInt(key.slice(0, 4), 10);
  const month = parseInt(key.slice(5, 7), 10);
  return ctx.t.formatMonthTitle(year, month);
}
