import { Notice, setIcon } from "obsidian";
import { TaskBuckets } from "../types";
import { Ctx, card } from "../ui";
import { daysBetween, startOfDay, toKey } from "../dates";
import { urgencyOf } from "./deadlines";

/**
 * The "home page" header of the Overview: banner, avatar + motto, a status
 * line with the everyday actions, grouped shortcut panels, and four KPI
 * tiles — the shape of a start page rather than a wall of modules. The
 * modules themselves follow beneath it in the ordinary stacked rows.
 */
export interface HomeData {
  buckets: TaskBuckets;
  counts: { today: number; week: number; month: number };
  /** A soft gradient band, the bundled painting, or a resolved CSS url(). */
  banner: { kind: "gradient" } | { kind: "bundled" } | { kind: "image"; url: string };
  /** Resolved image url, or null to show the emoji / initial instead. */
  avatarUrl: string | null;
}

function runCommand(ctx: Ctx, id: string) {
  const commands = (ctx.app as unknown as {
    commands?: { executeCommandById?: (id: string) => boolean };
  }).commands;
  commands?.executeCommandById?.(`elegant-dashboard:${id}`);
}

/**
 * A recognisable mark for a bookmark, from its host — always a Lucide line
 * icon, so the tiles read as one set of line drawings (an `emoji` is still
 * allowed in the table but unused by default). Unknown hosts get a globe;
 * vault paths a note icon. A label that starts with an emoji wins over all
 * of this — that is the user asking for their own mark.
 */
