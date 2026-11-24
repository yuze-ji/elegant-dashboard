import { Notice, Setting, moment } from "obsidian";
import { BackupService } from "../backup";
import { addSection, deleteSection, moveSection, renameSection } from "../mutations";
import type { DashboardSettingTab } from "../settings";

export function renderGeneralSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "常规" : "General").setHeading();

  new Setting(containerEl)
    .setName(cn ? "语言" : "Language")
    .addDropdown((d) =>
      d
        .addOption("cn", "中文")
        .addOption("en", "English")
        .setValue(tab.plugin.settings.lang)
        .onChange(async (v) => {
          tab.plugin.settings.lang = v === "en" ? "en" : "cn";
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
          tab.display();
        })
    );

  new Setting(containerEl)
    .setName(cn ? "启动时自动打开" : "Open on startup")
    .setDesc(
      cn
        ? "Obsidian 启动、恢复上次的标签页布局之后，自动打开仪表板"
        : "Opens the dashboard tab once Obsidian has restored the previous session's layout"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.openOnStartup).onChange(async (v) => {
        tab.plugin.settings.openOnStartup = v;
        await tab.plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName(cn ? "数据存储" : "Data storage")
    .setDesc(
      cn
        ? `任务与项目保存在插件的 data.json 中，不占用笔记文件。当前：${tab.plugin.settings.storedTasks.length} 个任务、${tab.plugin.settings.storedProjects.length} 个项目`
        : `Tasks and projects live in the plugin's data.json. Currently ${tab.plugin.settings.storedTasks.length} tasks and ${tab.plugin.settings.storedProjects.length} projects.`
    );

  new Setting(containerEl)
    .setName(cn ? "备份" : "Backup")
    .setDesc(
      cn
        ? "所有任务、项目、日程、习惯、闹钟都只存在这份本地数据里，没有其它历史记录——建议定期导出一份"
        : "Tasks, projects, deadlines, habits and alarms all live only in this local data — export a copy every so often"
    )
    .addButton((b) =>
      b.setButtonText(cn ? "导出" : "Export").onClick(() => exportBackup(tab, ))
    )
    .addButton((b) =>
      b.setButtonText(cn ? "导入" : "Import").onClick(() => importBackup(tab, ))
    );

  new Setting(containerEl)
    .setName(cn ? "自动备份" : "Automatic backups")
    .setDesc(
      cn
        ? `每天第一次保存时在 ${tab.plugin.backup.dir()}/ 留一份快照，超出份数自动删除最旧的`
        : `Snapshots data.json once a day into ${tab.plugin.backup.dir()}/, pruning the oldest past the count`
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.autoBackup).onChange(async (v) => {
        tab.plugin.settings.autoBackup = v;
        await tab.plugin.saveSettings();
      })
    )
    .addSlider((s) =>
      s
        .setLimits(1, 30, 1)
        .setValue(tab.plugin.settings.autoBackupKeep)
        .setDynamicTooltip()
        .onChange(async (v) => {
          tab.plugin.settings.autoBackupKeep = v;
          await tab.plugin.saveSettings();
          await tab.plugin.backup.prune();
        })
    );

  renderRestoreRow(tab, containerEl, cn);

  new Setting(containerEl).setName(cn ? "任务分区" : "Task sections").setHeading();
  renderSections(tab, containerEl, cn);
}

/**
 * The section list: rename in place, reorder with arrows, delete (tasks
 * fall back to the first section), add at the bottom. Names containing
 * 今日/今天/today are what the Today column keys on, so that's mentioned.
 */
