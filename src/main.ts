import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, DashboardSettings, DeadlineItem, HabitItem } from "./types";
import { I18N, Strings } from "./i18n";
import { DataService } from "./data";
import { FocusEngine } from "./focus";
import { AlarmEngine } from "./alarm";
import { DashboardSettingTab } from "./settings";
import { DashboardView, VIEW_TYPE_DASHBOARD } from "./view";

export default class DashboardPlugin extends Plugin {
  settings!: DashboardSettings;
  data!: DataService;
  focus!: FocusEngine;
  alarms!: AlarmEngine;

  async onload() {
    await this.loadSettings();

    this.data = new DataService(this.app, this.settings);
    this.focus = new FocusEngine(
      this.settings,
      () => this.saveSettings(),
      () => this.strings()
    );
    this.alarms = new AlarmEngine(
      this.settings,
      () => this.saveSettings(),
      () => this.strings()
    );
    // Runs off the plugin, not the view, so alarms fire with the tab closed.
    this.alarms.load();

    this.registerView(
      VIEW_TYPE_DASHBOARD,
      (leaf: WorkspaceLeaf) => new DashboardView(leaf, this)
    );

    this.addRibbonIcon("layout-dashboard", this.strings().dashboard, () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-dashboard",
      name: "Open dashboard",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "refresh-dashboard",
      name: "Refresh dashboard",
      callback: () => {
        this.data.invalidate();
        this.refreshViews();
      },
    });

    this.addCommand({
      id: "toggle-focus-timer",
      name: "Start / pause focus timer",
      callback: () => {
        if (this.focus.running) void this.focus.pause();
        else this.focus.start();
      },
    });

    this.addCommand({
      id: "stop-alarm",
      name: "Stop ringing alarm",
      checkCallback: (checking: boolean) => {
        if (!this.alarms.ringing) return false;
        if (!checking) this.alarms.dismiss();
        return true;
      },
    });

    this.addSettingTab(new DashboardSettingTab(this.app, this));

    // Waits for the workspace's own restored layout rather than firing
    // during onload, so this doesn't race Obsidian re-opening whatever tabs
    // were open at quit, or spawn a second dashboard next to one the saved
    // layout already had open.
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) void this.activateView();
    });

    // Keep the word-count cache honest when files change on disk.
    this.registerEvent(this.app.vault.on("modify", (f) => this.data.invalidate(f.path)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.data.invalidate(f.path)));
    this.registerEvent(
      this.app.vault.on("rename", (f, old) => {
        this.data.invalidate(old);
        this.data.invalidate(f.path);
      })
    );
  }

  onunload() {
    this.focus?.unload();
    this.alarms?.unload();
  }

  strings(): Strings {
    return I18N[this.settings.lang] || I18N.cn;
  }


  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
    await workspace.revealLeaf(leaf);
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)) {
      const view = leaf.view;
      if (view instanceof DashboardView) void view.render();
    }
  }

  /**
   * The defensive merge shared by a normal startup load and a user-triggered
   * import: fills in defaults for anything missing (an older backup, a
   * partially-typed hand edit) rather than letting a missing field crash the
   * plugin, the way a bare `...raw` spread would.
   */
  private mergeSettings(raw: Partial<DashboardSettings> | null | undefined): DashboardSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...(raw || {}),
      modules: { ...DEFAULT_SETTINGS.modules, ...(raw?.modules || {}) },
      focusLog: { ...(raw?.focusLog || {}) },
      // Cloned, so an install with no saved alarms does not mutate the defaults.
      alarms: (raw?.alarms || []).map((a) => ({ ...a, days: [...(a.days || [])] })),
      // `remindDaysBefore`/`reminded` postdate the first Deadlines release;
      // spreading `d` last keeps real values while filling the gap for older
      // backups and pre-upgrade data. `d` is typed as partial here (rather
      // than trusting the full DeadlineItem type raw's shape claims) because
      // that older/hand-edited data is exactly what might be missing them.
      deadlines: ((raw?.deadlines as Partial<DeadlineItem>[] | undefined) || []).map(
        (d) => ({ remindDaysBefore: null, reminded: false, ...d }) as DeadlineItem
      ),
      // `targetPerWeek` postdates the first habits release; same gap-filling
      // reasoning as the deadline fields above.
      habits: ((raw?.habits as Partial<HabitItem>[] | undefined) || []).map(
        (h) => ({ targetPerWeek: null, ...h }) as HabitItem
      ),
      habitLog: { ...(raw?.habitLog || {}) },
    };
  }

  async loadSettings() {
    const raw = (await this.loadData()) as Partial<DashboardSettings> | null;
    this.settings = this.mergeSettings(raw);
  }

  /**
   * Replaces the plugin's entire data set with a previously exported backup.
   * Also used as the landing spot for anything that fails validation midway
   * — better to merge onto defaults than to leave `this.settings` half-old,
   * half-new.
   */
  async importSettings(raw: unknown): Promise<void> {
    if (!raw || typeof raw !== "object") {
      throw new Error("Not a valid Elegant Dashboard backup file");
    }
    this.settings = this.mergeSettings(raw as Partial<DashboardSettings>);
    await this.saveSettings();
    this.refreshViews();
  }

  exportSettingsJson(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.data?.updateSettings(this.settings);
    // Ordinary edits mutate `this.settings` in place, so these are no-ops in
    // the common case. They only matter the moment `this.settings` itself
    // gets *replaced* (currently only `importSettings`) — without this, the
    // background engines would keep ticking against the object from before
    // the swap, invisibly, until the next full plugin reload.
    this.focus?.updateSettings(this.settings);
    this.alarms?.updateSettings(this.settings);
  }
}
