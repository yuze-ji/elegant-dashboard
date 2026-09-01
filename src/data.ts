import { App, TFile } from "obsidian";
import {
  ActivityData,
  DashboardSettings,
  ProjectItem,
  TaskBuckets,
  TaskItem,
  VaultStats,
} from "./types";
import { addMonths, monthKey, toKey, startOfIsoWeek, startOfMonth } from "./dates";

const CJK_RE = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/g;

/** Counts CJK characters individually plus latin word groups. */
export function countWords(text: string): number {
  const stripped = text
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ");
  const cjk = (stripped.match(CJK_RE) || []).length;
  const latin = (stripped.replace(CJK_RE, " ").match(/[A-Za-z0-9][A-Za-z0-9'_-]*/g) || []).length;
  return cjk + latin;
}

const TODAY_SECTION_RE = /今日|今天|本日|today/i;

interface WordCacheEntry {
  mtime: number;
  words: number;
}

export class DataService {
  private wordCache = new Map<string, WordCacheEntry>();

  constructor(private app: App, private settings: DashboardSettings) {}

  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
  }

  invalidate(path?: string) {
    if (path) this.wordCache.delete(path);
    else this.wordCache.clear();
  }

  private markdownFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  // ---------------------------------------------------------------- activity

  getActivity(): ActivityData {
    const modified: Record<string, number> = {};
    const created: Record<string, string[]> = {};
    for (const f of this.markdownFiles()) {
      if (f.stat.mtime) {
        const k = toKey(new Date(f.stat.mtime));
        modified[k] = (modified[k] || 0) + 1;
      }
      if (f.stat.ctime) {
        const k = toKey(new Date(f.stat.ctime));
        if (!created[k]) created[k] = [];
        created[k].push(f.basename);
      }
    }
    return { modified, created };
  }

  // ---------------------------------------------------------------- projects

  /** Projects live in the plugin's own data file. */
  getProjects(): ProjectItem[] {
    return this.settings.storedProjects.map((p) => ({
      name: p.name,
      status: p.status,
      priority: p.priority,
      progress: Math.max(0, Math.min(100, Number(p.progress) || 0)),
      id: p.id,
    }));
  }

  // ------------------------------------------------------------------- tasks

  /** Tasks live in the plugin's own data file. */
  async getTasks(): Promise<TaskItem[]> {
    return this.settings.storedTasks.map((s) => ({
      name: s.text,
      done: s.done,
      pinned: s.pinned,
      priority: s.priority,
      tags: s.tags,
      doneDate: s.doneDate,
      dueDate: s.dueDate,
      section: s.section,
      id: s.id,
    }));
  }

  bucketTasks(tasks: TaskItem[]): TaskBuckets {
    const todayStr = toKey(new Date());
    const buckets: TaskBuckets = { today: [], todo: [], done: [] };
    for (const t of tasks) {
      if (t.done) {
        buckets.done.push(t);
        continue;
      }
      const dueToday = t.dueDate !== null && t.dueDate <= todayStr;
      const inTodaySection = TODAY_SECTION_RE.test(t.section);
      if (dueToday || inTodaySection) buckets.today.push(t);
      else buckets.todo.push(t);
    }
    const sort = (list: TaskItem[]) =>
      list.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if ((a.priority === "high") !== (b.priority === "high")) return a.priority === "high" ? -1 : 1;
        return 0;
      });
    sort(buckets.today);
    sort(buckets.todo);
    buckets.done.sort((a, b) => (b.doneDate || "").localeCompare(a.doneDate || ""));
    return buckets;
  }

  /** Counts of tasks completed today / this ISO week / this month. */
  countCompletions(tasks: TaskItem[]): { today: number; week: number; month: number } {
    const now = new Date();
    const todayStr = toKey(now);
    const weekStart = toKey(startOfIsoWeek(now));
    const monthStart = toKey(startOfMonth(now));
    let today = 0;
    let week = 0;
    let month = 0;
    for (const t of tasks) {
      if (!t.done || !t.doneDate) continue;
      if (t.doneDate === todayStr) today++;
      if (t.doneDate >= weekStart) week++;
      if (t.doneDate >= monthStart) month++;
    }
    return { today, week, month };
  }

  // ------------------------------------------------------------------- stats

  async getVaultStats(): Promise<VaultStats> {
    const files = this.markdownFiles();

    const months: string[] = [];
    const monthlyWords: Record<string, number> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const k = monthKey(addMonths(now, -i));
      months.push(k);
      monthlyWords[k] = 0;
    }

    let wordCount = 0;
    for (const f of files) {
      const cached = this.wordCache.get(f.path);
      let words: number;
      if (cached && cached.mtime === f.stat.mtime) {
        words = cached.words;
      } else {
        try {
          words = countWords(await this.app.vault.cachedRead(f));
        } catch {
          words = 0;
        }
        this.wordCache.set(f.path, { mtime: f.stat.mtime, words });
      }
      wordCount += words;

      if (f.stat.ctime) {
        const mk = monthKey(new Date(f.stat.ctime));
        if (mk in monthlyWords) monthlyWords[mk] += words;
      }
    }

    const resolved = this.app.metadataCache.resolvedLinks || {};
    let linkCount = 0;
    for (const src of Object.keys(resolved)) {
      for (const dest of Object.keys(resolved[src])) {
        linkCount += resolved[src][dest];
      }
    }

    const tagCounts: Record<string, number> = {};
    for (const f of files) {
      const cache = this.app.metadataCache.getFileCache(f);
      if (!cache) continue;
      const seen = new Set<string>();
      for (const t of cache.tags || []) seen.add(t.tag);
      const fmTags = cache.frontmatter?.tags;
      if (typeof fmTags === "string") {
        fmTags.split(/[,\s]+/).filter(Boolean).forEach((t) => seen.add(t.startsWith("#") ? t : "#" + t));
      } else if (Array.isArray(fmTags)) {
        fmTags.forEach((t) => {
          const s = String(t);
          if (s) seen.add(s.startsWith("#") ? s : "#" + s);
        });
      }
      seen.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1));
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { noteCount: files.length, wordCount, linkCount, monthlyWords, topTags };
  }

  getRecentFiles(limit: number): TFile[] {
    return this.markdownFiles()
      .slice()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, limit);
  }

  monthKeys(): string[] {
    const now = new Date();
    const out: string[] = [];
    for (let i = 11; i >= 0; i--) out.push(monthKey(addMonths(now, -i)));
    return out;
  }
}