export function renderSections(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  const store = { settings: tab.plugin.settings, save: () => tab.plugin.saveSettings() };
  const after = () => {
    tab.plugin.refreshViews();
    tab.display();
  };
  new Setting(containerEl).setDesc(
    cn
      ? "名字里含“今日/今天/today”的分区，其任务直接进入“今日”列；删除分区时，里面的任务移到第一个分区"
      : "Tasks in a section named with 今日/今天/today land in the Today column; deleting a section moves its tasks to the first one"
  );
  const sections = tab.plugin.settings.taskSections;
  sections.forEach((name, i) => {
    const row = new Setting(containerEl).setName("");
    row.addText((tx) => {
      tx.setValue(name);
      tx.inputEl.style.width = "220px";
      const commit = async () => {
        const v = tx.getValue().trim();
        if (!v || v === name) {
          tx.setValue(name);
          return;
        }
        if (await renameSection(store, name, v)) after();
        else {
          new Notice(cn ? "⚠️ 名称为空或已存在" : "⚠️ Empty or duplicate name");
          tx.setValue(name);
        }
      };
      tx.inputEl.addEventListener("blur", () => void commit());
      tx.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          tx.inputEl.blur();
        }
      });
    });
    row.addExtraButton((b) =>
      b
        .setIcon("chevron-up")
        .setTooltip(cn ? "上移" : "Move up")
        .setDisabled(i === 0)
        .onClick(async () => {
          if (await moveSection(store, name, -1)) after();
        })
    );
    row.addExtraButton((b) =>
      b
        .setIcon("chevron-down")
        .setTooltip(cn ? "下移" : "Move down")
        .setDisabled(i === sections.length - 1)
        .onClick(async () => {
          if (await moveSection(store, name, 1)) after();
        })
    );
    row.addExtraButton((b) =>
      b
        .setIcon("trash-2")
        .setTooltip(cn ? "删除分区" : "Delete section")
        .setDisabled(sections.length <= 1)
        .onClick(async () => {
          if (await deleteSection(store, name)) after();
        })
    );
  });
  new Setting(containerEl).addText((tx) => {
    tx.setPlaceholder(cn ? "新分区名，回车添加" : "New section, press Enter");
    tx.inputEl.style.width = "220px";
    tx.inputEl.addEventListener("keydown", async (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (await addSection(store, tx.getValue())) after();
      else new Notice(cn ? "⚠️ 名称为空或已存在" : "⚠️ Empty or duplicate name");
    });
  });
}

/**
 * Dropdown of on-disk snapshots + a two-click Restore. Listing is async,
 * so the row is drawn first and filled when the directory listing lands.
 */
export function renderRestoreRow(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  const row = new Setting(containerEl)
    .setName(cn ? "从快照恢复" : "Restore from snapshot")
    .setDesc(
      cn
        ? "恢复前会先把当前数据另存为“恢复前”快照，所以误操作可以再恢复回来"
        : "The current data is saved as a “before restore” snapshot first, so a wrong restore can itself be undone"
    );
  let selected = "";
  let armed = false;
  let disarm: number | null = null;
  void tab.plugin.backup.list().then((files) => {
    row.addDropdown((d) => {
      if (files.length === 0) {
        d.addOption("", cn ? "（还没有快照）" : "(no snapshots yet)");
        d.setDisabled(true);
        return;
      }
      for (const f of files) {
        d.addOption(f, BackupService.label(f, cn ? "恢复前" : "before restore"));
      }
      selected = files[0];
      d.setValue(selected).onChange((v) => (selected = v));
    });
    row.addButton((b) => {
      const idle = cn ? "恢复" : "Restore";
      b.setButtonText(idle).setDisabled(files.length === 0);
      b.onClick(async () => {
        if (!selected) return;
        if (!armed) {
          // First click arms, second confirms; it disarms itself after 5s.
          armed = true;
          b.setButtonText(cn ? "确认恢复？" : "Confirm restore?").setWarning();
          disarm = window.setTimeout(() => {
            armed = false;
            b.setButtonText(idle).removeCta();
            b.buttonEl.removeClass("mod-warning");
          }, 5000);
          return;
        }
        if (disarm !== null) window.clearTimeout(disarm);
        armed = false;
        try {
          await tab.plugin.backup.snapshotBeforeRestore();
          await tab.plugin.importSettings(await tab.plugin.backup.read(selected));
          new Notice(cn ? "✅ 已从快照恢复" : "✅ Restored from snapshot");
          tab.display();
        } catch (err) {
          tab.plugin.backup.notifyError(cn ? "恢复失败" : "Restore failed", err);
        }
      });
    });
  });
}

/**
 * Downloads the current settings as a JSON file via a Blob + synthetic
 * click — the standard browser download path, so this needs no Electron
 * or Obsidian-internal API and works the same on desktop and mobile.
 */
export function exportBackup(tab: DashboardSettingTab) {
  const cn = tab.plugin.settings.lang === "cn";
  const json = tab.plugin.exportSettingsJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elegant-dashboard-backup-${moment().format("YYYY-MM-DD")}.json`;
  a.click();
  URL.revokeObjectURL(url);
  new Notice(cn ? "已导出备份" : "Backup exported");
}

/** Opens a native file picker and replaces all plugin data with its contents. */
export function importBackup(tab: DashboardSettingTab) {
  const cn = tab.plugin.settings.lang === "cn";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      await tab.plugin.importSettings(raw);
      new Notice(cn ? "已导入备份" : "Backup imported");
      tab.display();
    } catch (err) {
      new Notice(cn ? `导入失败：${String(err)}` : `Import failed: ${String(err)}`);
    }
  };
  input.click();
}
