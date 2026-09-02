import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, DashboardSettings } from "./types";
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

  async loadSettings() {
    const raw = (await this.loadData()) as Partial<DashboardSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(raw || {}),
      modules: { ...DEFAULT_SETTINGS.modules, ...(raw?.modules || {}) },
      focusLog: { ...(raw?.focusLog || {}) },
      // Cloned, so an install with no saved alarms does not mutate the defaults.
      alarms: (raw?.alarms || []).map((a) => ({ ...a, days: [...(a.days || [])] })),
      deadlines: raw?.deadlines || [],
      habits: raw?.habits || [],
      habitLog: { ...(raw?.habitLog || {}) },
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.data?.updateSettings(this.settings);
  }
}
