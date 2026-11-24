import { App, Modal, Setting } from "obsidian";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, ProjectItem, TaskRepeat } from "./types";
import { TaskDraft, VocabDraft } from "./mutations";
import { LookupResult } from "./lookup";
import { Lang } from "./types";
import { addNoteSetting } from "./noteLink";
import { isoWeekday } from "./dates";

const WEEKDAYS: Record<Lang, string[]> = {
  cn: ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

type Texts = { cn: string; en: string };
const pick = (t: Texts, lang: Lang) => (lang === "en" ? t.en : t.cn);

export class TaskEditModal extends Modal {
  private draft: TaskDraft;
  private section: string;

  constructor(
    app: App,
    private lang: Lang,
    private opts: {
      title: Texts;
      initial: TaskDraft;
      sections?: string[];
      initialSection?: string;
      /** Open deadlines offered in the "preparation for" dropdown. */
      deadlines?: Array<{ id: string; title: string; date: string }>;
      onSubmit: (draft: TaskDraft, section: string) => void | Promise<void>;
      onDelete?: () => void | Promise<void>;
    }
  ) {
    super(app);
    this.draft = { ...opts.initial };
    this.section = opts.initialSection ?? opts.sections?.[0] ?? "";
  }

  onOpen() {
    const { contentEl } = this;
    const L = (t: Texts) => pick(t, this.lang);
    contentEl.createEl("h3", { text: L(this.opts.title) });

    let submit: () => void = () => undefined;

    new Setting(contentEl)
      .setName(L({ cn: "内容", en: "Text" }))
      .addText((tx) => {
        tx.setValue(this.draft.text).onChange((v) => (this.draft.text = v));
        tx.inputEl.style.width = "280px";
        window.setTimeout(() => {
          tx.inputEl.focus();
          tx.inputEl.select();
        }, 0);
        tx.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        });
      });

    if (this.opts.sections && this.opts.sections.length > 0) {
      new Setting(contentEl)
        .setName(L({ cn: "所属分区", en: "Section" }))
        .addDropdown((d) => {
          this.opts.sections!.forEach((s) => d.addOption(s, s));
          d.setValue(this.section).onChange((v) => (this.section = v));
        });
    }

    new Setting(contentEl)
      .setName(L({ cn: "高优先级", en: "High priority" }))
      .setDesc(L({ cn: "写入 #priority/high", en: "Adds #priority/high" }))
      .addToggle((tg) =>
        tg
          .setValue(this.draft.priority === "high")
          .onChange((v) => (this.draft.priority = v ? "high" : "normal"))
      );

    new Setting(contentEl)
      .setName(L({ cn: "置顶", en: "Pinned" }))
      .setDesc(L({ cn: "写入 📌", en: "Adds 📌" }))
      .addToggle((tg) =>
        tg.setValue(this.draft.pinned).onChange((v) => (this.draft.pinned = v))
      );

    new Setting(contentEl)
      .setName(L({ cn: "到期日", en: "Due date" }))
      .setDesc(L({ cn: "写入 📅，留空表示无", en: "Adds 📅, empty for none" }))
      .addText((tx) => {
        tx.inputEl.type = "date";
        tx.setValue(this.draft.dueDate ?? "").onChange(
          (v) => (this.draft.dueDate = v || null)
        );
      });

    if (this.opts.deadlines && this.opts.deadlines.length > 0) {
      new Setting(contentEl)
        .setName(L({ cn: "为哪个日程准备", en: "Preparation for" }))
        .setDesc(L({ cn: "挂在日程下，日程行会显示完成进度", en: "Hangs under the deadline, which then shows progress" }))
        .addDropdown((d) => {
          d.addOption("", L({ cn: "无", en: "None" }));
          for (const dl of this.opts.deadlines!) d.addOption(dl.id, `${dl.title} · ${dl.date}`);
          // A dangling link (deadline deleted) shows as "None" and is cleared on save.
          const known = this.opts.deadlines!.some((dl) => dl.id === this.draft.deadlineId);
          if (!known) this.draft.deadlineId = null;
          d.setValue(this.draft.deadlineId ?? "").onChange((v) => (this.draft.deadlineId = v || null));
        });
    }

    // Repeat: a dropdown, plus a row of weekday pills that only appears for
    // "weekly" — the alarm list's picker, reused by class so they match.
    const repeatLabels: Record<TaskRepeat, Texts> = {
      none: { cn: "不重复", en: "Does not repeat" },
      daily: { cn: "每天", en: "Daily" },
      weekly: { cn: "每周", en: "Weekly" },
      monthly: { cn: "每月", en: "Monthly" },
    };
    let daysRow: Setting | null = null;
    const syncDaysRow = () => {
      daysRow?.settingEl.toggle(this.draft.repeat === "weekly");
    };
    new Setting(contentEl)
      .setName(L({ cn: "重复", en: "Repeat" }))
      .setDesc(
        L({
          cn: "完成后自动生成下一次，按到期日推算",
          en: "Checking it off schedules the next one from the due date",
        })
      )
      .addDropdown((d) => {
        (Object.keys(repeatLabels) as TaskRepeat[]).forEach((k) =>
          d.addOption(k, L(repeatLabels[k]))
        );
        d.setValue(this.draft.repeat).onChange((v) => {
          this.draft.repeat = v as TaskRepeat;
          if (v === "weekly" && this.draft.repeatDays.length === 0) {
            // Default to the due date's weekday (or today's), like the alarms do.
            const base = this.draft.dueDate
              ? new Date(this.draft.dueDate + "T00:00:00")
              : new Date();
            this.draft.repeatDays = [isoWeekday(base)];
            drawDays();
          }
          syncDaysRow();
        });
      });

    daysRow = new Setting(contentEl).setName(L({ cn: "每周几", en: "On" }));
    const daysEl = daysRow.controlEl.createDiv({ cls: "ed-alarm-days" });
    const drawDays = () => {
      daysEl.empty();
      for (let iso = 1; iso <= 7; iso++) {
        const chip = daysEl.createEl("button", {
          cls: "ed-alarm-day",
          text: WEEKDAYS[this.lang][iso - 1],
        });
        chip.type = "button";
        chip.toggleClass("is-on", this.draft.repeatDays.includes(iso));
        chip.onclick = () => {
          const on = this.draft.repeatDays.includes(iso);
          // Never let the set go empty from the UI: "weekly on no days" is
          // "same weekday next week" internally, which would read as a bug.
          if (on && this.draft.repeatDays.length === 1) return;
          this.draft.repeatDays = on
            ? this.draft.repeatDays.filter((d) => d !== iso)
            : [...this.draft.repeatDays, iso].sort((a, b) => a - b);
          chip.toggleClass("is-on", !on);
        };
      }
    };
    drawDays();
    syncDaysRow();

    addNoteSetting(contentEl, this.app, this.lang, this.draft.note, (p) => (this.draft.note = p));

    new Setting(contentEl)
      .setName(L({ cn: "备注", en: "Notes" }))
      .setDesc(L({ cn: "可选，多行；在任务列表里点 ≡ 展开", en: "Optional — expand with ≡ in the list" }))
      .addTextArea((ta) => {
        ta.setValue(this.draft.notes).onChange((v) => (this.draft.notes = v));
        ta.inputEl.rows = 3;
        ta.inputEl.style.width = "280px";
      });

    const buttons = new Setting(contentEl);
    if (this.opts.onDelete) {
      buttons.addButton((b) =>
        b
          .setButtonText(L({ cn: "删除", en: "Delete" }))
          .setWarning()
          .onClick(async () => {
            await this.opts.onDelete!();
            this.close();
          })
      );
    }
    buttons
      .addButton((b) =>
        b.setButtonText(L({ cn: "取消", en: "Cancel" })).onClick(() => this.close())
      )
      .addButton((b) => {
        b.setButtonText(L({ cn: "保存", en: "Save" }))
          .setCta()
          .onClick(() => submit());
        submit = async () => {
          if (!this.draft.text.trim()) return;
          await this.opts.onSubmit(this.draft, this.section);
          this.close();
        };
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** What the quick-add deadline command collects. */
export interface DeadlineDraft {
  title: string;
  date: string;
  time: string | null;
  note: string | null;
}

/**
 * The command-palette way to add a deadline. The dashboard's own add rows
 * are inline; this is the same three fields (plus a linked note) in a modal
 * so one can be filed from inside a note without switching tabs.
 */
export class DeadlineQuickAddModal extends Modal {
  private draft: DeadlineDraft;

  constructor(
    app: App,
    private lang: Lang,
    initial: DeadlineDraft,
    private onSubmit: (draft: DeadlineDraft) => void | Promise<void>
  ) {
    super(app);
    this.draft = { ...initial };
  }

  onOpen() {
    const { contentEl } = this;
    const L = (t: Texts) => pick(t, this.lang);
    contentEl.createEl("h3", { text: L({ cn: "新增日程", en: "New deadline" }) });

    const submit = async () => {
      if (!this.draft.title.trim() || !this.draft.date) return;
      await this.onSubmit(this.draft);
      this.close();
    };

    new Setting(contentEl).setName(L({ cn: "事项", en: "What's due" })).addText((tx) => {
      tx.setValue(this.draft.title).onChange((v) => (this.draft.title = v));
      tx.inputEl.style.width = "280px";
      window.setTimeout(() => tx.inputEl.focus(), 0);
      tx.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      });
    });

    new Setting(contentEl).setName(L({ cn: "日期", en: "Date" })).addText((tx) => {
      tx.inputEl.type = "date";
      tx.setValue(this.draft.date).onChange((v) => (this.draft.date = v));
    });

    new Setting(contentEl)
      .setName(L({ cn: "具体时间（可选）", en: "Time (optional)" }))
      .addText((tx) => {
        tx.inputEl.type = "time";
        tx.setValue(this.draft.time ?? "").onChange((v) => (this.draft.time = v || null));
      });

    addNoteSetting(contentEl, this.app, this.lang, this.draft.note, (p) => (this.draft.note = p));

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText(L({ cn: "取消", en: "Cancel" })).onClick(() => this.close())
      )
      .addButton((b) =>
        b
          .setButtonText(L({ cn: "保存", en: "Save" }))
          .setCta()
          .onClick(() => void submit())
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// `createdAt` is stamped once at creation and never user-editable — see
// addProject in mutations.ts — so it has no place in this form.
export type ProjectDraft = Omit<ProjectItem, "id" | "createdAt">;

export class ProjectEditModal extends Modal {
  private draft: ProjectDraft;

  constructor(
    app: App,
    private lang: Lang,
    private opts: {
      title: Texts;
      initial: ProjectDraft;
      onSubmit: (draft: ProjectDraft) => void | Promise<void>;
      onDelete?: () => void | Promise<void>;
    }
  ) {
    super(app);
    this.draft = { ...opts.initial };
  }

  onOpen() {
    const { contentEl } = this;
    const L = (t: Texts) => pick(t, this.lang);
    contentEl.createEl("h3", { text: L(this.opts.title) });

    new Setting(contentEl)
      .setName(L({ cn: "项目名称", en: "Name" }))
      .addText((tx) => {
        tx.setValue(this.draft.name).onChange((v) => (this.draft.name = v));
        tx.inputEl.style.width = "260px";
        window.setTimeout(() => tx.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName(L({ cn: "状态", en: "Status" }))
      .addDropdown((d) => {
        PROJECT_STATUSES.forEach((s) => d.addOption(s, s));
        d.setValue(this.draft.status).onChange((v) => (this.draft.status = v));
      });

    new Setting(contentEl)
      .setName(L({ cn: "优先级", en: "Priority" }))
      .addDropdown((d) => {
        PROJECT_PRIORITIES.forEach((s) => d.addOption(s, s));
        d.setValue(this.draft.priority).onChange((v) => (this.draft.priority = v));
      });

    new Setting(contentEl)
      .setName(L({ cn: "进度", en: "Progress" }))
      .addSlider((s) =>
        s
          .setLimits(0, 100, 5)
          .setValue(this.draft.progress)
          .setDynamicTooltip()
          .onChange((v) => (this.draft.progress = v))
      );

    new Setting(contentEl)
      .setName(L({ cn: "截止日期", en: "Due date" }))
      .setDesc(
        L({
          cn: "留空则不出现在甘特图里（甘特图需要终点才能画出一条时间条）",
          en: "Leave empty to skip this project on the Gantt chart — a bar needs an end",
        })
      )
      .addText((tx) => {
        tx.inputEl.type = "date";
        tx.setValue(this.draft.dueDate ?? "").onChange(
          (v) => (this.draft.dueDate = v || null)
        );
      });

    addNoteSetting(contentEl, this.app, this.lang, this.draft.note, (p) => (this.draft.note = p));

    const buttons = new Setting(contentEl);
    if (this.opts.onDelete) {
      buttons.addButton((b) =>
        b
          .setButtonText(L({ cn: "删除", en: "Delete" }))
          .setWarning()
          .onClick(async () => {
            await this.opts.onDelete!();
            this.close();
          })
      );
    }
    buttons
      .addButton((b) =>
        b.setButtonText(L({ cn: "取消", en: "Cancel" })).onClick(() => this.close())
      )
      .addButton((b) =>
        b
          .setButtonText(L({ cn: "保存", en: "Save" }))
          .setCta()
          .onClick(async () => {
            if (!this.draft.name.trim()) return;
            await this.opts.onSubmit(this.draft);
            this.close();
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class VocabEditModal extends Modal {
  private draft: VocabDraft;

  constructor(
    app: App,
    private lang: Lang,
    private opts: {
      title: Texts;
      languages: string[];
      initial: VocabDraft;
      /** Online lookup (see lookup.ts); null = no button. */
      lookup?: (word: string, lang: string) => Promise<LookupResult | null>;
      onSubmit: (draft: VocabDraft) => void | Promise<void>;
      onDelete?: () => void | Promise<void>;
    }
  ) {
    super(app);
    this.draft = { ...opts.initial };
  }

  onOpen() {
    const { contentEl } = this;
    const L = (t: Texts) => pick(t, this.lang);
    contentEl.createEl("h3", { text: L(this.opts.title) });

    const submit = async () => {
      if (!this.draft.word.trim() || !this.draft.meaning.trim()) return;
      await this.opts.onSubmit(this.draft);
      this.close();
    };
    const onEnter = (el: HTMLElement) =>
      el.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      });

    let wordEl: HTMLInputElement | null = null;
    new Setting(contentEl).setName(L({ cn: "单词", en: "Word" })).addText((tx) => {
      tx.setValue(this.draft.word).onChange((v) => (this.draft.word = v));
      wordEl = tx.inputEl;
      tx.inputEl.style.width = "280px";
      window.setTimeout(() => {
        tx.inputEl.focus();
        tx.inputEl.select();
      }, 0);
      onEnter(tx.inputEl);
    });

    let meaningEl: HTMLInputElement | null = null;
    let exampleEl: HTMLTextAreaElement | null = null;
    const meaningRow = new Setting(contentEl)
      .setName(L({ cn: "释义", en: "Meaning" }))
      .addText((tx) => {
        tx.setValue(this.draft.meaning).onChange((v) => (this.draft.meaning = v));
        tx.inputEl.style.width = "280px";
        meaningEl = tx.inputEl;
        onEnter(tx.inputEl);
      });
    if (this.opts.lookup) {
      const doLookup = this.opts.lookup;
      meaningRow.addButton((b) => {
        const label = L({ cn: "查词", en: "Look up" });
        b.setButtonText(label).onClick(async () => {
          if (!this.draft.word.trim()) return;
          b.setDisabled(true);
          b.setButtonText(L({ cn: "查询中…", en: "Looking up…" }));
          const r = await doLookup(this.draft.word, this.draft.lang);
          b.setDisabled(false);
          b.setButtonText(label);
          if (!r) return;
          if (r.word && r.word !== this.draft.word.trim()) {
            if (!this.draft.meaning.trim()) {
              this.draft.meaning = r.meaning || this.draft.word.trim();
              if (meaningEl) meaningEl.value = this.draft.meaning;
            }
            this.draft.word = r.word;
            if (wordEl) wordEl.value = r.word;
          } else if (!this.draft.meaning.trim() && r.meaning) {
            this.draft.meaning = r.meaning;
            if (meaningEl) meaningEl.value = r.meaning;
          }
          if (!this.draft.example.trim() && r.example) {
            this.draft.example = r.example;
            if (exampleEl) exampleEl.value = r.example;
          }
        });
      });
    }

    new Setting(contentEl)
      .setName(L({ cn: "例句（可选）", en: "Example (optional)" }))
      .addTextArea((ta) => {
        ta.setValue(this.draft.example).onChange((v) => (this.draft.example = v));
        ta.inputEl.rows = 2;
        ta.inputEl.style.width = "280px";
        exampleEl = ta.inputEl;
      });

    // The word's own language stays selectable even if it has since been
    // removed from the settings list, so editing never silently relabels it.
    const langs = [...this.opts.languages];
    if (this.draft.lang && !langs.includes(this.draft.lang)) langs.push(this.draft.lang);
    new Setting(contentEl).setName(L({ cn: "语言", en: "Language" })).addDropdown((dd) => {
      for (const l of langs) dd.addOption(l, l);
      dd.setValue(this.draft.lang || langs[0] || "").onChange((v) => (this.draft.lang = v));
    });

    const row = new Setting(contentEl);
    if (this.opts.onDelete) {
      row.addButton((b) =>
        b
          .setButtonText(L({ cn: "删除", en: "Delete" }))
          .setWarning()
          .onClick(async () => {
            await this.opts.onDelete?.();
            this.close();
          })
      );
    }
    row.addButton((b) =>
      b
        .setButtonText(L({ cn: "保存", en: "Save" }))
        .setCta()
        .onClick(() => void submit())
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
