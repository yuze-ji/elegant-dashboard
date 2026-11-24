import { Setting } from "obsidian";
import type { DashboardSettingTab } from "../settings";

export function renderLanguageSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "语言学习" : "Language learning").setHeading();

  new Setting(containerEl)
    .setName(cn ? "语言列表" : "Languages")
    .setDesc(
      cn
        ? "逗号分隔；添加单词时从这里选择，第一个为默认。删掉一种语言不会删除它的单词"
        : "Comma-separated; offered when adding a word, the first is the default. Removing a language keeps its words"
    )
    .addText((tx) => {
      tx.setValue(tab.plugin.settings.vocabLanguages.join(", ")).onChange(async (v) => {
        const list = v
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter((x, i, arr) => x && arr.indexOf(x) === i);
        if (list.length === 0) return;
        tab.plugin.settings.vocabLanguages = list;
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      });
      tx.inputEl.style.width = "260px";
    });

  new Setting(containerEl)
    .setName(cn ? "同步为笔记" : "Mirror to notes")
    .setDesc(
      cn
        ? "单词本按语言生成一篇笔记（表格），单词本变动时自动重写；笔记里的改动不会写回"
        : "One generated note (a table) per language, rewritten whenever the deck changes; edits in the notes do not flow back"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.vocabNotesEnabled).onChange(async (v) => {
        tab.plugin.settings.vocabNotesEnabled = v;
        await tab.plugin.saveSettings();
        if (v) void tab.plugin.vocabNotes.sync(true);
      })
    );

  new Setting(containerEl)
    .setName(cn ? "学习时自动开始番茄钟" : "Auto-start a pomodoro when studying")
    .setDesc(
      cn
        ? "开始复习单词或文字测验时，若计时器空闲且有习惯关联了该语言，就以该习惯为任务开始番茄钟"
        : "Starting a word review or script drill starts a pomodoro on the habit linked to that language, if the timer is idle"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.languageAutoFocus).onChange(async (v) => {
        tab.plugin.settings.languageAutoFocus = v;
        await tab.plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName(cn ? "词汇表文件夹" : "Vocabulary notes folder")
    .setDesc(cn ? "库内路径；不存在会自动创建" : "Vault path; created if missing")
    .addText((tx) => {
      tx.setValue(tab.plugin.settings.vocabNotesFolder).onChange(async (v) => {
        tab.plugin.settings.vocabNotesFolder = v.trim() || "Note/词汇表";
        await tab.plugin.saveSettings();
      });
      tx.inputEl.style.width = "220px";
    });

  new Setting(containerEl)
    .setName(cn ? "每日新词目标" : "New words per day")
    .setDesc(cn ? "0 = 不显示目标" : "0 = no goal shown")
    .addText((tx) => {
      tx.inputEl.type = "number";
      tx.inputEl.min = "0";
      tx.setValue(String(tab.plugin.settings.vocabNewPerDay)).onChange(async (v) => {
        const n = Math.max(0, Math.floor(Number(v) || 0));
        tab.plugin.settings.vocabNewPerDay = n;
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      });
    });

  new Setting(containerEl)
    .setName(cn ? "每日复习目标（张）" : "Cards per day")
    .setDesc(cn ? "0 = 不显示目标" : "0 = no goal shown")
    .addText((tx) => {
      tx.inputEl.type = "number";
      tx.inputEl.min = "0";
      tx.setValue(String(tab.plugin.settings.vocabReviewPerDay)).onChange(async (v) => {
        const n = Math.max(0, Math.floor(Number(v) || 0));
        tab.plugin.settings.vocabReviewPerDay = n;
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      });
    });
}
