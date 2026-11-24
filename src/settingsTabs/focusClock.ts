import { Setting } from "obsidian";
import { normalizeTime } from "../alarm";
import { numberSetting } from "./shared";
import type { DashboardSettingTab } from "../settings";

export function renderFocusClockSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "番茄周期" : "Pomodoro").setHeading();
  const pomo = (name: string, get: () => number, set: (n: number) => void, min: number, max: number) =>
    numberSetting(tab, containerEl, name, "", get, set, min, max);
  pomo(
    cn ? "工作（分钟）" : "Work (minutes)",
    () => tab.plugin.settings.pomodoroWork,
    (n) => (tab.plugin.settings.pomodoroWork = n),
    1,
    180
  );
  pomo(
    cn ? "短休息（分钟）" : "Short break (minutes)",
    () => tab.plugin.settings.pomodoroShort,
    (n) => (tab.plugin.settings.pomodoroShort = n),
    1,
    60
  );
  pomo(
    cn ? "长休息（分钟）" : "Long break (minutes)",
    () => tab.plugin.settings.pomodoroLong,
    (n) => (tab.plugin.settings.pomodoroLong = n),
    1,
    120
  );
  pomo(
    cn ? "几轮工作后长休息" : "Work rounds per long break",
    () => tab.plugin.settings.pomodoroRounds,
    (n) => (tab.plugin.settings.pomodoroRounds = n),
    1,
    12
  );
  new Setting(containerEl)
    .setName(cn ? "自动进入下一阶段" : "Auto-start the next phase")
    .setDesc(
      cn
        ? "关闭后，每个阶段结束时停下来等你按开始"
        : "Off: each phase ends stopped, waiting for Start"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.pomodoroAutoStart).onChange(async (v) => {
        tab.plugin.settings.pomodoroAutoStart = v;
        await tab.plugin.saveSettings();
      })
    );

  new Setting(containerEl).setName(cn ? "时钟与闹钟" : "Clock & alarms").setHeading();


  new Setting(containerEl)
    .setName(cn ? "专注计时器样式" : "Focus timer style")
    .setDesc(
      cn
        ? "圆环 = 原来的进度盘；翻页 = 翻页时钟数字加进度条"
        : "Dial = the classic ring; Flip = flip-clock digits with a progress bar"
    )
    .addDropdown((d) =>
      d
        .addOption("dial", cn ? "圆环" : "Dial")
        .addOption("flip", cn ? "翻页" : "Flip")
        .setValue(tab.plugin.settings.focusClockStyle)
        .onChange(async (v) => {
          tab.plugin.settings.focusClockStyle = v === "flip" ? "flip" : "dial";
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
    );

  const clockToggle = (
    name: string,
    desc: string,
    get: () => boolean,
    set: (v: boolean) => void
  ) => {
    new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((tg) =>
        tg.setValue(get()).onChange(async (v) => {
          set(v);
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
      );
  };

  clockToggle(
    cn ? "24 小时制" : "24-hour clock",
    cn ? "关闭则显示 12 小时制与上午/下午" : "Off shows a 12-hour clock with AM/PM",
    () => tab.plugin.settings.clock24h,
    (v) => (tab.plugin.settings.clock24h = v)
  );
  clockToggle(
    cn ? "显示秒" : "Show seconds",
    "",
    () => tab.plugin.settings.clockSeconds,
    (v) => (tab.plugin.settings.clockSeconds = v)
  );
  clockToggle(
    cn ? "显示日期与星期" : "Show date and weekday",
    "",
    () => tab.plugin.settings.clockShowDate,
    (v) => (tab.plugin.settings.clockShowDate = v)
  );
  clockToggle(
    cn ? "闹钟提示音" : "Alarm sound",
    cn
      ? "响铃时播放提示音，最多持续 1 分钟；关闭则只弹通知"
      : "Chime while ringing, for up to a minute; off shows only the notice",
    () => tab.plugin.settings.alarmSound,
    (v) => (tab.plugin.settings.alarmSound = v)
  );
  clockToggle(
    cn ? "语言学习朗读" : "Language page: read aloud",
    cn
      ? "点击假名、韩文或单词时用系统语音朗读（需要系统已安装对应语言的语音）"
      : "Click a kana, hangul or word to hear it with the system voice (needs that language's voice installed)",
    () => tab.plugin.settings.speakAloud,
    (v) => (tab.plugin.settings.speakAloud = v)
  );

  new Setting(containerEl)
    .setName(cn ? "习惯每日提醒" : "Daily habit reminder")
    .setDesc(
      cn
        ? "到点后，只要还有习惯没打卡就弹一条提示；全部打卡完成则不提醒。设了单独提醒时间的习惯不在此列"
        : "At this time, shows a reminder if any habit isn't checked in yet — skipped once everything is. Habits with a reminder time of their own are left out"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.habitReminderEnabled).onChange(async (v) => {
        tab.plugin.settings.habitReminderEnabled = v;
        // Re-arms today's check rather than waiting for tomorrow to
        // notice the setting changed.
        tab.plugin.settings.habitReminderFiredDate = null;
        await tab.plugin.saveSettings();
      })
    )
    .addText((tx) => {
      tx.inputEl.type = "time";
      tx.setValue(tab.plugin.settings.habitReminderTime).onChange(async (v) => {
        const normalized = normalizeTime(v);
        if (!normalized) return;
        tab.plugin.settings.habitReminderTime = normalized;
        tab.plugin.settings.habitReminderFiredDate = null;
        await tab.plugin.saveSettings();
      });
    });
}
