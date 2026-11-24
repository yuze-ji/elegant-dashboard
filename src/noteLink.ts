import { AbstractInputSuggest, App, Modal, Setting, TFile, setIcon } from "obsidian";
import { Lang } from "./types";

/**
 * Optional "linked note" on tasks, projects and deadlines: a vault path to
 * the note the item is about (the exam's course notes, the project's page).
 * Stored as a plain path string, never as a wikilink — the dashboard has no
 * note of its own for Obsidian to resolve links relative to.
 */

type Texts = { cn: string; en: string };
const pick = (t: Texts, lang: Lang) => (lang === "en" ? t.en : t.cn);

/** Resolves a stored path to its file, or null if it has since moved/gone. */
export function noteFile(app: App, path: string | null | undefined): TFile | null {
  if (!path) return null;
  const f = app.vault.getAbstractFileByPath(path);
  return f instanceof TFile ? f : null;
}

/** Display name for a stored path even when the file no longer exists. */
export function noteName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.md$/i, "");
}

/** Opens the note in a new tab, keeping the dashboard where it is. */
export function openNote(app: App, path: string): void {
  void app.workspace.openLinkText(path, "", "tab");
}

/**
 * Path suggestions under a text input: every markdown file whose path
 * contains the query (case-insensitive), basename matches first.
 */
export class NoteSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private input: HTMLInputElement,
    private onPick: (file: TFile) => void
  ) {
    super(app, input);
    this.limit = 30;
  }

  protected getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase();
    const files = this.app.vault.getMarkdownFiles();
    if (!q) return files.slice(0, this.limit);
    const byName: TFile[] = [];
    const byPath: TFile[] = [];
    for (const f of files) {
      if (f.basename.toLowerCase().includes(q)) byName.push(f);
      else if (f.path.toLowerCase().includes(q)) byPath.push(f);
    }
    return [...byName, ...byPath];
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createDiv({ text: file.basename });
    if (file.parent && file.parent.path !== "/") {
      el.createDiv({ cls: "ed-note-suggest-path", text: file.parent.path });
    }
  }

  selectSuggestion(file: TFile): void {
    this.input.value = file.path;
    this.input.dispatchEvent(new Event("input"));
    this.onPick(file);
    this.close();
  }
}

/**
 * A `Setting` row with a path input + suggestions, for the edit modals.
 * The value is the raw input text, so a path typed by hand works too; it's
 * normalised to `null` when empty.
 */
export function addNoteSetting(
  containerEl: HTMLElement,
  app: App,
  lang: Lang,
  value: string | null,
  onChange: (path: string | null) => void
): Setting {
  return new Setting(containerEl)
    .setName(pick({ cn: "关联笔记", en: "Linked note" }, lang))
    .setDesc(
      pick(
        { cn: "可选，输入笔记名搜索；留空表示无", en: "Optional — type to search; empty for none" },
        lang
      )
    )
    .addText((tx) => {
      tx.setPlaceholder(pick({ cn: "笔记路径…", en: "Note path…" }, lang));
      tx.setValue(value ?? "").onChange((v) => onChange(v.trim() || null));
      tx.inputEl.style.width = "280px";
      new NoteSuggest(app, tx.inputEl, (f) => onChange(f.path));
    });
}

/**
 * The small "open note" button shown on a row/card when a note is linked.
 * Rendered nothing when there is no link, so callers can call it blindly.
 * A link whose file has gone is still shown, struck and muted, so the user
 * can see it needs fixing rather than silently losing it.
 */
export function renderNoteButton(
  parent: HTMLElement,
  app: App,
  lang: Lang,
  path: string | null | undefined,
  cls = "ed-task-icon"
): HTMLElement | null {
  if (!path) return null;
  const file = noteFile(app, path);
  const btn = parent.createEl("button", { cls: `${cls} ed-note-btn` });
  setIcon(btn, file ? "file-text" : "file-x");
  if (!file) btn.addClass("is-missing");
  const name = noteName(path);
  btn.setAttr(
    "aria-label",
    file
      ? pick({ cn: `打开笔记：${name}`, en: `Open note: ${name}` }, lang)
      : pick({ cn: `笔记不存在：${path}`, en: `Note missing: ${path}` }, lang)
  );
  btn.setAttr("title", btn.getAttr("aria-label") ?? "");
  btn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (file) openNote(app, file.path);
  };
  return btn;
}

/**
 * For items edited inline rather than through a modal (deadlines): a tiny
 * modal holding just the note picker.
 */
export class NotePickModal extends Modal {
  private value: string | null;

  constructor(
    app: App,
    private lang: Lang,
    initial: string | null,
    private onSubmit: (path: string | null) => void | Promise<void>
  ) {
    super(app);
    this.value = initial;
  }

  onOpen() {
    const { contentEl } = this;
    const L = (t: Texts) => pick(t, this.lang);
    contentEl.createEl("h3", { text: L({ cn: "关联笔记", en: "Linked note" }) });
    addNoteSetting(contentEl, this.app, this.lang, this.value, (p) => (this.value = p));
    const input = contentEl.querySelector("input");
    if (input instanceof HTMLInputElement) {
      window.setTimeout(() => input.focus(), 0);
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.submit();
        }
      });
    }
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText(L({ cn: "清除", en: "Clear" })).onClick(async () => {
          this.value = null;
          await this.submit();
        })
      )
      .addButton((b) =>
        b.setButtonText(L({ cn: "取消", en: "Cancel" })).onClick(() => this.close())
      )
      .addButton((b) =>
        b
          .setButtonText(L({ cn: "保存", en: "Save" }))
          .setCta()
          .onClick(() => void this.submit())
      );
  }

  private async submit() {
    await this.onSubmit(this.value);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
