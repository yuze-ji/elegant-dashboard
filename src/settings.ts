import { App, PluginSettingTab, Setting } from "obsidian";
import type DashboardPlugin from "./main";
import { MODULE_ORDER, ModuleId } from "./types";

/**
 * Sentinel for the bundled Monet *Water Lilies* (1906, Ryerson). Resolved at
 * render time against the plugin's real folder, so renaming the install
 * directory cannot break it.
 */
export const BUNDLED_BACKGROUND = "@bundled";

const MODULE_LABELS: Record<ModuleId, { cn: string; en: string }> = {
  clock: { cn: "翻页时钟与闹钟", en: "Flip clock & alarms" },
  activity: { cn: "笔记活动热力图", en: "Note activity heatmap" },
  focus: { cn: "专注计时器", en: "Focus timer" },
  projects: { cn: "项目概览", en: "Projects board" },
  taskboard: { cn: "任务统计", en: "Taskboard" },
  taskDetails: { cn: "任务详情", en: "Task details" },
  recent: { cn: "最近编辑", en: "Recently edited" },
  stats: { cn: "库统计", en: "Vault stats" },
  charts: { cn: "字数趋势 / 标签占比", en: "Word trend / tag ratio" },
};

export class DashboardSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: DashboardPlugin) {
    super(app, plugin);
  }

  private label(key: ModuleId): string {
    return MODULE_LABELS[key][this.plugin.settings.lang];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const cn = this.plugin.settings.lang === "cn";

    new Setting(containerEl).setName(cn ? "常规" : "General").setHeading();

    new Setting(containerEl)
      .setName(cn ? "语言" : "Language")
      .addDropdown((d) =>
        d
          .addOption("cn", "中文")
          .addOption("en", "English")
          .setValue(this.plugin.settings.lang)
          .onChange(async (v) => {
            this.plugin.settings.lang = v === "en" ? "en" : "cn";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(cn ? "数据存储" : "Data storage")
      .setDesc(
        cn
          ? `任务与项目保存在插件的 data.json 中，不占用笔记文件。当前：${this.plugin.settings.storedTasks.length} 个任务、${this.plugin.settings.storedProjects.length} 个项目`
          : `Tasks and projects live in the plugin's data.json. Currently ${this.plugin.settings.storedTasks.length} tasks and ${this.plugin.settings.storedProjects.length} projects.`
      );

    new Setting(containerEl).setName(cn ? "任务目标" : "Task targets").setHeading();

    const numberSetting = (
      name: string,
      desc: string,
      get: () => number,
      set: (n: number) => void,
      min: number,
      max: number
    ) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addText((tx) =>
          tx.setValue(String(get())).onChange(async (v) => {
            const n = parseInt(v, 10);
            if (!Number.isFinite(n) || n < min || n > max) return;
            set(n);
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
        );
    };

    numberSetting(
      cn ? "今日目标" : "Daily target",
      cn ? "今日完成任务数目标" : "Tasks to complete today",
      () => this.plugin.settings.taskTargetToday,
      (n) => (this.plugin.settings.taskTargetToday = n),
      1,
      999
    );
    numberSetting(
      cn ? "本周目标" : "Weekly target",
      "",
      () => this.plugin.settings.taskTargetWeek,
      (n) => (this.plugin.settings.taskTargetWeek = n),
      1,
      9999
    );
    numberSetting(
      cn ? "本月目标" : "Monthly target",
      "",
      () => this.plugin.settings.taskTargetMonth,
      (n) => (this.plugin.settings.taskTargetMonth = n),
      1,
      99999
    );
    numberSetting(
      cn ? "每列最多任务数" : "Tasks per column",
      "",
      () => this.plugin.settings.taskLimit,
      (n) => (this.plugin.settings.taskLimit = n),
      1,
      200
    );
    numberSetting(
      cn ? "最近编辑条数" : "Recent files count",
      "",
      () => this.plugin.settings.recentLimit,
      (n) => (this.plugin.settings.recentLimit = n),
      1,
      50
    );
    numberSetting(
      cn ? "默认专注时长（分钟）" : "Default focus minutes",
      "",
      () => this.plugin.settings.focusDefaultMinutes,
      (n) => {
        this.plugin.settings.focusDefaultMinutes = n;
        this.plugin.focus.setTargetMinutes(n);
      },
      1,
      180
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
          .setValue(this.plugin.settings.focusClockStyle)
          .onChange(async (v) => {
            this.plugin.settings.focusClockStyle = v === "flip" ? "flip" : "dial";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
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
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
        );
    };

    clockToggle(
      cn ? "24 小时制" : "24-hour clock",
      cn ? "关闭则显示 12 小时制与上午/下午" : "Off shows a 12-hour clock with AM/PM",
      () => this.plugin.settings.clock24h,
      (v) => (this.plugin.settings.clock24h = v)
    );
    clockToggle(
      cn ? "显示秒" : "Show seconds",
      "",
      () => this.plugin.settings.clockSeconds,
      (v) => (this.plugin.settings.clockSeconds = v)
    );
    clockToggle(
      cn ? "显示日期与星期" : "Show date and weekday",
      "",
      () => this.plugin.settings.clockShowDate,
      (v) => (this.plugin.settings.clockShowDate = v)
    );
    clockToggle(
      cn ? "闹钟提示音" : "Alarm sound",
      cn
        ? "响铃时播放提示音，最多持续 1 分钟；关闭则只弹通知"
        : "Chime while ringing, for up to a minute; off shows only the notice",
      () => this.plugin.settings.alarmSound,
      (v) => (this.plugin.settings.alarmSound = v)
    );

    new Setting(containerEl).setName(cn ? "外观" : "Appearance").setHeading();

    new Setting(containerEl)
      .setName(cn ? "背景图片" : "Background image")
      .setDesc(
        cn
          ? "可填网址或库内相对路径；留空则不显示背景图"
          : "A URL or a vault-relative path; leave empty to disable"
      )
      .addText((tx) => {
        tx.setPlaceholder("https://… / path/to/image.jpg")
          .setValue(this.plugin.settings.backgroundImage)
          .onChange(async (v) => {
            this.plugin.settings.backgroundImage = v.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
        tx.inputEl.style.width = "260px";
      })
      .addButton((btn) =>
        btn
          .setButtonText(cn ? "莫奈睡莲" : "Monet")
          .setTooltip(
            cn
              ? "使用插件内置的《睡莲》(1906) 图片"
              : "Use the bundled Water Lilies (1906) image"
          )
          .onClick(async () => {
            this.plugin.settings.backgroundImage = BUNDLED_BACKGROUND;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            this.display();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText(cn ? "清除" : "Clear")
          .onClick(async () => {
            this.plugin.settings.backgroundImage = "";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(cn ? "背景透明度" : "Background opacity")
      .addSlider((s) =>
        s
          .setLimits(0, 1, 0.02)
          .setValue(this.plugin.settings.backgroundOpacity)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.backgroundOpacity = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName(cn ? "液态玻璃" : "Liquid glass")
      .setDesc(
        cn
          ? "卡片使用毛玻璃质感：背景模糊、色彩增强、边缘高光"
          : "Frosted panels: backdrop blur, saturation boost, specular edges"
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.liquidGlass).onChange(async (v) => {
          this.plugin.settings.liquidGlass = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName(cn ? "玻璃模糊强度" : "Glass blur")
      .setDesc(cn ? "数值越大越朦胧" : "Higher is hazier")
      .addSlider((s) =>
        s
          .setLimits(0, 60, 2)
          .setValue(this.plugin.settings.glassBlur)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.glassBlur = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName(cn ? "模块卡片不透明度" : "Card opacity")
      .setDesc(
        cn
          ? "0 = 卡片完全透明（背景图直接透出），1 = 完整绿色玻璃质感"
          : "0 = fully transparent cards, 1 = full green glass tint"
      )
      .addSlider((s) =>
        s
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.cardOpacity)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.cardOpacity = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl).setName(cn ? "模块开关" : "Modules").setHeading();

    for (const id of MODULE_ORDER) {
      new Setting(containerEl).setName(this.label(id)).addToggle((tg) =>
        tg.setValue(this.plugin.settings.modules[id]).onChange(async (v) => {
          this.plugin.settings.modules[id] = v;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );
    }
  }
}
