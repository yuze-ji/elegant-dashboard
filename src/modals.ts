import { App, Modal, Setting } from "obsidian";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, ProjectItem } from "./types";
import { TaskDraft } from "./mutations";
import { Lang } from "./types";

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

export type ProjectDraft = Omit<ProjectItem, "id">;

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
