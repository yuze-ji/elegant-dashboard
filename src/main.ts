import { Notice, Plugin, WorkspaceLeaf, addIcon } from "obsidian";
import {
  DEFAULT_SETTINGS,
  AlarmItem,
  DashboardSettings,
  DeadlineItem,
  HabitItem,
  StoredProject,
  StoredTask,
  VocabItem,
} from "./types";
import { toKey } from "./dates";
import { I18N, Strings } from "./i18n";
import { DataService } from "./data";
import { FocusEngine } from "./focus";
import { AlarmEngine } from "./alarm";
import { DashboardSettingTab } from "./settings";
import { BackupService } from "./backup";
import { VocabNotesService } from "./vocabNotes";
import { DashboardView, VIEW_TYPE_DASHBOARD } from "./view";
import { DeadlineQuickAddModal, TaskEditModal, VocabEditModal } from "./modals";
import { runLookup } from "./lookup";
import { openDeadlines } from "./components/taskDetails";
import { IcsImportResult, fetchIcs, importIcsEvents, parseIcs } from "./ics";
import {
  Store,
  addDeadline,
  addTask,
  addVocab,
  defaultVocabLang,
  listSections,
  purgeOldDoneTasks,
} from "./mutations";

export default class DashboardPlugin extends Plugin {
  settings!: DashboardSettings;
  data!: DataService;
  focus!: FocusEngine;
  alarms!: AlarmEngine;
  backup!: BackupService;
  vocabNotes!: VocabNotesService;

