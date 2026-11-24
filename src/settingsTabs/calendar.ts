import { Setting } from "obsidian";
import type { DashboardSettingTab } from "../settings";

export function renderCalendarSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "日历导入（.ics）" : "Calendar import (.ics)").setHeading();
  new Setting(containerEl)
    .setName(cn ? "导入 .ics 文件" : "Import an .ics file")
    .setDesc(
      cn
        ? "把日历里的事件导入为日程。已过去的事件跳过；重复事件只取第一次；按下面的关键词过滤"
        : "Imports calendar events as deadlines. Past events are skipped, recurring ones taken once, titles filtered by the keywords below"
    )
    .addButton((b) =>
      b.setButtonText(cn ? "选择文件" : "Choose file").onClick(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".ics,text/calendar";
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          await tab.plugin.importIcsText(await f.text());
        };
        input.click();
      })
    );
  new Setting(containerEl)
    .setName(cn ? "订阅地址" : "Subscription URL")
    .setDesc(
      cn
        ? "https:// 或 webcal:// 地址（如 TUMonline 的日历导出链接）。启动时每天自动同步一次，也可以用命令“Sync calendar subscription”手动同步"
        : "An https:// or webcal:// link (e.g. the TUMonline calendar export). Synced once a day at startup, or on demand via the “Sync calendar subscription” command"
    )
    .addText((tx) => {
      tx.setPlaceholder("https://…/calendar.ics");
      tx.setValue(tab.plugin.settings.icsUrl).onChange(async (v) => {
        tab.plugin.settings.icsUrl = v.trim();
        tab.plugin.settings.icsLastSync = null;
        await tab.plugin.saveSettings();
      });
      tx.inputEl.style.width = "280px";
    })
    .addButton((b) =>
      b.setButtonText(cn ? "立即同步" : "Sync now").onClick(() => void tab.plugin.syncIcs(true))
    );
  new Setting(containerEl)
    .setName(cn ? "标题关键词" : "Title keywords")
    .setDesc(
      cn
        ? "逗号分隔，标题含任一关键词的事件才导入；留空导入全部（课表会把每节课都变成日程，不建议）"
        : "Comma-separated; only events whose title contains one are imported. Empty imports everything (a timetable would turn every lecture into a deadline)"
    )
    .addText((tx) => {
      tx.setValue(tab.plugin.settings.icsKeywords).onChange(async (v) => {
        tab.plugin.settings.icsKeywords = v;
        await tab.plugin.saveSettings();
      });
      tx.inputEl.style.width = "280px";
    });
  new Setting(containerEl)
    .setName(cn ? "启动时自动同步" : "Sync at startup")
    .setDesc(
      tab.plugin.settings.icsLastSync
        ? (cn ? `上次同步：${tab.plugin.settings.icsLastSync}` : `Last synced ${tab.plugin.settings.icsLastSync}`)
        : ""
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.icsSyncOnStartup).onChange(async (v) => {
        tab.plugin.settings.icsSyncOnStartup = v;
        await tab.plugin.saveSettings();
      })
    );
}
