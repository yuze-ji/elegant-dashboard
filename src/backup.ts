import { App, Notice } from "obsidian";
import { toKey } from "./dates";

/**
 * Daily snapshots of data.json, kept outside the plugin folder (so an
 * uninstall or a `git clean` of the plugin repo doesn't take them along)
 * under `<configDir>/elegant-dashboard-backups/data-YYYY-MM-DD.json`.
 *
 * One per day, written on the first save of the day (and at startup, so a
 * day with no edits still leaves a copy), oldest pruned past the configured
 * count. The point is a sync conflict or a bad import: the manual Export
 * button is only ever pressed after it was needed.
 */
export class BackupService {
  /** Date key of the last snapshot taken this session — saves a disk check per save. */
  private lastDate: string | null = null;
  private busy = false;

  constructor(
    private app: App,
    private opts: {
      enabled: () => boolean;
      keep: () => number;
      json: () => string;
    }
  ) {}

  dir(): string {
    return `${this.app.vault.configDir}/elegant-dashboard-backups`;
  }

  private pathFor(key: string, suffix = ""): string {
    return `${this.dir()}/data-${key}${suffix}.json`;
  }

  /** Writes today's snapshot if there isn't one yet. Safe to call on every save. */
  async ensureToday(): Promise<void> {
    if (!this.opts.enabled() || this.busy) return;
    const key = toKey(new Date());
    if (this.lastDate === key) return;
    this.busy = true;
    try {
      const adapter = this.app.vault.adapter;
      const path = this.pathFor(key);
      if (!(await adapter.exists(path))) {
        if (!(await adapter.exists(this.dir()))) await adapter.mkdir(this.dir());
        await adapter.write(path, this.opts.json());
        await this.prune();
      }
      this.lastDate = key;
    } catch (err) {
      console.error("[elegant-dashboard] backup failed", err);
    } finally {
      this.busy = false;
    }
  }

  /**
   * A one-off snapshot outside the daily cadence (taken right before a
   * restore, so even a wrong restore is undoable). Never pruned by count —
   * it's "-before-restore", not a dated daily — but there is only ever the
   * latest one, overwritten each time.
   */
  async snapshotBeforeRestore(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.dir()))) await adapter.mkdir(this.dir());
    await adapter.write(this.pathFor(toKey(new Date()), "-before-restore"), this.opts.json());
  }

  /** Backup file paths, newest first. */
  async list(): Promise<string[]> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.dir()))) return [];
    const { files } = await adapter.list(this.dir());
    return files
      .filter((f) => /\/data-\d{4}-\d{2}-\d{2}(-before-restore)?\.json$/.test(f))
      .sort()
      .reverse();
  }

  async read(path: string): Promise<unknown> {
    return JSON.parse(await this.app.vault.adapter.read(path)) as unknown;
  }

  /** Drops the oldest *daily* snapshots past the keep count. */
  async prune(): Promise<void> {
    const keep = Math.max(1, this.opts.keep());
    const daily = (await this.list()).filter((f) => !f.endsWith("-before-restore.json"));
    for (const f of daily.slice(keep)) {
      try {
        await this.app.vault.adapter.remove(f);
      } catch (err) {
        console.error("[elegant-dashboard] could not prune backup", f, err);
      }
    }
  }

  /** `data-2026-11-01.json` → `2026-11-01`; the before-restore one is labelled. */
  static label(path: string, beforeRestoreText: string): string {
    const m = /data-(\d{4}-\d{2}-\d{2})(-before-restore)?\.json$/.exec(path);
    if (!m) return path;
    return m[2] ? `${m[1]} (${beforeRestoreText})` : m[1];
  }

  notifyError(message: string, err: unknown) {
    console.error("[elegant-dashboard]", message, err);
    new Notice(`⚠️ ${message}`);
  }
}
