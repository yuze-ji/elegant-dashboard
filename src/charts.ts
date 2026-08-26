/** Dependency-free canvas chart helpers (replaces the Chart.js CDN usage). */

export interface ThemeColors {
  accent: string;
  text: string;
  muted: string;
  bgSecondary: string;
  border: string;
}

export function themeColors(): ThemeColors {
  const s = getComputedStyle(document.body);
  const pick = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    accent: pick("--interactive-accent", "#5B8DEF"),
    text: pick("--text-normal", "#222222"),
    muted: pick("--text-muted", "#8A9BA3"),
    bgSecondary: pick("--background-secondary", "#f2f3f5"),
    border: pick("--background-modifier-border", "#dcdde1"),
  };
}

/** Sizes the backing store for the current devicePixelRatio and returns a scaled context. */
export function prepare(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  return ctx;
}

/** Small progress ring used by the taskboard. */
export function drawRing(
  canvas: HTMLCanvasElement,
  size: number,
  percent: number,
  color: string,
  trackColor: string
) {
  const ctx = prepare(canvas, size, size);
  if (!ctx) return;
  const c = size / 2;
  const lw = Math.max(3, size * 0.18);
  const r = c - lw / 2;
  const p = Math.max(0, Math.min(1, percent));

  ctx.strokeStyle = trackColor;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();

  if (p > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
  }
}

/** The focus-timer dial. */
export function drawDial(
  canvas: HTMLCanvasElement,
  size: number,
  progress: number,
  timeText: string,
  subText: string,
  colors: ThemeColors
) {
  const ctx = prepare(canvas, size, size);
  if (!ctx) return;
  const c = size / 2;
  const radius = c - 6;
  const p = Math.max(0, Math.min(1, progress));

  ctx.fillStyle = colors.bgSecondary;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = withAlpha(colors.accent, 0.2);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c, c, radius - 2, 0, Math.PI * 2);
  ctx.stroke();

  if (p > 0) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c, c, radius - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colors.text;
  ctx.font = `bold ${Math.round(size * 0.17)}px var(--font-interface, sans-serif)`;
  ctx.fillText(timeText, c, c - (subText ? 6 : 0));

  if (subText) {
    ctx.fillStyle = colors.accent;
    ctx.font = `600 ${Math.round(size * 0.08)}px var(--font-interface, sans-serif)`;
    ctx.fillText(subText, c, c + Math.round(size * 0.14));
  }
}

export interface BarChartOptions {
  labels: string[];
  values: number[];
  color: string;
  colors: ThemeColors;
}

export interface BarGeometry {
  /** Full-height hit slots, so hovering the gap above a short bar still works. */
  slots: Array<{ left: number; right: number; index: number }>;
}

export function drawBarChart(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  opts: BarChartOptions,
  hoverIndex = -1
): BarGeometry | null {
  const ctx = prepare(canvas, width, height);
  if (!ctx) return null;
  const { labels, values, color, colors } = opts;
  const padLeft = 38;
  const padBottom = 20;
  const padTop = 8;
  const padRight = 6;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  if (plotW <= 0 || plotH <= 0) return null;

  const max = Math.max(1, ...values);
  const niceMax = niceCeil(max);

  // grid + y axis labels
  ctx.font = `9px var(--font-interface, sans-serif)`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (niceMax / ticks) * i;
    const y = padTop + plotH - (v / niceMax) * plotH;
    ctx.strokeStyle = withAlpha(colors.border, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, Math.round(y) + 0.5);
    ctx.lineTo(padLeft + plotW, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.fillText(shortNum(v), padLeft - 6, y);
  }

  const n = values.length;
  const slot = plotW / Math.max(1, n);
  const barW = Math.max(2, Math.min(slot * 0.62, 26));
  const radius = Math.min(4, barW / 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const slots: BarGeometry["slots"] = [];
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const h = (v / niceMax) * plotH;
    const slotLeft = padLeft + slot * i;
    const x = slotLeft + (slot - barW) / 2;
    const y = padTop + plotH - h;
    const isHover = i === hoverIndex;

    if (isHover) {
      // Faint column highlight, the way Chart.js marks the active category.
      ctx.fillStyle = withAlpha(colors.accent, 0.1);
      ctx.fillRect(slotLeft, padTop, slot, plotH);
    }

    ctx.fillStyle = isHover ? colors.accent : color;
    roundRect(ctx, x, y, barW, h, radius);
    ctx.fill();

    ctx.fillStyle = isHover ? colors.accent : colors.muted;
    ctx.font = `${isHover ? "600 " : ""}9px var(--font-interface, sans-serif)`;
    ctx.fillText(labels[i], slotLeft + slot / 2, padTop + plotH + 5);

    slots.push({ left: slotLeft, right: slotLeft + slot, index: i });
  }

  return { slots };
}

