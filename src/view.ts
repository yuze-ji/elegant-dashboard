import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type DashboardPlugin from "./main";
import { Ctx } from "./ui";
import { COMPACT_MODULES, MODULE_ORDER, ModuleId, SIDEBAR_MODULES } from "./types";
import { BUNDLED_BACKGROUND } from "./settings";
import { renderActivity } from "./components/activity";
import { renderClock } from "./components/clock";
import { renderDeadlineCalendar, renderDeadlines } from "./components/deadlines";
import { renderHabits } from "./components/habits";
import { renderTodayOverview } from "./components/today";
import { renderFocusTimer } from "./components/focusTimer";
import { renderProjects } from "./components/projects";
import { renderTaskboard } from "./components/taskboard";
import { renderTaskDetails } from "./components/taskDetails";
import { renderRecent } from "./components/recent";
import { renderStats } from "./components/stats";
import { renderTrends } from "./components/trends";
import { renderFocusHistory } from "./components/focusHistory";

export const VIEW_TYPE_DASHBOARD = "elegant-dashboard-view";

type Page = "dashboard" | "projects" | "tasks" | "deadlines" | "focus";

export class DashboardView extends ItemView {
  private cleanups: Array<() => void> = [];
  private renderToken = 0;
  private pendingRefresh: number | null = null;
  /** Projects and Tasks are rendered in-plugin rather than opening the notes. */
  private page: Page = "dashboard";