  async onload() {
    await this.loadSettings();

    // A capital G in the Google shape — an open ring with the bar running in
    // from the right to the centre — at Lucide stroke weight.
    addIcon(
      "ed-gmail",
      '<g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M74 26A34 34 0 1 0 84 50"/><path d="M50 50h34"/></g>'
    );

    // The official TUM wordmark (TUM_Web_Logo_blau, via Wikimedia Commons),
    // its single path scaled from the source viewBox (-16.014 -31 408.16
    // 212.467) into addIcon's 100×100 box and centred vertically; filled
    // with currentColor so it follows the theme like every other icon.
    addIcon(
      "ed-tum",
      '<g fill="currentColor" transform="translate(3.923 31.565) scale(0.245)">' +
        '<path d="m 140.54052,-31 v 173.32822 h 44.72985 V -31 H 392.146 V 181.46685 H 353.00738 ' +
        'V 8.138629 H 308.2775 V 181.46685 H 269.13887 V 8.138629 H 224.40902 V 181.46685 ' +
        'H 101.4019 V 8.138629 H 62.26327 V 181.46685 H 23.12462 V 8.138629 H -16.014 V -31 Z"/></g>'
    );

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

    this.backup = new BackupService(this.app, {
      enabled: () => this.settings.autoBackup,
      keep: () => this.settings.autoBackupKeep,
      json: () => this.exportSettingsJson(),
    });

    this.vocabNotes = new VocabNotesService(this.app, {
      settings: () => this.settings,
      strings: () => this.strings(),
    });

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

    // Quick-add from anywhere: the same modals the dashboard uses, with the
    // note currently being edited pre-filled as the linked note — filing
    // "revise chapter 3" from inside the chapter's note is the whole point.
    this.addCommand({
      id: "quick-add-task",
      name: "Quick add task",
      callback: () => this.quickAddTask(),
    });

    this.addCommand({
      id: "quick-add-deadline",
      name: "Quick add deadline",
      callback: () => this.quickAddDeadline(),
    });

    this.addCommand({
      id: "quick-add-vocab",
      name: "Quick add vocabulary word",
      callback: () => this.quickAddVocab(),
    });

    this.addCommand({
      id: "sync-vocab-notes",
      name: "Sync vocabulary notes (one note per language)",
      callback: () => void this.vocabNotes.sync(true),
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
      // After layout, not during onload: a startup snapshot is not urgent.
      void this.backup.ensureToday();
      // Snapshot first, purge second — the day's backup still has the rows.
      void this.purgeDone();
      // Catch up the vocabulary notes with whatever changed while closed.
      this.vocabNotes.schedule();
      void this.syncIcsIfDue();
    });
    // Long-running sessions cross midnight too; once an hour is plenty.
    this.registerInterval(
      window.setInterval(() => {
        void this.purgeDone();
        void this.syncIcsIfDue();
      }, 60 * 60_000)
    );

    this.addCommand({
      id: "export-backup",
      name: "Export data backup (JSON)",
      callback: () => {
        const json = this.exportSettingsJson();
        const blob = new Blob([json], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `elegant-dashboard-${toKey(new Date())}.json`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    });

    this.addCommand({
      id: "sync-ics",
      name: "Sync calendar subscription (.ics) into deadlines",
      checkCallback: (checking: boolean) => {
        if (!this.settings.icsUrl.trim()) return false;
        if (!checking) void this.syncIcs(true);
        return true;
      },
    });

    // Keep the word-count cache honest when files change on disk.
    this.registerEvent(this.app.vault.on("modify", (f) => this.data.invalidate(f.path)));
    this.registerEvent(this.app.vault.on("delete", (f) => this.data.invalidate(f.path)));
    this.registerEvent(
      this.app.vault.on("rename", (f, old) => {
        this.data.invalidate(old);
        this.data.invalidate(f.path);
        void this.relinkNotes(old, f.path);
      })
    );
  }

  /**
   * Linked notes are stored as plain paths, so Obsidian's own link-updating
   * on rename doesn't reach them — follow the move here instead. Folders
   * count too: renaming `Courses/` must carry `Courses/ML.md` along.
   */
  private async relinkNotes(oldPath: string, newPath: string) {
    const moved = (p: string | null): string | null => {
      if (!p) return p;
      if (p === oldPath) return newPath;
      if (p.startsWith(oldPath + "/")) return newPath + p.slice(oldPath.length);
      return p;
    };
    let changed = false;
    const lists: Array<Array<{ note: string | null }>> = [
      this.settings.storedTasks,
      this.settings.storedProjects,
      this.settings.deadlines,
    ];
    for (const list of lists) {
      for (const item of list) {
        const next = moved(item.note);
        if (next !== item.note) {
          item.note = next;
          changed = true;
        }
      }
    }
    if (changed) {
      await this.saveSettings();
      this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD).forEach((leaf) => {
        const view = leaf.view;
        if (view instanceof DashboardView) void view.render();
      });
    }
  }

  onunload() {
    this.focus?.unload();
    this.alarms?.unload();
  }

  /** Once a day, if a subscription URL is set and startup sync is on. */
  private async syncIcsIfDue() {
    const s = this.settings;
    if (!s.icsUrl.trim() || !s.icsSyncOnStartup) return;
    if (s.icsLastSync === toKey(new Date())) return;
    await this.syncIcs(false);
  }

  /** Pulls the subscription and merges it; `loud` reports the outcome in a Notice. */
  async syncIcs(loud: boolean): Promise<IcsImportResult | null> {
    const t = this.strings();
    try {
      const text = await fetchIcs(this.settings.icsUrl);
      const result = await importIcsEvents(this.store(), parseIcs(text), this.icsKeywordList());
      this.settings.icsLastSync = toKey(new Date());
      await this.saveSettings();
      if (loud || result.added > 0 || result.updated > 0) {
        new Notice(t.icsSyncResult(result.added, result.updated, result.skipped), 6000);
      }
      if (result.added > 0 || result.updated > 0) this.refreshViews();
      return result;
    } catch (err) {
      console.error("[elegant-dashboard] ics sync failed", err);
      if (loud) new Notice(t.icsSyncFailed(String(err)), 8000);
      return null;
    }
  }

  /** One-off import of a local .ics file's text. */
  async importIcsText(text: string): Promise<IcsImportResult> {
    const result = await importIcsEvents(this.store(), parseIcs(text), this.icsKeywordList());
    new Notice(this.strings().icsSyncResult(result.added, result.updated, result.skipped), 6000);
    if (result.added > 0 || result.updated > 0) this.refreshViews();
    return result;
  }

  icsKeywordList(): string[] {
    return this.settings.icsKeywords.split(/[,，;；]/).map((k) => k.trim()).filter(Boolean);
  }

  private async purgeDone() {
    const removed = await purgeOldDoneTasks(this.store());
    if (removed > 0) this.refreshViews();
  }

  private store(): Store {
    return { settings: this.settings, save: () => this.saveSettings() };
  }

  /** Path of the markdown note in the active editor, if any. */
  private activeNotePath(): string | null {
    const f = this.app.workspace.getActiveFile();
    return f && f.extension === "md" ? f.path : null;
  }

  private quickAddTask() {
    const store = this.store();
    const sections = listSections(store);
    const todayish = sections.find((s) => /今日|今天|today/i.test(s));
    new TaskEditModal(this.app, this.settings.lang, {
      title: { cn: "快速添加任务", en: "Quick add task" },
      initial: {
        text: "",
        priority: "normal",
        pinned: false,
        dueDate: null,
        note: this.activeNotePath(),
        repeat: "none",
        repeatDays: [],
        notes: "",
        deadlineId: null,
      },
      sections: sections.length > 0 ? sections : undefined,
      initialSection: todayish ?? sections[0] ?? "",
      deadlines: openDeadlines({ settings: this.settings } as Parameters<typeof openDeadlines>[0]),
      onSubmit: async (draft, section) => {
        if (await addTask(store, section, draft)) {
          new Notice(this.strings().quickAddedTask(draft.text.trim()), 3000);
          this.refreshViews();
        }
      },
    }).open();
  }

  private quickAddVocab() {
    const store = this.store();
    const s = this.settings;
    new VocabEditModal(
      this.app,
      s.lang,
      {
        title: { cn: "新增单词", en: "New word" },
        languages: s.vocabLanguages,
        initial: { word: "", meaning: "", example: "", lang: defaultVocabLang(s) },
        lookup: (w, l) => runLookup({ t: this.strings(), settings: s }, w, l),
        onSubmit: async (draft) => {
          if (await addVocab(store, draft)) {
            new Notice(this.strings().vocabAdded(draft.word.trim()), 3000);
            this.refreshViews();
          } else {
            new Notice(this.strings().quickAddInvalid, 3000);
          }
        },
      }
    ).open();
  }

  private quickAddDeadline() {
    const store = this.store();
    new DeadlineQuickAddModal(
      this.app,
      this.settings.lang,
      { title: "", date: toKey(new Date()), time: null, note: this.activeNotePath() },
      async (draft) => {
        if (await addDeadline(store, draft.title, draft.date, draft.time, draft.note)) {
          new Notice(this.strings().quickAddedDeadline(draft.title.trim(), draft.date), 3000);
          this.refreshViews();
        } else {
          new Notice(this.strings().quickAddInvalid, 3000);
        }
      }
    ).open();
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
      focusTargets: Object.fromEntries(
        Object.entries(raw?.focusTargets || {}).map(([k, v]) => [k, { ...v, log: { ...v.log } }])
      ),
      focusTarget: raw?.focusTarget ?? null,
      // Cloned, so an install with no saved alarms does not mutate the defaults.
      alarms: (raw?.alarms || []).map((a) => ({
        ...a,
        repeat: (a as Partial<AlarmItem>).repeat ||
          ((a.days || []).length > 0 ? "weekly" : "daily"),
        date: (a as Partial<AlarmItem>).date || null,
        days: [...(a.days || [])],
      })),
      // `remindDaysBefore`/`reminded` postdate the first Deadlines release;
      // spreading `d` last keeps real values while filling the gap for older
      // backups and pre-upgrade data. `d` is typed as partial here (rather
      // than trusting the full DeadlineItem type raw's shape claims) because
      // that older/hand-edited data is exactly what might be missing them.
      deadlines: ((raw?.deadlines as Partial<DeadlineItem>[] | undefined) || []).map(
        (d) =>
          ({
            remindDaysBefore: null,
            remindMinutesBefore: null,
            reminded: false,
            time: null,
            done: false,
            note: null,
            icsUid: null,
            ...d,
          }) as DeadlineItem
      ),
      // `targetPerWeek` postdates the first habits release; same gap-filling
      // reasoning as the deadline fields above.
      habits: ((raw?.habits as Partial<HabitItem>[] | undefined) || []).map(
        (h) => ({ targetPerWeek: null, reminderTime: null, ...h }) as HabitItem
      ),
      habitLog: { ...(raw?.habitLog || {}) },
      habitReminderFiredById: { ...(raw?.habitReminderFiredById || {}) },
      // Vocabulary postdates 1.10; older data has none of these. Entries are
      // gap-filled like deadlines above so a hand-edited or partial backup
      // still loads, and an empty language list falls back to the defaults
      // rather than leaving the add form with nothing to pick.
      vocab: ((raw?.vocab as Partial<VocabItem>[] | undefined) || []).map(
        (v) =>
          ({
            example: "",
            lang: "",
            createdAt: toKey(new Date()),
            box: 0,
            due: toKey(new Date()),
            reviews: 0,
            lapses: 0,
            ...v,
          }) as VocabItem
      ),
      vocabLanguages:
        (raw?.vocabLanguages || []).length > 0
          ? [...(raw?.vocabLanguages as string[])]
          : [...DEFAULT_SETTINGS.vocabLanguages],
      vocabLog: Object.fromEntries(
        Object.entries(raw?.vocabLog || {}).map(([k, v]) => [k, { ...v }])
      ),
      scriptLog: Object.fromEntries(
        Object.entries(raw?.scriptLog || {}).map(([k, v]) => [k, { ...v }])
      ),
      icsDeletedUids: [...(raw?.icsDeletedUids || [])],
      homeLinks: (raw?.homeLinks || []).map((l) => ({ ...l })),
      customPanels: (raw?.customPanels || []).map((p) => ({
        ...p,
        items: (p.items || []).map((i) => ({ ...i, icon: i.icon ?? "" })),
      })),
      // `createdAt`/`dueDate` postdate the Gantt chart — a project from
      // before that has no real creation date on record, so it falls back to
      // "today" rather than crashing the Gantt's date-range math on
      // `undefined`. This guess is only persisted once something else saves
      // the settings; until then it recomputes (harmlessly) on every reload.
      storedProjects: ((raw?.storedProjects as Partial<StoredProject>[] | undefined) || []).map(
        (p) =>
          ({ createdAt: toKey(new Date()), dueDate: null, note: null, ...p }) as StoredProject
      ),
      // `note` / `repeat` postdate the first tasks release; same gap-filling.
      storedTasks: ((raw?.storedTasks as Partial<StoredTask>[] | undefined) || []).map(
        (s) =>
          ({
            note: null,
            repeat: "none",
            repeatDays: [],
            notes: "",
            deadlineId: null,
            ...s,
          }) as StoredTask
      ),
    };
  }

  async loadSettings() {
    const raw = (await this.loadData()) as Partial<DashboardSettings> | null;
    this.settings = this.mergeSettings(raw);
    // A legacy project's guessed `createdAt` (see mergeSettings) would
    // otherwise recompute to "today" on every single reload until something
    // else happens to save — persist the guess once, immediately, so it
    // stops moving.
    const needsBackfill = (raw?.storedProjects || []).some(
      (p) => !(p as Partial<StoredProject>).createdAt
    );
    if (needsBackfill) await this.saveSettings();
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
    // First save of the day leaves a snapshot; every other call returns at once.
    void this.backup?.ensureToday();
    // Debounced, and a no-op unless the deck itself changed.
    this.vocabNotes?.schedule();
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
