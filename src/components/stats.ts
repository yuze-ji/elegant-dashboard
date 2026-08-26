import { VaultStats } from "../types";
import { Ctx } from "../ui";

export function renderStats(parent: HTMLElement, ctx: Ctx, stats: VaultStats) {
  const { t } = ctx;
  const row = parent.createDiv({ cls: "ed-card ed-stat-row" });

  const cell = (value: string, label: string) => {
    const c = row.createDiv({ cls: "ed-stat-cell" });
    c.createDiv({ cls: "ed-stat-num", text: value });
    c.createDiv({ cls: "ed-stat-label", text: label });
  };

  cell(stats.noteCount.toLocaleString(), t.totalNotes);
  cell(stats.wordCount.toLocaleString(), t.totalWords);
  cell(stats.linkCount.toLocaleString(), t.totalLinks);
}