  constructor(leaf: WorkspaceLeaf, private plugin: DashboardPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return this.plugin.strings().dashboard;
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen() {
    this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    await this.render();
  }

  async onClose() {
    this.runCleanups();
  }

  private runCleanups() {
    this.cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    this.cleanups = [];
  }

  /** Coalesces bursts of vault events into a single re-render. */
  scheduleRefresh() {
    if (this.pendingRefresh !== null) window.clearTimeout(this.pendingRefresh);
    this.pendingRefresh = window.setTimeout(() => {
      this.pendingRefresh = null;
      void this.render();
    }, 1200);
  }

  async render() {
    const token = ++this.renderToken;
    this.runCleanups();

    const container = this.containerEl.children[1] as HTMLElement;
    // Every mutation re-renders, so keep the reading position instead of
    // snapping back to the top each time a checkbox is ticked.
    const prevScroll =
      (container.querySelector(".ed-scroll-root") as HTMLElement | null)?.scrollTop ?? 0;
    container.empty();
    container.addClass("elegant-dashboard");

    const settings = this.plugin.settings;
    const t = this.plugin.strings();

    const ctx: Ctx = {
      app: this.app,
      data: this.plugin.data,
      t,
      settings,
      save: () => this.plugin.saveSettings(),
      refresh: () => void this.render(),
      onCleanup: (fn) => this.cleanups.push(fn),
    };

    container.style.setProperty("--ed-card-alpha", String(settings.cardOpacity));
    container.style.setProperty("--ed-glass-blur", `${settings.glassBlur}px`);
    container.toggleClass("is-glass", settings.liquidGlass);
    this.applyBackground(container);

    const scroll = container.createDiv({ cls: "ed-scroll-root" });
    this.renderNavbar(scroll, ctx);
    const grid = scroll.createDiv({ cls: "ed-modules" });

    const loading = grid.createDiv({ cls: "ed-loading", text: "…" });

    // Async data first, so a slow vault does not block the shell.
    const [tasks, vaultStats] = await Promise.all([
      this.plugin.data.getTasks(),
      this.plugin.data.getVaultStats(),
    ]);
    if (token !== this.renderToken) return; // superseded by a newer render
    loading.remove();

    const activity = this.plugin.data.getActivity();
    const projects = this.plugin.data.getProjects();
    const buckets = this.plugin.data.bucketTasks(tasks);
    const counts = this.plugin.data.countCompletions(tasks);
    const months = this.plugin.data.monthKeys();

    const guard = (label: string, fn: () => void) => {
      try {
        fn();
      } catch (err) {
        console.error(`[elegant-dashboard] "${label}" failed`, err);
        grid.createDiv({ cls: "ed-card ed-error", text: `⚠️ ${label}: ${String(err)}` });
      }
    };

    if (this.page === "projects") {
      guard("projects", () => renderProjects(grid, ctx, projects, { showDone: true }));
      guard("taskboard", () => renderTaskboard(grid, ctx, counts));
    } else if (this.page === "tasks") {
      guard("taskboard", () => renderTaskboard(grid, ctx, counts));
      guard("taskDetails", () => renderTaskDetails(grid, ctx, buckets, { full: true }));
    } else if (this.page === "deadlines") {
      guard("deadlines", () => renderDeadlineCalendar(grid, ctx));
    } else if (this.page === "focus") {
      guard("focus", () => renderFocusTimer(grid, ctx, this.plugin.focus));
      guard("focusHistory", () => renderFocusHistory(grid, ctx, this.plugin.focus));
    } else {
      // Each renderer takes its own parent now instead of being bound to
      // `grid` directly, so the loop below can hand it either `grid` (a
      // full-width row) or a shared compact-group container.
      const renderers: Record<ModuleId, (parent: HTMLElement) => void> = {
        clock: (p) => renderClock(p, ctx, this.plugin.alarms),
        today: (p) => renderTodayOverview(p, ctx, buckets),
        deadlines: (p) => renderDeadlines(p, ctx),
        activity: (p) => renderActivity(p, ctx, activity),
        habits: (p) => renderHabits(p, ctx),
        focus: (p) => renderFocusTimer(p, ctx, this.plugin.focus),
        // The overview is a report: editing lives on the Projects / Tasks pages.
        projects: (p) => renderProjects(p, ctx, projects, { readOnly: true }),
        taskboard: (p) => renderTaskboard(p, ctx, counts),
        taskDetails: (p) => renderTaskDetails(p, ctx, buckets, { readOnly: true }),
        recent: (p) =>
          renderRecent(p, ctx, this.plugin.data.getRecentFiles(settings.recentLimit)),
        stats: (p) => renderStats(p, ctx, vaultStats),
        charts: (p) => renderTrends(p, ctx, vaultStats, months),
      };

      // Consecutive enabled COMPACT_MODULES share one responsive grid row;
      // anything else (a heatmap, three columns of tasks, a chart with its
      // own internal columns) gets the full card width. Grouping by position
      // in MODULE_ORDER means toggling a module reshuffles its neighbours
      // automatically instead of needing hand-picked pairs.
      let pendingCompact: ModuleId[] = [];
      const flushCompact = () => {
        if (pendingCompact.length === 0) return;
        const row = grid.createDiv({ cls: "ed-compact-grid" });
        for (const id of pendingCompact) guard(id, () => renderers[id](row));
        pendingCompact = [];
      };

      // Recent and Stats are held back rather than flowing through the
      // compact grid: they land beside Charts instead, stacked in a narrow
      // column next to it (see SIDEBAR_MODULES) — two short cards read
      // better next to one tall one than under it, full-width and mostly
      // empty at the sides.
      let pendingSidebar: ModuleId[] = [];
      const renderSidebar = (parent: HTMLElement) => {
        const col = parent.createDiv({ cls: "ed-sidebar-col" });
        for (const id of pendingSidebar) guard(id, () => renderers[id](col));
        pendingSidebar = [];
      };

      for (const id of MODULE_ORDER) {
        if (!settings.modules[id]) continue;
        if (COMPACT_MODULES.includes(id)) {
          pendingCompact.push(id);
        } else if (SIDEBAR_MODULES.includes(id)) {
          pendingSidebar.push(id);
        } else if (id === "charts" && pendingSidebar.length > 0) {
          flushCompact();
          const row = grid.createDiv({ cls: "ed-charts-row" });
          // Sidebar is *appended* first — even though it *displays* second,
          // via CSS `order` — so its real height is already in the DOM
          // before Charts measures how tall it can draw itself. Charts'
          // canvas sizing reads its wrapper's clientHeight synchronously
          // during render, which forces a layout pass right then; if the
          // sidebar weren't there yet, that pass would size the canvas
          // against an empty sibling and undershoot.
          renderSidebar(row);
          const main = row.createDiv({ cls: "ed-charts-main" });
          guard(id, () => renderers[id](main));
        } else {
          flushCompact();
          guard(id, () => renderers[id](grid));
        }
      }
      flushCompact();
      // Charts was off, or never reached (both possible if a user disables
      // it but keeps Recent/Stats) — fall back to the ordinary compact row
      // rather than dropping them.
      if (pendingSidebar.length > 0) {
        const row = grid.createDiv({ cls: "ed-compact-grid" });
        for (const id of pendingSidebar) guard(id, () => renderers[id](row));
      }
    }

    if (prevScroll > 0) scroll.scrollTop = prevScroll;
  }

  private applyBackground(container: HTMLElement) {
    const raw = this.plugin.settings.backgroundImage.trim();
    container.querySelector(".ed-bg")?.remove();
    if (!raw) {
      container.removeClass("has-bg");
      return;
    }
    container.addClass("has-bg");
    const bg = container.createDiv({ cls: "ed-bg" });
    if (raw === BUNDLED_BACKGROUND) {
      // Baked into styles.css as a data URI instead of shipped as a loose
      // background.jpg: Obsidian's Community Plugins installer only ever
      // fetches main.js/manifest.json/styles.css from a release, so a
      // separate image asset would silently be missing for anyone who did
      // not install by cloning the repo.
      bg.addClass("ed-bg-bundled");
    } else {
      bg.style.backgroundImage = `url("${this.resolveBackgroundUrl(raw)}")`;
    }
    bg.style.opacity = String(this.plugin.settings.backgroundOpacity);
  }

  /**
   * Accepts either a remote URL or a vault-relative path. Local paths are turned
   * into `app://` resource URLs so the image works offline.
   */
  private resolveBackgroundUrl(raw: string): string {
    const escape = (s: string) => s.replace(/["\\]/g, "\\$&");
    if (/^(https?:|data:|app:|file:)/i.test(raw)) return escape(raw);
    try {
      return escape(this.app.vault.adapter.getResourcePath(raw.replace(/^\/+/, "")));
    } catch {
      return escape(raw);
    }
  }

  private renderNavbar(parent: HTMLElement, ctx: Ctx) {
    const { t, settings } = ctx;
    const nav = parent.createDiv({ cls: "ed-navbar" });

    // Page switcher — stays inside the plugin instead of opening the notes.
    const links = nav.createDiv({ cls: "ed-nav-links" });
    const mkPage = (page: Page, label: string) => {
      const b = links.createEl("button", { cls: "ed-nav-link", text: label });
      if (this.page === page) b.addClass("is-active");
      b.onclick = () => {
        if (this.page === page) return;
        this.page = page;
        void this.render();
      };
    };
    mkPage("dashboard", `🏠 ${t.overview}`);
    mkPage("projects", `📋 ${t.projects}`);
    mkPage("tasks", `✅ ${t.tasks}`);
    mkPage("deadlines", `⏳ ${t.deadlines}`);
    mkPage("focus", `⏱️ ${t.focus}`);

    const right = nav.createDiv({ cls: "ed-nav-right" });

    // No "open note" affordance: tasks and projects live in the plugin's own
    // data file, so there is no underlying markdown to jump to.

    const refreshBtn = right.createEl("button", { cls: "ed-icon-btn" });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.setAttr("aria-label", t.refresh);
    refreshBtn.onclick = () => {
      this.plugin.data.invalidate();
      void this.render();
    };

    const langWrap = right.createDiv({ cls: "ed-lang" });
    const mkLang = (code: "cn" | "en", label: string) => {
      const s = langWrap.createSpan({ cls: "ed-lang-opt", text: label });
      if (settings.lang === code) s.addClass("is-active");
      s.onclick = async () => {
        if (settings.lang === code) return;
        this.plugin.settings.lang = code;
        await this.plugin.saveSettings();
        void this.render();
      };
    };
    mkLang("cn", "中");
    langWrap.createSpan({ cls: "ed-lang-sep", text: "/" });
    mkLang("en", "En");
  }
}
