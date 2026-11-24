import { App, PluginSettingTab } from "obsidian";
import type DashboardPlugin from "./main";
import { renderGeneralSettings } from "./settingsTabs/general";
import { renderTaskSettings } from "./settingsTabs/tasks";
import { renderCalendarSettings } from "./settingsTabs/calendar";
import { renderFocusClockSettings } from "./settingsTabs/focusClock";
import { renderLanguageSettings } from "./settingsTabs/language";
import { renderAppearanceSettings } from "./settingsTabs/appearance";
import { renderModuleSettings } from "./settingsTabs/modules";
import { ModuleId } from "./types";

/**
 * Sentinel for the bundled Monet *Water Lilies* (1906, Ryerson). Resolved at
 * render time against the plugin's real folder, so renaming the install
 * directory cannot break it.
 */
export const BUNDLED_BACKGROUND = "@bundled";
/** Sentinel for the built-in pastel gradient (no image at all). */
export const GRADIENT_BACKGROUND = "@gradient";

const MODULE_LABELS: Record<ModuleId, { cn: string; en: string }> = {
  clock: { cn: "翻页时钟与闹钟", en: "Flip clock & alarms" },
  today: { cn: "今日概览", en: "Today overview" },
  agenda: { cn: "未来 7 天", en: "Next 7 days" },
  links: { cn: "常用站点", en: "Sites" },
  custom: { cn: "自定义面板", en: "Custom panels" },
  deadlines: { cn: "日程倒计时", en: "Deadlines" },
  activity: { cn: "笔记活动热力图", en: "Note activity heatmap" },
  habits: { cn: "习惯追踪", en: "Habit tracker" },
  language: { cn: "语言学习", en: "Language learning" },
  focus: { cn: "专注计时器", en: "Focus timer" },
  projects: { cn: "项目概览", en: "Projects board" },
  taskboard: { cn: "任务统计", en: "Taskboard" },
  taskDetails: { cn: "任务详情", en: "Task details" },
  recent: { cn: "最近编辑", en: "Recently edited" },
  stats: { cn: "库统计", en: "Vault stats" },
  charts: { cn: "字数趋势 / 标签占比", en: "Word trend / tag ratio" },
};

export class DashboardSettingTab extends PluginSettingTab {
  constructor(app: App, readonly plugin: DashboardPlugin) {
    super(app, plugin);
  }

  label(key: ModuleId): string {
    return MODULE_LABELS[key][this.plugin.settings.lang];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const cn = this.plugin.settings.lang === "cn";

    renderGeneralSettings(this, containerEl, cn);
    renderTaskSettings(this, containerEl, cn);
    renderCalendarSettings(this, containerEl, cn);
    renderFocusClockSettings(this, containerEl, cn);
    renderLanguageSettings(this, containerEl, cn);
    renderAppearanceSettings(this, containerEl, cn);
    renderModuleSettings(this, containerEl, cn);
  }
}