export function linkMark(url: string): { icon?: string; emoji?: string } {
  const u = url.trim().toLowerCase();
  if (!/^(https?:|obsidian:|mailto:)/.test(u)) return { icon: "file-text" };
  if (u.startsWith("obsidian:")) return { icon: "box" };
  if (u.startsWith("mailto:")) return { icon: "mail" };
  const host = (() => {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  // Brand icons come and go between Lucide versions (youtube, twitter,
  // linkedin… were dropped), so each entry lists fallbacks: the first name
  // this Obsidian build actually has is used (see setIconOr).
  const table: Array<[RegExp, { icon?: string; emoji?: string }]> = [
    [/(^|\.)github\.com$/, { icon: "github|code-2|code" }],
    [/(^|\.)gitlab\.com$/, { icon: "gitlab|git-branch" }],
    [/(^|\.)huggingface\.co$/, { icon: "smile|bot" }],
    [/(^|\.)mail\.google\.com$|(^|\.)gmail\.com$/, { icon: "ed-gmail|mail" }],
    [/(^|\.)google\.com$/, { icon: "search" }],
    [/(^|\.)scholar\.google\./, { icon: "graduation-cap|book" }],
    [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, { icon: "youtube|play-circle|circle-play|play" }],
    [/(^|\.)(twitter|x)\.com$/, { icon: "twitter|at-sign" }],
    [/(^|\.)linkedin\.com$/, { icon: "linkedin|briefcase" }],
    [/(^|\.)arxiv\.org$/, { icon: "scroll-text|scroll|file-text" }],
    [/(^|\.)overleaf\.com$/, { icon: "file-text" }],
    [/(^|\.)notion\.so$/, { icon: "notebook|book" }],
    [/(^|\.)slack\.com$/, { icon: "slack|hash" }],
    [/(^|\.)discord\.com$/, { icon: "message-circle" }],
    [/(^|\.)openai\.com$|(^|\.)chatgpt\.com$/, { icon: "sparkles|bot" }],
    [/(^|\.)claude\.ai$|(^|\.)anthropic\.com$/, { icon: "sparkles|bot" }],
    [/(^|\.)kaggle\.com$/, { icon: "bar-chart-3|bar-chart" }],
    // Before the generic moodle rule: moodle.tum.de gets the TUM mark.
    [/(^|\.)tum\.de$/, { icon: "ed-tum|school|graduation-cap" }],
    [/(^|\.)moodle\./, { icon: "book-open|book" }],
    [/(^|\.)zoom\.us$/, { icon: "video" }],
    [/(^|\.)figma\.com$/, { icon: "figma|pen-tool" }],
    [/(^|\.)reddit\.com$/, { icon: "messages-square|message-square" }],
    [/(^|\.)bilibili\.com$/, { icon: "tv|monitor" }],
    [/(^|\.)zhihu\.com$/, { icon: "help-circle|circle-help" }],
    [/(^|\.)wechat\.com$|(^|\.)weixin\.qq\.com$/, { icon: "message-square" }],
  ];
  for (const [re, mark] of table) if (re.test(host)) return mark;
  return { icon: "globe" };
}

/**
 * `setIcon` with fallbacks: `names` is "a|b|c"; the first icon this build
 * can render is used, the last one is forced even if unknown. Returns true
 * when something was drawn.
 */
export function setIconOr(el: HTMLElement, names: string): boolean {
  const list = names.split("|").map((n) => n.trim()).filter(Boolean);
  for (const name of list) {
    el.empty();
    setIcon(el, name);
    if (el.querySelector("svg")) return true;
  }
  el.empty();
  if (list.length > 0) setIcon(el, "globe");
  return !!el.querySelector("svg");
}

/** Web and obsidian:// URLs go to the system handler; anything else is a vault path. */
export function openLink(ctx: Ctx, url: string) {
  const u = url.trim();
  if (!u) return;
  if (/^(https?:|obsidian:|mailto:)/i.test(u)) {
    window.open(u);
    return;
  }
  void ctx.app.workspace.openLinkText(u, "", "tab");
}

function greeting(t: Ctx["t"]): string {
  const h = new Date().getHours();
  if (h < 5) return t.homeGreetingNight;
  if (h < 11) return t.homeGreetingMorning;
  if (h < 14) return t.homeGreetingNoon;
  if (h < 18) return t.homeGreetingAfternoon;
  return t.homeGreetingEvening;
}

/**
 * Fills the top of the sheet (`root`, a `.ed-home` the view created so the
 * modules can follow inside the same sheet). `renderNav` draws the page
 * switcher in its slot under the identity row — on this layout the navbar
 * lives in the sheet rather than floating above it.
 */
export function renderHomeHeader(
  root: HTMLElement,
  ctx: Ctx,
  data: HomeData,
  renderNav?: (parent: HTMLElement) => void
) {
  const { t, settings } = ctx;

  // ---- banner + identity
  const banner = root.createDiv({ cls: "ed-home-banner" });
  if (data.banner.kind === "image") banner.style.backgroundImage = data.banner.url;
  else banner.addClass(data.banner.kind === "bundled" ? "is-bundled" : "is-gradient");

  const identity = root.createDiv({ cls: "ed-home-identity" });
  const avatar = identity.createDiv({ cls: "ed-home-avatar" });
  if (data.avatarUrl) {
    avatar.createEl("img", { attr: { src: data.avatarUrl, alt: "" } });
  } else {
    avatar.createSpan({ text: settings.homeAvatar.trim() || "🌿" });
  }
  const words = identity.createDiv({ cls: "ed-home-words" });
  words.createDiv({ cls: "ed-home-motto", text: settings.homeMotto.trim() || t.homeMottoDefault });
  const now = new Date();
  const subLine = (d: Date) =>
    `${greeting(t)} · ${t.formatDayTitle(d.getMonth() + 1, d.getDate())} ${t.weekdayFull[(d.getDay() + 6) % 7]}`;
  const sub = words.createDiv({ cls: "ed-home-sub", text: subLine(now) });
  // Keep the greeting honest while the tab stays open: re-check once a
  // minute; a new greeting just rewrites the line, a new *day* re-renders
  // the whole page so the tiles, agenda and countdowns move on too.
  const renderedDay = toKey(now);
  const tick = window.setInterval(() => {
    const d = new Date();
    if (toKey(d) !== renderedDay) {
      ctx.refresh();
      return;
    }
    const next = subLine(d);
    if (sub.getText() !== next) sub.setText(next);
  }, 60_000);
  ctx.onCleanup(() => window.clearInterval(tick));

  // ---- status line: where the data lives + the everyday actions
  const status = root.createDiv({ cls: "ed-home-status" });
  const chip = status.createDiv({ cls: "ed-home-chip" });
  chip.createSpan({ cls: "ed-home-dot" });
  chip.createSpan({ text: t.homeLocalData });
  status.createSpan({
    cls: "ed-home-status-note",
    text: t.homeCounts(settings.storedTasks.filter((x) => !x.done).length, settings.deadlines.filter((d) => !d.done).length),
  });
  const actions = status.createDiv({ cls: "ed-home-actions" });
  // Labels come from the shared strings, some of which carry their own
  // glyph ("⏸ Pause"); here the Lucide icon is the glyph, so strip those.
  const plain = (label: string) => label.replace(/^[^\p{L}\p{N}]+\s*/u, "");
  const action = (icon: string, label: string, onClick: () => void) => {
    const b = actions.createEl("button", { cls: "ed-home-action" });
    const ic = b.createSpan({ cls: "ed-home-action-ico" });
    setIcon(ic, icon);
    const tx = b.createSpan({ text: plain(label) });
    b.onclick = onClick;
    return { b, ic, tx };
  };
  const refresh = action("refresh-cw", t.refresh, () => {
    ctx.data.invalidate();
    refresh.b.addClass("is-busy");
    new Notice(t.homeRefreshed, 1500);
    ctx.refresh();
  });
  action("plus", t.homeNewTask, () => runCommand(ctx, "quick-add-task"));
  action("calendar-plus", t.homeNewDeadline, () => runCommand(ctx, "quick-add-deadline"));
  // The timer button mirrors the engine live: Start ⇄ Pause as it runs.
  const timer = action("play", t.homeStartFocus, () => runCommand(ctx, "toggle-focus-timer"));
  const paintTimer = () => {
    timer.ic.empty();
    setIcon(timer.ic, ctx.focus.running ? "pause" : "play");
    timer.tx.setText(plain(ctx.focus.running ? t.pause : t.homeStartFocus));
    timer.b.toggleClass("is-active", ctx.focus.running);
  };
  paintTimer();
  ctx.onCleanup(ctx.focus.onChange(paintTimer));

  // ---- quick actions (the page links live in the navbar; no second copy here)
  const panels = root.createDiv({ cls: "ed-home-panels" });
  const panel = (title: string) => {
    const p = panels.createDiv({ cls: "ed-home-panel" });
    p.createDiv({ cls: "ed-home-panel-title", text: title });
    return p.createDiv({ cls: "ed-home-panel-body" });
  };
  const tools = panel(t.homeTools);
  // The page switcher *is* the quick-actions row: the pages first, then the
  // few shortcuts that aren't pages (sync, backup, settings), one flowing
  // row of identical buttons, language toggle at the end.
  if (renderNav) {
    renderNav(tools.createDiv({ cls: "ed-home-nav" }));
    // Pages on the first line, the other shortcuts on the next.
    tools.createDiv({ cls: "ed-home-panel-break" });
  }
  const toolBtn = (label: string, onClick: () => void) => {
    const b = tools.createEl("button", { cls: "ed-home-shortcut", text: label });
    b.onclick = onClick;
  };
  if (settings.icsUrl.trim()) toolBtn(`📅 ${t.homeSyncCalendar}`, () => runCommand(ctx, "sync-ics"));
  toolBtn(`🔗 ${t.homeWebLinks}`, () => ctx.navigate?.("links"));
  toolBtn(`💾 ${t.homeBackupNow}`, () => runCommand(ctx, "export-backup"));
  toolBtn(`⚙️ ${t.homeSettings}`, () => {
    const s = (ctx.app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } }).setting;
    s?.open();
    s?.openTabById("elegant-dashboard");
  });

  // ---- KPI tiles
  const kpis = root.createDiv({ cls: "ed-home-kpis" });
  const tile = (
    title: string,
    icon: string,
    big: string,
    bigUnit: string,
    sub: string,
    ratio: number,
    color: string
  ) => {
    const el = card(kpis);
    el.addClass("ed-home-kpi");
    const head = el.createDiv({ cls: "ed-home-kpi-head" });
    head.createSpan({ cls: "ed-home-kpi-title", text: title });
    const badge = head.createSpan({ cls: "ed-home-kpi-icon" });
    setIcon(badge, icon);
    badge.style.setProperty("--ed-kpi", color);
    const num = el.createDiv({ cls: "ed-home-kpi-big" });
    num.createSpan({ text: big });
    num.createSpan({ cls: "ed-home-kpi-unit", text: bigUnit });
    el.createDiv({ cls: "ed-home-kpi-sub", text: sub });
    const bar = el.createDiv({ cls: "ed-home-kpi-bar" });
    const fill = bar.createDiv({ cls: "ed-home-kpi-fill" });
    fill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    fill.style.background = color;
  };

  const today = startOfDay(now);
  const todayKey = toKey(today);

  // Tasks: completed today against the daily target; what's still open.
  const overdueTasks = data.buckets.today.filter((x) => x.dueDate !== null && x.dueDate < todayKey).length;
  tile(
    t.homeKpiTasks,
    "check-circle-2",
    `${data.counts.today}`,
    `/${settings.taskTargetToday}`,
    t.homeKpiTasksSub(data.buckets.today.length, overdueTasks),
    settings.taskTargetToday > 0 ? data.counts.today / settings.taskTargetToday : 0,
    "#6B9E8A"
  );

  // Deadlines: the nearest one, and how many are pending / overdue.
  const open = settings.deadlines
    .filter((d) => !d.done)
    .map((d) => ({ d, days: daysBetween(today, new Date(d.date + "T00:00:00")) }));
  const next = open.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days)[0];
  const overdueDl = open.filter((x) => x.days < 0).length;
  const urgencyColor: Record<string, string> = {
    overdue: "#E88E8E", today: "#E88E8E", soon: "#F0A868", near: "#F3D98C", far: "#8FB8D9",
  };
  tile(
    t.homeKpiDeadlines,
    "hourglass",
    next ? `${next.days}` : "—",
    next ? ` ${t.daysUnit}` : "",
    next ? t.homeKpiDeadlinesSub(next.d.title, open.length, overdueDl) : t.noDeadlines,
    next ? 1 - Math.min(next.days, 30) / 30 : 0,
    next ? urgencyColor[urgencyOf(next.days)] : "#8FB8D9"
  );

  // Focus: today's minutes against a soft goal of four default sessions.
  const focusToday = settings.focusLog[todayKey] || 0;
  const monthPrefix = todayKey.slice(0, 7);
  const focusMonth = Object.entries(settings.focusLog)
    .filter(([k]) => k.startsWith(monthPrefix))
    .reduce((s, [, v]) => s + v, 0);
  const goal = Math.max(30, settings.focusDefaultMinutes * 4);
  tile(
    t.homeKpiFocus,
    "timer",
    `${focusToday}`,
    ` ${t.minuteUnit}`,
    t.homeKpiFocusSub(Math.round(focusMonth / 60), goal),
    goal > 0 ? focusToday / goal : 0,
    "#C8AADC"
  );

  // Habits: checked in today.
  const habitsDone = settings.habits.filter((h) => settings.habitLog[h.id]?.[todayKey]).length;
  tile(
    t.homeKpiHabits,
    "flame",
    `${habitsDone}`,
    `/${settings.habits.length}`,
    settings.habits.length === 0
      ? t.noHabits
      : t.homeKpiHabitsSub(settings.habits.length - habitsDone),
    settings.habits.length > 0 ? habitsDone / settings.habits.length : 0,
    "#F0A868"
  );
}