export function barHitTest(geo: BarGeometry | null, x: number): number {
  if (!geo) return -1;
  const hit = geo.slots.find((s) => x >= s.left && x < s.right);
  return hit ? hit.index : -1;
}

export interface LineChartOptions {
  labels: string[];
  values: number[];
  color: string;
  colors: ThemeColors;
  /** Formats the y-axis ticks; defaults to a compact number. */
  formatY?: (v: number) => string;
}

export interface LineGeometry {
  points: Array<{ x: number; y: number; index: number }>;
  plot: { left: number; top: number; width: number; height: number };
}

export function drawLineChart(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  opts: LineChartOptions,
  hoverIndex = -1
): LineGeometry | null {
  const ctx = prepare(canvas, width, height);
  if (!ctx) return null;
  const { labels, values, color, colors, formatY = shortNum } = opts;

  const padLeft = 42;
  const padBottom = 22;
  const padTop = 10;
  const padRight = 10;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  if (plotW <= 0 || plotH <= 0 || values.length === 0) return null;

  const niceMax = niceCeil(Math.max(1, ...values));

  // grid + y axis
  ctx.font = "9px var(--font-interface, sans-serif)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (niceMax / ticks) * i;
    const y = padTop + plotH - (v / niceMax) * plotH;
    ctx.strokeStyle = withAlpha(colors.border, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, Math.round(y) + 0.5);
    ctx.lineTo(padLeft + plotW, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.fillText(formatY(v), padLeft - 6, y);
  }

  // A single sample would divide by zero; pin it to the left edge instead.
  const stepX = values.length > 1 ? plotW / (values.length - 1) : 0;
  const points = values.map((v, i) => ({
    x: padLeft + stepX * i,
    y: padTop + plotH - (v / niceMax) * plotH,
    index: i,
  }));

  // area fill
  const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  gradient.addColorStop(0, withAlpha(color, 0.32));
  gradient.addColorStop(1, withAlpha(color, 0.02));
  ctx.beginPath();
  ctx.moveTo(points[0].x, padTop + plotH);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padTop + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // line
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  // Dots only when they will not crowd into a solid band.
  if (stepX >= 8) {
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  // hover guide
  if (hoverIndex >= 0 && hoverIndex < points.length) {
    const p = points[hoverIndex];
    ctx.strokeStyle = withAlpha(colors.accent, 0.45);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(p.x, padTop);
    ctx.lineTo(p.x, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  // x labels, thinned so they never overlap
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.muted;
  ctx.font = "9px var(--font-interface, sans-serif)";
  const minLabelPx = 34;
  const every = Math.max(1, Math.ceil(minLabelPx / Math.max(stepX, 1)));
  labels.forEach((label, i) => {
    if (i % every !== 0 && i !== labels.length - 1) return;
    ctx.fillText(label, points[i].x, padTop + plotH + 6);
  });

  return { points, plot: { left: padLeft, top: padTop, width: plotW, height: plotH } };
}

/** Nearest sample by horizontal distance, the way line charts usually snap. */
export function lineHitTest(geo: LineGeometry | null, x: number): number {
  if (!geo || geo.points.length === 0) return -1;
  if (x < geo.plot.left - 12 || x > geo.plot.left + geo.plot.width + 12) return -1;
  let best = -1;
  let bestDist = Infinity;
  for (const p of geo.points) {
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      bestDist = d;
      best = p.index;
    }
  }
  return best;
}

export interface DonutEntry {
  label: string;
  value: number;
  color: string;
}

export interface DonutGeometry {
  cx: number;
  cy: number;
  inner: number;
  outer: number;
  /** Slice angular bounds, measured clockwise from 12 o'clock. */
  slices: Array<{ from: number; to: number; index: number }>;
}

/** How far the hovered slice grows, in px. */
const DONUT_HOVER_GROW = 5;

export function drawDonut(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  entries: DonutEntry[],
  colors: ThemeColors,
  hoverIndex = -1
): DonutGeometry | null {
  const ctx = prepare(canvas, width, height);
  if (!ctx) return null;
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (total <= 0) return null;

  // Two legend columns instead of one, so the ring keeps most of the height
  // rather than being squeezed into whatever a 6-row legend leaves behind.
  const legendRows = Math.ceil(Math.min(entries.length, 6) / 2);
  const legendH = legendRows * 14 + 8;
  const chartH = Math.max(60, height - legendH);
  const cx = width / 2;
  const cy = chartH / 2 + 4;
  // Leave headroom so a hovered slice can grow without being clipped.
  const outer = Math.max(10, Math.min(cx, cy) - 6 - DONUT_HOVER_GROW);
  const inner = outer * 0.62;

  const slices: DonutGeometry["slices"] = [];
  let start = -Math.PI / 2;
  entries.forEach((e, i) => {
    const angle = (e.value / total) * Math.PI * 2;
    const r = i === hoverIndex ? outer + DONUT_HOVER_GROW : outer;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = e.color;
    ctx.fill();
    slices.push({ from: start + Math.PI / 2, to: start + angle + Math.PI / 2, index: i });
    start += angle;
  });

  // punch out the middle
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // legend, laid out in two columns
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const colW = width / 2;
  entries.slice(0, 6).forEach((e, i) => {
    const isHover = i === hoverIndex;
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const lx = col * colW + 8;
    const ly = chartH + 10 + rowIdx * 14;

    ctx.fillStyle = e.color;
    roundRect(ctx, lx, ly - 4, 8, 8, 2);
    ctx.fill();
    ctx.fillStyle = isHover ? colors.accent : colors.muted;
    ctx.font = `${isHover ? "600 " : ""}9px var(--font-interface, sans-serif)`;
    const pct = Math.round((e.value / total) * 100);
    ctx.fillText(truncate(e.label, 10) + ` ${pct}%`, lx + 12, ly);
  });

  return { cx, cy, inner, outer, slices };
}

export function donutHitTest(
  geo: DonutGeometry | null,
  x: number,
  y: number
): number {
  if (!geo) return -1;
  const dx = x - geo.cx;
  const dy = y - geo.cy;
  const r = Math.hypot(dx, dy);
  if (r < geo.inner || r > geo.outer + DONUT_HOVER_GROW) return -1;
  // Normalise to clockwise-from-12 so it matches how slices were recorded.
  let a = Math.atan2(dy, dx) + Math.PI / 2;
  if (a < 0) a += Math.PI * 2;
  const hit = geo.slices.find((s) => a >= s.from && a < s.to);
  return hit ? hit.index : -1;
}

// ------------------------------------------------------------------ helpers

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds up to a readable axis maximum without leaving huge empty headroom. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = NICE_STEPS.find((s) => norm <= s) ?? 10;
  return step * mag;
}

function shortNum(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(v));
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Accepts #rgb/#rrggbb/rgb()/hsl() and returns a translucent css color. */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    let hex = c.slice(1);
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgb = c.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((p) => p.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  const hsl = c.match(/^hsla?\(([^)]+)\)$/i);
  if (hsl) {
    const parts = hsl[1].split(",").map((p) => p.trim());
    return `hsla(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return c;
}
