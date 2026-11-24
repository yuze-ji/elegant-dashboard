import { App, Notice, PluginSettingTab, Setting, moment } from "obsidian";
import type DashboardPlugin from "./main";
import { BackupService } from "./backup";
import { CustomItemKind, MODULE_ORDER, ModuleId, newId } from "./types";
import { normalizeTime } from "./alarm";
import { addSection, deleteSection, moveSection, renameSection } from "./mutations";

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
      .setName(cn ? "启动时自动打开" : "Open on startup")
      .setDesc(
        cn
          ? "Obsidian 启动、恢复上次的标签页布局之后，自动打开仪表板"
          : "Opens the dashboard tab once Obsidian has restored the previous session's layout"
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.openOnStartup).onChange(async (v) => {
          this.plugin.settings.openOnStartup = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(cn ? "数据存储" : "Data storage")
      .setDesc(
        cn
          ? `任务与项目保存在插件的 data.json 中，不占用笔记文件。当前：${this.plugin.settings.storedTasks.length} 个任务、${this.plugin.settings.storedProjects.length} 个项目`
          : `Tasks and projects live in the plugin's data.json. Currently ${this.plugin.settings.storedTasks.length} tasks and ${this.plugin.settings.storedProjects.length} projects.`
      );

    new Setting(containerEl)
      .setName(cn ? "备份" : "Backup")
      .setDesc(
        cn
          ? "所有任务、项目、日程、习惯、闹钟都只存在这份本地数据里，没有其它历史记录——建议定期导出一份"
          : "Tasks, projects, deadlines, habits and alarms all live only in this local data — export a copy every so often"
      )
      .addButton((b) =>
        b.setButtonText(cn ? "导出" : "Export").onClick(() => this.exportBackup())
      )
      .addButton((b) =>
        b.setButtonText(cn ? "导入" : "Import").onClick(() => this.importBackup())
      );

    new Setting(containerEl)
      .setName(cn ? "自动备份" : "Automatic backups")
      .setDesc(
        cn
          ? `每天第一次保存时在 ${this.plugin.backup.dir()}/ 留一份快照，超出份数自动删除最旧的`
          : `Snapshots data.json once a day into ${this.plugin.backup.dir()}/, pruning the oldest past the count`
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoBackup).onChange(async (v) => {
          this.plugin.settings.autoBackup = v;
          await this.plugin.saveSettings();
        })
      )
      .addSlider((s) =>
        s
          .setLimits(1, 30, 1)
          .setValue(this.plugin.settings.autoBackupKeep)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.autoBackupKeep = v;
            await this.plugin.saveSettings();
            await this.plugin.backup.prune();
          })
      );

    this.renderRestoreRow(containerEl, cn);

    new Setting(containerEl).setName(cn ? "任务分区" : "Task sections").setHeading();
    this.renderSections(containerEl, cn);

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
    new Setting(containerEl).setName(cn ? "已完成任务" : "Completed tasks").setHeading();
    numberSetting(
      cn ? "完成几天后从列表隐藏" : "Hide from Done after (days)",
      cn
        ? "到期后从“已完成”列移走，但仍计入今日/本周/本月统计，并可在任务页底部的折叠栏里找到。0 = 不隐藏"
        : "Leaves the Done column but still counts towards the targets, and stays reachable under a fold on the Tasks page. 0 = never",
      () => this.plugin.settings.doneHideAfterDays,
      (n) => (this.plugin.settings.doneHideAfterDays = n),
      0,
      365
    );
    numberSetting(
      cn ? "完成几天后彻底删除" : "Delete after (days)",
      cn
        ? "超过这个天数的已完成任务会被真正删除。默认 35 天，保证“本月”统计完整；0 = 永不删除"
        : "Finished tasks older than this are deleted for good. 35 by default so “this month” totals stay complete; 0 = never",
      () => this.plugin.settings.donePurgeAfterDays,
      (n) => (this.plugin.settings.donePurgeAfterDays = n),
      0,
      3650
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
            await this.plugin.importIcsText(await f.text());
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
        tx.setValue(this.plugin.settings.icsUrl).onChange(async (v) => {
          this.plugin.settings.icsUrl = v.trim();
          this.plugin.settings.icsLastSync = null;
          await this.plugin.saveSettings();
        });
        tx.inputEl.style.width = "280px";
      })
      .addButton((b) =>
        b.setButtonText(cn ? "立即同步" : "Sync now").onClick(() => void this.plugin.syncIcs(true))
      );
    new Setting(containerEl)
      .setName(cn ? "标题关键词" : "Title keywords")
      .setDesc(
        cn
          ? "逗号分隔，标题含任一关键词的事件才导入；留空导入全部（课表会把每节课都变成日程，不建议）"
          : "Comma-separated; only events whose title contains one are imported. Empty imports everything (a timetable would turn every lecture into a deadline)"
      )
      .addText((tx) => {
        tx.setValue(this.plugin.settings.icsKeywords).onChange(async (v) => {
          this.plugin.settings.icsKeywords = v;
          await this.plugin.saveSettings();
        });
        tx.inputEl.style.width = "280px";
      });
    new Setting(containerEl)
      .setName(cn ? "启动时自动同步" : "Sync at startup")
      .setDesc(
        this.plugin.settings.icsLastSync
          ? (cn ? `上次同步：${this.plugin.settings.icsLastSync}` : `Last synced ${this.plugin.settings.icsLastSync}`)
          : ""
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.icsSyncOnStartup).onChange(async (v) => {
          this.plugin.settings.icsSyncOnStartup = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName(cn ? "番茄周期" : "Pomodoro").setHeading();
    const pomo = (name: string, get: () => number, set: (n: number) => void, min: number, max: number) =>
      numberSetting(name, "", get, set, min, max);
    pomo(
      cn ? "工作（分钟）" : "Work (minutes)",
      () => this.plugin.settings.pomodoroWork,
      (n) => (this.plugin.settings.pomodoroWork = n),
      1,
      180
    );
    pomo(
      cn ? "短休息（分钟）" : "Short break (minutes)",
      () => this.plugin.settings.pomodoroShort,
      (n) => (this.plugin.settings.pomodoroShort = n),
      1,
      60
    );
    pomo(
      cn ? "长休息（分钟）" : "Long break (minutes)",
      () => this.plugin.settings.pomodoroLong,
      (n) => (this.plugin.settings.pomodoroLong = n),
      1,
      120
    );
    pomo(
      cn ? "几轮工作后长休息" : "Work rounds per long break",
      () => this.plugin.settings.pomodoroRounds,
      (n) => (this.plugin.settings.pomodoroRounds = n),
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
        tg.setValue(this.plugin.settings.pomodoroAutoStart).onChange(async (v) => {
          this.plugin.settings.pomodoroAutoStart = v;
          await this.plugin.saveSettings();
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
    clockToggle(
      cn ? "语言学习朗读" : "Language page: read aloud",
      cn
        ? "点击假名、韩文或单词时用系统语音朗读（需要系统已安装对应语言的语音）"
        : "Click a kana, hangul or word to hear it with the system voice (needs that language's voice installed)",
      () => this.plugin.settings.speakAloud,
      (v) => (this.plugin.settings.speakAloud = v)
    );

    new Setting(containerEl)
      .setName(cn ? "习惯每日提醒" : "Daily habit reminder")
      .setDesc(
        cn
          ? "到点后，只要还有习惯没打卡就弹一条提示；全部打卡完成则不提醒。设了单独提醒时间的习惯不在此列"
          : "At this time, shows a reminder if any habit isn't checked in yet — skipped once everything is. Habits with a reminder time of their own are left out"
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.habitReminderEnabled).onChange(async (v) => {
          this.plugin.settings.habitReminderEnabled = v;
          // Re-arms today's check rather than waiting for tomorrow to
          // notice the setting changed.
          this.plugin.settings.habitReminderFiredDate = null;
          await this.plugin.saveSettings();
        })
      )
      .addText((tx) => {
        tx.inputEl.type = "time";
        tx.setValue(this.plugin.settings.habitReminderTime).onChange(async (v) => {
          const normalized = normalizeTime(v);
          if (!normalized) return;
          this.plugin.settings.habitReminderTime = normalized;
          this.plugin.settings.habitReminderFiredDate = null;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName(cn ? "语言学习" : "Language learning").setHeading();

    new Setting(containerEl)
      .setName(cn ? "语言列表" : "Languages")
      .setDesc(
        cn
          ? "逗号分隔；添加单词时从这里选择，第一个为默认。删掉一种语言不会删除它的单词"
          : "Comma-separated; offered when adding a word, the first is the default. Removing a language keeps its words"
      )
      .addText((tx) => {
        tx.setValue(this.plugin.settings.vocabLanguages.join(", ")).onChange(async (v) => {
          const list = v
            .split(/[,，]/)
            .map((x) => x.trim())
            .filter((x, i, arr) => x && arr.indexOf(x) === i);
          if (list.length === 0) return;
          this.plugin.settings.vocabLanguages = list;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
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
        tg.setValue(this.plugin.settings.vocabNotesEnabled).onChange(async (v) => {
          this.plugin.settings.vocabNotesEnabled = v;
          await this.plugin.saveSettings();
          if (v) void this.plugin.vocabNotes.sync(true);
        })
      );

    new Setting(containerEl)
      .setName(cn ? "词汇表文件夹" : "Vocabulary notes folder")
      .setDesc(cn ? "库内路径；不存在会自动创建" : "Vault path; created if missing")
      .addText((tx) => {
        tx.setValue(this.plugin.settings.vocabNotesFolder).onChange(async (v) => {
          this.plugin.settings.vocabNotesFolder = v.trim() || "Note/词汇表";
          await this.plugin.saveSettings();
        });
        tx.inputEl.style.width = "220px";
      });

    new Setting(containerEl)
      .setName(cn ? "每日新词目标" : "New words per day")
      .setDesc(cn ? "0 = 不显示目标" : "0 = no goal shown")
      .addText((tx) => {
        tx.inputEl.type = "number";
        tx.inputEl.min = "0";
        tx.setValue(String(this.plugin.settings.vocabNewPerDay)).onChange(async (v) => {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          this.plugin.settings.vocabNewPerDay = n;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        });
      });

    new Setting(containerEl)
      .setName(cn ? "每日复习目标（张）" : "Cards per day")
      .setDesc(cn ? "0 = 不显示目标" : "0 = no goal shown")
      .addText((tx) => {
        tx.inputEl.type = "number";
        tx.inputEl.min = "0";
        tx.setValue(String(this.plugin.settings.vocabReviewPerDay)).onChange(async (v) => {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          this.plugin.settings.vocabReviewPerDay = n;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        });
      });

    new Setting(containerEl).setName(cn ? "外观" : "Appearance").setHeading();

    new Setting(containerEl)
      .setName(cn ? "Overview 布局" : "Overview layout")
      .setDesc(
        cn
          ? "一屏网格 = 所有模块排进一屏的固定网格，卡片内部滚动，像一个首页；逐行 = 原来的上下堆叠，整页滚动"
          : "One-screen grid = every module in a fixed grid that fits the window, cards scrolling inside, like a home page; Rows = the original stacked rows, scrolling as a page"
      )
      .addDropdown((d) =>
        d
          .addOption("home", cn ? "首页" : "Home page")
          .addOption("grid", cn ? "一屏网格" : "One-screen grid")
          .addOption("rows", cn ? "逐行" : "Rows")
          .setValue(this.plugin.settings.overviewLayout)
          .onChange(async (v) => {
            this.plugin.settings.overviewLayout =
              v === "rows" ? "rows" : v === "grid" ? "grid" : "home";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
            this.display();
          })
      );

    if (this.plugin.settings.overviewLayout === "home") {
      new Setting(containerEl)
        .setName(cn ? "首页横幅图片" : "Home banner image")
        .setDesc(
          cn
            ? "URL 或库内路径；留空用自带的莫奈，填 @gradient 用渐变色带"
            : "URL or vault path; empty = the bundled Monet, @gradient = a gradient band"
        )
        .addText((tx) => {
          tx.setPlaceholder("attachments/banner.jpg");
          tx.setValue(this.plugin.settings.homeBanner).onChange(async (v) => {
            this.plugin.settings.homeBanner = v.trim();
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
          tx.inputEl.style.width = "280px";
        });
      new Setting(containerEl)
        .setName(cn ? "首页标语" : "Home motto")
        .setDesc(cn ? "头像旁的一句话；留空用默认" : "The line beside the avatar; empty = default")
        .addText((tx) => {
          tx.setValue(this.plugin.settings.homeMotto).onChange(async (v) => {
            this.plugin.settings.homeMotto = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
          tx.inputEl.style.width = "280px";
        });
      new Setting(containerEl)
        .setName(cn ? "首页头像" : "Home avatar")
        .setDesc(cn ? "图片 URL / 库内路径，或一个表情、一两个字" : "Image URL / vault path, or an emoji / a letter or two")
        .addText((tx) => {
          tx.setValue(this.plugin.settings.homeAvatar).onChange(async (v) => {
            this.plugin.settings.homeAvatar = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
          tx.inputEl.style.width = "280px";
        });
    }
    this.renderHomeLinks(containerEl, cn);

    new Setting(containerEl)
      .setName(cn ? "背景图片" : "Background image")
      .setDesc(
        cn
          ? "可填网址或库内相对路径；留空则不显示背景图。“渐变”是不用图片的柔和底色"
          : "A URL or a vault-relative path; leave empty to disable. “Gradient” is a soft colour wash with no image"
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
          .setButtonText(cn ? "渐变" : "Gradient")
          .setTooltip(cn ? "柔和的绿-蓝-紫渐变底色，不用图片" : "A soft green-blue-lavender wash, no image")
          .onClick(async () => {
            this.plugin.settings.backgroundImage = GRADIENT_BACKGROUND;
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
      .setName(cn ? "背景模糊" : "Background blur")
      .setDesc(cn ? "0 = 清晰；20 左右是柔和的虚化" : "0 = sharp; around 20 is a soft blur")
      .addSlider((s) =>
        s
          .setLimits(0, 40, 1)
          .setValue(this.plugin.settings.backgroundBlur)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.backgroundBlur = v;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          })
      );

    new Setting(containerEl)
      .setName(cn ? "液态玻璃" : "Liquid glass")
      .setDesc(
        cn
          ? "开：毛玻璃卡片（背景模糊、色彩增强、边缘高光）；关：和首页头部一致的白底实心卡片"
          : "On: frosted panels (backdrop blur, saturation boost, specular edges). Off: solid white cards matching the home header"
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

    new Setting(containerEl).setName(cn ? "自定义面板" : "Custom panels").setHeading();
    this.renderCustomPanels(containerEl, cn);

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

  /**
   * Downloads the current settings as a JSON file via a Blob + synthetic
   * click — the standard browser download path, so this needs no Electron
   * or Obsidian-internal API and works the same on desktop and mobile.
   */
  /**
   * Editor for the Custom panels module: each panel has a title and items;
   * each item a label, an optional icon (emoji or Lucide name), a kind and
   * a target whose meaning follows the kind. All data-driven — nothing in
   * the plugin decides what a panel is for.
   */
  private renderCustomPanels(containerEl: HTMLElement, cn: boolean) {
    const s = this.plugin.settings;
    const commit = async () => {
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    };
    const redraw = async () => {
      await commit();
      this.display();
    };
    new Setting(containerEl).setDesc(
      cn
        ? "自己定义的面板，每个面板是一张卡片，里面的每一项可以是：网页链接、笔记、文件夹（显示笔记数）、标签（显示笔记数）、命令。图标留空自动匹配，也可以填一个表情或 Lucide 图标名。记得在下方“模块开关”里打开“自定义面板”"
        : "Panels of your own, one card each. An item can be a web link, a note, a folder (shows its note count), a tag (note count) or a command. Leave the icon empty to pick one automatically, or give an emoji / Lucide icon name. Turn the “Custom panels” module on below"
    );
    const kinds: Array<[CustomItemKind, string]> = [
      ["link", cn ? "网页链接" : "Web link"],
      ["note", cn ? "笔记" : "Note"],
      ["folder", cn ? "文件夹（计数）" : "Folder (count)"],
      ["tag", cn ? "标签（计数）" : "Tag (count)"],
      ["command", cn ? "命令" : "Command"],
    ];
    const placeholder: Record<CustomItemKind, string> = {
      link: "https://…",
      note: cn ? "笔记路径，如 Note/INDEX" : "Note path, e.g. Notes/Index",
      folder: cn ? "文件夹路径，如 Note" : "Folder path, e.g. Notes",
      tag: cn ? "标签，如 #ml" : "Tag, e.g. #ml",
      command: cn ? "命令 id，如 daily-notes" : "Command id, e.g. daily-notes",
    };

    s.customPanels.forEach((panel, pi) => {
      const head = new Setting(containerEl).setClass("ed-settings-panel-head");
      head.addText((tx) => {
        tx.setPlaceholder(cn ? "面板标题" : "Panel title").setValue(panel.title).onChange(async (v) => {
          panel.title = v;
          await commit();
        });
        tx.inputEl.style.width = "220px";
        tx.inputEl.style.fontWeight = "700";
      });
      head.addExtraButton((b) =>
        b.setIcon("chevron-up").setTooltip(cn ? "上移" : "Move up").setDisabled(pi === 0).onClick(async () => {
          [s.customPanels[pi - 1], s.customPanels[pi]] = [s.customPanels[pi], s.customPanels[pi - 1]];
          await redraw();
        })
      );
      head.addExtraButton((b) =>
        b
          .setIcon("chevron-down")
          .setTooltip(cn ? "下移" : "Move down")
          .setDisabled(pi === s.customPanels.length - 1)
          .onClick(async () => {
            [s.customPanels[pi + 1], s.customPanels[pi]] = [s.customPanels[pi], s.customPanels[pi + 1]];
            await redraw();
          })
      );
      head.addExtraButton((b) =>
        b.setIcon("trash-2").setTooltip(cn ? "删除面板" : "Delete panel").onClick(async () => {
          s.customPanels.splice(pi, 1);
          await redraw();
        })
      );

      panel.items.forEach((item, ii) => {
        const row = new Setting(containerEl).setClass("ed-settings-item-row");
        row.addText((tx) => {
          tx.setPlaceholder(cn ? "图标" : "Icon").setValue(item.icon).onChange(async (v) => {
            item.icon = v.trim();
            await commit();
          });
          tx.inputEl.style.width = "64px";
        });
        row.addText((tx) => {
          tx.setPlaceholder(cn ? "名称" : "Label").setValue(item.label).onChange(async (v) => {
            item.label = v;
            await commit();
          });
          tx.inputEl.style.width = "130px";
        });
        let targetInput: HTMLInputElement | null = null;
        row.addDropdown((d) => {
          for (const [k, label] of kinds) d.addOption(k, label);
          d.setValue(item.kind).onChange(async (v) => {
            item.kind = v as CustomItemKind;
            if (targetInput) targetInput.placeholder = placeholder[item.kind];
            await commit();
          });
        });
        row.addText((tx) => {
          targetInput = tx.inputEl;
          tx.setPlaceholder(placeholder[item.kind]).setValue(item.target).onChange(async (v) => {
            item.target = v.trim();
            await commit();
          });
          tx.inputEl.style.width = "220px";
        });
        row.addExtraButton((b) =>
          b.setIcon("chevron-up").setTooltip(cn ? "上移" : "Move up").setDisabled(ii === 0).onClick(async () => {
            [panel.items[ii - 1], panel.items[ii]] = [panel.items[ii], panel.items[ii - 1]];
            await redraw();
          })
        );
        row.addExtraButton((b) =>
          b
            .setIcon("chevron-down")
            .setTooltip(cn ? "下移" : "Move down")
            .setDisabled(ii === panel.items.length - 1)
            .onClick(async () => {
              [panel.items[ii + 1], panel.items[ii]] = [panel.items[ii], panel.items[ii + 1]];
              await redraw();
            })
        );
        row.addExtraButton((b) =>
          b.setIcon("x").setTooltip(cn ? "删除" : "Delete").onClick(async () => {
            panel.items.splice(ii, 1);
            await redraw();
          })
        );
      });
      new Setting(containerEl).setClass("ed-settings-item-add").addButton((b) =>
        b.setButtonText(cn ? "+ 添加项目" : "+ Add item").onClick(async () => {
          panel.items.push({ id: newId(), label: "", icon: "", kind: "link", target: "" });
          await redraw();
        })
      );
    });
    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText(cn ? "+ 新建面板" : "+ New panel")
        .setCta()
        .onClick(async () => {
          s.customPanels.push({ id: newId(), title: "", items: [] });
          await redraw();
        })
    );
  }

  /**
   * Bookmarks for the home page: label + URL per row, reorder, delete, add.
   * A URL may be http(s)://, obsidian://, mailto:, or a vault note path.
   */
  private renderHomeLinks(containerEl: HTMLElement, cn: boolean) {
    const s = this.plugin.settings;
    const commit = async () => {
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    };
    new Setting(containerEl)
      .setName(cn ? "常用站点" : "Sites")
      .setDesc(
        cn
          ? "“常用站点”模块里的书签（模块开关在下方）。网址填 https://…、obsidian://… 或库内笔记路径；名称以表情开头可自定义图标"
          : "Bookmarks for the Sites module (toggle it below). A URL can be https://…, obsidian://…, or a vault note path; start the label with an emoji to pick your own mark"
      );
    s.homeLinks.forEach((link, i) => {
      const row = new Setting(containerEl).setName("");
      row.addText((tx) => {
        tx.setPlaceholder(cn ? "名称" : "Label").setValue(link.label).onChange(async (v) => {
          link.label = v;
          await commit();
        });
        tx.inputEl.style.width = "140px";
      });
      row.addText((tx) => {
        tx.setPlaceholder("https://…").setValue(link.url).onChange(async (v) => {
          link.url = v.trim();
          await commit();
        });
        tx.inputEl.style.width = "260px";
      });
      row.addExtraButton((b) =>
        b
          .setIcon("chevron-up")
          .setTooltip(cn ? "上移" : "Move up")
          .setDisabled(i === 0)
          .onClick(async () => {
            [s.homeLinks[i - 1], s.homeLinks[i]] = [s.homeLinks[i], s.homeLinks[i - 1]];
            await commit();
            this.display();
          })
      );
      row.addExtraButton((b) =>
        b
          .setIcon("chevron-down")
          .setTooltip(cn ? "下移" : "Move down")
          .setDisabled(i === s.homeLinks.length - 1)
          .onClick(async () => {
            [s.homeLinks[i + 1], s.homeLinks[i]] = [s.homeLinks[i], s.homeLinks[i + 1]];
            await commit();
            this.display();
          })
      );
      row.addExtraButton((b) =>
        b
          .setIcon("trash-2")
          .setTooltip(cn ? "删除" : "Delete")
          .onClick(async () => {
            s.homeLinks.splice(i, 1);
            await commit();
            this.display();
          })
      );
    });
    new Setting(containerEl).addButton((b) =>
      b.setButtonText(cn ? "+ 添加链接" : "+ Add link").onClick(async () => {
        s.homeLinks.push({ id: newId(), label: "", url: "" });
        await commit();
        this.display();
      })
    );
  }

  /**
   * The section list: rename in place, reorder with arrows, delete (tasks
   * fall back to the first section), add at the bottom. Names containing
   * 今日/今天/today are what the Today column keys on, so that's mentioned.
   */
  private renderSections(containerEl: HTMLElement, cn: boolean) {
    const store = { settings: this.plugin.settings, save: () => this.plugin.saveSettings() };
    const after = () => {
      this.plugin.refreshViews();
      this.display();
    };
    new Setting(containerEl).setDesc(
      cn
        ? "名字里含“今日/今天/today”的分区，其任务直接进入“今日”列；删除分区时，里面的任务移到第一个分区"
        : "Tasks in a section named with 今日/今天/today land in the Today column; deleting a section moves its tasks to the first one"
    );
    const sections = this.plugin.settings.taskSections;
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
  private renderRestoreRow(containerEl: HTMLElement, cn: boolean) {
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
    void this.plugin.backup.list().then((files) => {
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
            await this.plugin.backup.snapshotBeforeRestore();
            await this.plugin.importSettings(await this.plugin.backup.read(selected));
            new Notice(cn ? "✅ 已从快照恢复" : "✅ Restored from snapshot");
            this.display();
          } catch (err) {
            this.plugin.backup.notifyError(cn ? "恢复失败" : "Restore failed", err);
          }
        });
      });
    });
  }

  private exportBackup() {
    const cn = this.plugin.settings.lang === "cn";
    const json = this.plugin.exportSettingsJson();
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
  private importBackup() {
    const cn = this.plugin.settings.lang === "cn";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        await this.plugin.importSettings(raw);
        new Notice(cn ? "已导入备份" : "Backup imported");
        this.display();
      } catch (err) {
        new Notice(cn ? `导入失败：${String(err)}` : `Import failed: ${String(err)}`);
      }
    };
    input.click();
  }
}
