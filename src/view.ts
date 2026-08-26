import { ItemView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type DashboardPlugin from "./main";
import { Ctx } from "./ui";
import { MODULE_ORDER, ModuleId } from "./types";
import { BUNDLED_BACKGROUND } from "./settings";
import { renderActivity } from "./components/activity";
import { renderFocusTimer } from "./components/focusTimer";
import { renderProjects } from "./components/projects";
import { renderTaskboard } from "./components/taskboard";
import { renderTaskDetails } from "./components/taskDetails";
import { renderRecent } from "./components/recent";
import { renderStats } from "./components/stats";
import { renderTrends } from "./components/trends";
import { renderPluginManager } from "./components/pluginManager";
import { renderFocusHistory } from "./components/focusHistory";

export const VIEW_TYPE_DASHBOARD = "elegant-dashboard-view";

type Page = "dashboard" | "projects" | "tasks" | "focus";

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
    } else if (this.page === "focus") {
      guard("focus", () => renderFocusTimer(grid, ctx, this.plugin.focus));
      guard("focusHistory", () => renderFocusHistory(grid, ctx, this.plugin.focus));
    } else {
      const renderers: Record<ModuleId, () => void> = {
        activity: () => renderActivity(grid, ctx, activity),
        focus: () => renderFocusTimer(grid, ctx, this.plugin.focus),
        // The overview is a report: editing lives on the Projects / Tasks pages.
        projects: () => renderProjects(grid, ctx, projects, { readOnly: true }),
        taskboard: () => renderTaskboard(grid, ctx, counts),
        taskDetails: () => renderTaskDetails(grid, ctx, buckets, { readOnly: true }),
        recent: () =>
          renderRecent(grid, ctx, this.plugin.data.getRecentFiles(settings.recentLimit)),
        stats: () => renderStats(grid, ctx, vaultStats),
        charts: () => renderTrends(grid, ctx, vaultStats, months),
        plugins: () => renderPluginManager(grid, ctx),
      };

      for (const id of MODULE_ORDER) {
        if (!settings.modules[id]) continue;
        guard(id, renderers[id]);
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
    bg.style.backgroundImage = `url("${this.resolveBackgroundUrl(raw)}")`;
    bg.style.opacity = String(this.plugin.settings.backgroundOpacity);
  }

  /**
   * Accepts either a remote URL or a vault-relative path. Local paths are turned
   * into `app://` resource URLs so the image works offline.
   */
  private resolveBackgroundUrl(raw: string): string {
    const escape = (s: string) => s.replace(/["\\]/g, "\\$&");
    if (/^(https?:|data:|app:|file:)/i.test(raw)) return escape(raw);

    // "@bundled" points at the image shipped with the plugin. Resolve it from
    // the manifest so a renamed install folder still finds it.
    const path =
      raw === BUNDLED_BACKGROUND
        ? `${this.plugin.manifest.dir ?? ""}/background.jpg`.replace(/^\/+/, "")
        : raw.replace(/^\/+/, "");

    try {
      return escape(this.app.vault.adapter.getResourcePath(path));
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
