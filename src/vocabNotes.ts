import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
import { DashboardSettings, VOCAB_MASTERED_BOX, VocabItem } from "./types";
import { Strings } from "./i18n";

/**
 * Mirrors the vocabulary deck into one markdown note per language under a
 * vault folder, so the words are searchable, linkable and readable without
 * the dashboard. The notes are generated: every sync rewrites them in full
 * from data.json, so edits made in the notes themselves do not flow back.
 *
 * Runs off saveSettings via `schedule()`, debounced, and only writes when
 * the deck actually changed since the last write (a cheap fingerprint),
 * so a focus-timer tick or a theme toggle never touches the vault.
 */
export class VocabNotesService {
  private timer: number | null = null;
  private lastFingerprint = "";

  constructor(
    private app: App,
    private opts: {
      settings: () => DashboardSettings;
      strings: () => Strings;
    }
  ) {}

  schedule() {
    const s = this.opts.settings();
    if (!s.vocabNotesEnabled) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.sync(false);
    }, 1500);
  }

  /** `loud` reports what was written in a Notice (the manual command). */
  async sync(loud: boolean): Promise<void> {
    const s = this.opts.settings();
    const t = this.opts.strings();
    const fp = fingerprint(s);
    if (!loud && fp === this.lastFingerprint) return;

    const folder = normalizePath(s.vocabNotesFolder.trim() || "Note/词汇表");
    try {
      await this.ensureFolder(folder);
      const byLang = new Map<string, VocabItem[]>();
      for (const v of s.vocab) {
        const lang = v.lang || "—";
        (byLang.get(lang) ?? byLang.set(lang, []).get(lang)!).push(v);
      }
      let written = 0;
      for (const [lang, words] of byLang) {
        const path = `${folder}/${safeName(lang)}.md`;
        const body = render(lang, words, t);
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
          if ((await this.app.vault.read(existing)) !== body) {
            await this.app.vault.modify(existing, body);
            written++;
          }
        } else {
          await this.app.vault.create(path, body);
          written++;
        }
      }
      this.lastFingerprint = fp;
      if (loud) new Notice(t.vocabNotesSynced(written, byLang.size), 4000);
    } catch (err) {
      console.error("[elegant-dashboard] vocabulary notes sync failed", err);
      if (loud) new Notice(t.vocabNotesFailed(String(err)), 6000);
    }
  }

  private async ensureFolder(path: string) {
    const parts = path.split("/");
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      const f = this.app.vault.getAbstractFileByPath(cur);
      if (!f) await this.app.vault.createFolder(cur);
      else if (!(f instanceof TFolder)) throw new Error(`${cur} is a file, not a folder`);
    }
  }
}

/** Changes whenever any word's content or progress changes. */
function fingerprint(s: DashboardSettings): string {
  return (
    s.vocabNotesFolder +
    "|" +
    s.vocab
      .map((v) => `${v.id}:${v.word}:${v.meaning}:${v.example}:${v.lang}:${v.box}:${v.createdAt}`)
      .join("\n")
  );
}

/** A language name as a file name: no path separators or Obsidian-reserved characters. */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, "_").trim() || "_";

/** Pipes and newlines would break the table. */
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

function render(lang: string, words: VocabItem[], t: Strings): string {
  const sorted = [...words].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || a.word.localeCompare(b.word)
  );
  const mastered = words.filter((v) => v.box >= VOCAB_MASTERED_BOX).length;
  const lines: string[] = [];
  lines.push("---");
  lines.push(`language: "${lang.replace(/"/g, '\\"')}"`);
  lines.push(`words: ${words.length}`);
  lines.push(`mastered: ${mastered}`);
  lines.push("generated: elegant-dashboard");
  lines.push("tags:");
  lines.push("  - 词汇表");
  lines.push("---");
  lines.push("");
  lines.push(`# ${lang} ${t.vocabNotesTitle}`);
  lines.push("");
  lines.push(`> [!info] ${t.vocabNotesGenerated}`);
  lines.push("");
  lines.push(`| ${t.vocabNotesColWord} | ${t.vocabNotesColMeaning} | ${t.vocabNotesColExample} | ${t.vocabNotesColLevel} | ${t.vocabNotesColAdded} |`);
  lines.push("| --- | --- | --- | --- | --- |");
  for (const v of sorted) {
    const level = v.box >= VOCAB_MASTERED_BOX ? t.vocabMastered : t.vocabBox(v.box);
    lines.push(
      `| **${cell(v.word)}** | ${cell(v.meaning)} | ${cell(v.example)} | ${level} | ${v.createdAt} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}
