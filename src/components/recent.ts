import { TFile } from "obsidian";
import { Ctx, card, empty } from "../ui";
import { formatTime } from "../dates";

export function renderRecent(parent: HTMLElement, ctx: Ctx, files: TFile[]) {
  const { t } = ctx;
  const root = card(parent, `📝 ${t.recentEdited}`);

  if (files.length === 0) {
    empty(root, "—");
    return;
  }

  // Several notes can share a basename (e.g. many SKILL.md files), so qualify
  // the ambiguous ones with their parent folder to keep the list readable.
  const nameCounts = new Map<string, number>();
  for (const f of files) nameCounts.set(f.basename, (nameCounts.get(f.basename) || 0) + 1);

  const list = root.createDiv({ cls: "ed-recent-list" });
  for (const f of files) {
    const row = list.createDiv({ cls: "ed-recent-row" });
    const ambiguous = (nameCounts.get(f.basename) || 0) > 1;
    const parent = f.parent?.name;
    const label = ambiguous && parent ? `${parent}/${f.basename}` : f.basename;
    const link = row.createEl("a", { cls: "ed-recent-link", text: label });
    link.setAttr("aria-label", f.path);
    link.onclick = (e) => {
      e.preventDefault();
      void ctx.app.workspace.getLeaf("tab").openFile(f);
    };
    row.createSpan({ cls: "ed-recent-time", text: formatTime(new Date(f.stat.mtime)) });
  }
}
