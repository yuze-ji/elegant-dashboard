import { Setting } from "obsidian";
import { numberSetting } from "./shared";
import type { DashboardSettingTab } from "../settings";

export function renderTaskSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "任务目标" : "Task targets").setHeading();


  numberSetting(tab, containerEl, 
    cn ? "今日目标" : "Daily target",
    cn ? "今日完成任务数目标" : "Tasks to complete today",
    () => tab.plugin.settings.taskTargetToday,
    (n) => (tab.plugin.settings.taskTargetToday = n),
    1,
    999
  );
  numberSetting(tab, containerEl, 
    cn ? "本周目标" : "Weekly target",
    "",
    () => tab.plugin.settings.taskTargetWeek,
    (n) => (tab.plugin.settings.taskTargetWeek = n),
    1,
    9999
  );
  numberSetting(tab, containerEl, 
    cn ? "本月目标" : "Monthly target",
    "",
    () => tab.plugin.settings.taskTargetMonth,
    (n) => (tab.plugin.settings.taskTargetMonth = n),
    1,
    99999
  );
  numberSetting(tab, containerEl, 
    cn ? "每列最多任务数" : "Tasks per column",
    "",
    () => tab.plugin.settings.taskLimit,
    (n) => (tab.plugin.settings.taskLimit = n),
    1,
    200
  );
  new Setting(containerEl).setName(cn ? "已完成任务" : "Completed tasks").setHeading();
  numberSetting(tab, containerEl, 
    cn ? "完成几天后从列表隐藏" : "Hide from Done after (days)",
    cn
      ? "到期后从“已完成”列移走，但仍计入今日/本周/本月统计，并可在任务页底部的折叠栏里找到。0 = 不隐藏"
      : "Leaves the Done column but still counts towards the targets, and stays reachable under a fold on the Tasks page. 0 = never",
    () => tab.plugin.settings.doneHideAfterDays,
    (n) => (tab.plugin.settings.doneHideAfterDays = n),
    0,
    365
  );
  numberSetting(tab, containerEl, 
    cn ? "完成几天后彻底删除" : "Delete after (days)",
    cn
      ? "超过这个天数的已完成任务会被真正删除。默认 35 天，保证“本月”统计完整；0 = 永不删除"
      : "Finished tasks older than this are deleted for good. 35 by default so “this month” totals stay complete; 0 = never",
    () => tab.plugin.settings.donePurgeAfterDays,
    (n) => (tab.plugin.settings.donePurgeAfterDays = n),
    0,
    3650
  );

  numberSetting(tab, containerEl, 
    cn ? "最近编辑条数" : "Recent files count",
    "",
    () => tab.plugin.settings.recentLimit,
    (n) => (tab.plugin.settings.recentLimit = n),
    1,
    50
  );
  numberSetting(tab, containerEl, 
    cn ? "默认专注时长（分钟）" : "Default focus minutes",
    "",
    () => tab.plugin.settings.focusDefaultMinutes,
    (n) => {
      tab.plugin.settings.focusDefaultMinutes = n;
      tab.plugin.focus.setTargetMinutes(n);
    },
    1,
    180
  );
}
