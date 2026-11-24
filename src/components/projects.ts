import { setIcon } from "obsidian";
import { ProjectItem } from "../types";
import { Ctx, card, empty, notifyUndo, renderFocusPlay } from "../ui";
import { ProjectDraft, ProjectEditModal } from "../modals";
import { renderNoteButton } from "../noteLink";
import { makeDraggable } from "../dnd";
import {
  Store,
  addProject,
  deleteProject,
  moveProject,
  restoreProject,
  updateProject,
} from "../mutations";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

// Exported for the Gantt chart, so a project's bar and its card badge always
// agree on what "high priority" looks like.
export /** 45 → "45m", 125 → "2h05m": compact enough for a chip. */
function formatShort(mins: number): string {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}m`;
}

const STATUS_ICON: Record<string, string> = {
  active: "▶",
  paused: "⏸",
  done: "✓",
  backlog: "○",
};

export const PRIORITY_COLOR: Record<string, string> = {
  high: "#E8A0A0",
  medium: "#F0A868",
  low: "#8A9BA3",
};


export interface ProjectsOptions {
  /** Include finished projects — used by the dedicated Projects page. */
  showDone?: boolean;
  /** Display only: no edit pencil, no clickable status or progress, no add button. */
  readOnly?: boolean;
}

export function renderProjects(
  parent: HTMLElement,
  ctx: Ctx,
  projects: ProjectItem[],
  opts: ProjectsOptions = {}
) {
  const { t } = ctx;
  const cn = ctx.settings.lang !== "en";
  const root = card(parent, opts.showDone ? `🎯 ${t.allProjects}` : `🎯 ${t.projectsBoard}`);

  // Stored order (drag to change) rather than priority order: the board is
  // arranged by hand now, and a sort would undo every drag. `sort` is
  // stable, so only finished projects move — to the bottom of the listing.
  const visible = projects
    .filter((p) => opts.showDone || p.status !== "done")
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));

  if (visible.length === 0) {
    empty(root, t.noProjects);
  } else {
    const grid = root.createDiv({ cls: "ed-project-grid" });
    for (const p of visible) renderProjectCard(grid, ctx, p, !!opts.readOnly);
  }

  if (opts.readOnly) return;

  // ---- add project
  const addRow = root.createDiv({ cls: "ed-add-row" });
  const addBtn = addRow.createEl("button", { cls: "ed-btn ed-btn-ghost" });
  setIcon(addBtn, "plus");
  addBtn.createSpan({ text: cn ? " 新增项目" : " New project" });
  addBtn.onclick = () => {
    new ProjectEditModal(ctx.app, ctx.settings.lang, {
      title: { cn: "新增项目", en: "New project" },
      initial: {
        name: "",
        status: "active",
        priority: "medium",
        progress: 0,
        dueDate: null,
        note: null,
      },
      onSubmit: async (draft: ProjectDraft) => {
        if (await addProject(storeOf(ctx), draft)) ctx.refresh();
      },
    }).open();
  };
}

function renderProjectCard(
  grid: HTMLElement,
  ctx: Ctx,
  p: ProjectItem,
  readOnly: boolean
) {
  const cn = ctx.settings.lang !== "en";
  const cardEl = grid.createDiv({ cls: "ed-project-card" });
  if (p.status === "done") cardEl.addClass("is-done");
  if (!readOnly) {
    makeDraggable(cardEl, p.id, "projects", "x", async (dragged, after) => {
      if (await moveProject(storeOf(ctx), dragged, p.id, after)) ctx.refresh();
    });
  }

  const header = cardEl.createDiv({ cls: "ed-project-header" });
  header.createDiv({ cls: "ed-project-name", text: p.name });
  // Always visible (not hover-only like the pencil): it's the way *into*
  // the project's page, on the overview too.
  renderNoteButton(header, ctx.app, ctx.settings.lang, p.note);
  if (p.status !== "done") {
    renderFocusPlay(header, ctx, ctx.focus, { kind: "project", id: p.id, name: p.name });
  }

  if (readOnly) {
    renderProjectBody(cardEl, p, false, ctx, readOnly);
    return;
  }

  const editBtn = header.createEl("button", { cls: "ed-task-icon" });
  setIcon(editBtn, "pencil");
  editBtn.setAttr("aria-label", cn ? "编辑项目" : "Edit project");
  editBtn.onclick = () => {
    new ProjectEditModal(ctx.app, ctx.settings.lang, {
      title: { cn: "编辑项目", en: "Edit project" },
      initial: {
        name: p.name,
        status: p.status,
        priority: p.priority,
        progress: p.progress,
        dueDate: p.dueDate,
        note: p.note,
      },
      onSubmit: async (draft) => {
        if (await updateProject(storeOf(ctx), p, draft)) ctx.refresh();
      },
      onDelete: async () => {
        const store = storeOf(ctx);
        const removed = await deleteProject(store, p);
        if (!removed) return;
        ctx.refresh();
        notifyUndo(ctx.t.projectDeleted, ctx.t.undo, async () => {
          await restoreProject(store, removed);
          ctx.refresh();
        });
      },
    }).open();
  };

  renderProjectBody(cardEl, p, true, ctx, readOnly);
}

/** Priority chip, status chip and progress bar — interactive unless read-only. */
function renderProjectBody(
  cardEl: HTMLElement,
  p: ProjectItem,
  interactive: boolean,
  ctx: Ctx,
  readOnly: boolean
) {
  const cn = ctx.settings.lang !== "en";

  const meta = cardEl.createDiv({ cls: "ed-project-meta" });
  const prio = meta.createSpan({ cls: "ed-project-badge", text: p.priority });
  prio.style.background = PRIORITY_COLOR[p.priority] || "#8A9BA3";

  const statusChip = meta.createSpan({
    cls: "ed-project-status",
    text: `${STATUS_ICON[p.status] || "⚪"} ${p.status}`,
  });
  const focused = ctx.focus.targetTotal({ kind: "project", id: p.id });
  if (focused > 0) {
    meta.createSpan({
      cls: "ed-project-focus",
      text: `⏱ ${formatShort(focused)}`,
      title: ctx.t.focusTargetTotal(focused),
    });
  }

  const barWrap = cardEl.createDiv({ cls: "ed-progress" });
  const track = barWrap.createDiv({ cls: "ed-progress-track" });
  const fill = track.createDiv({ cls: "ed-progress-fill" });
  fill.style.width = `${p.progress}%`;
  const label = barWrap.createSpan({ cls: "ed-progress-label", text: `${p.progress}%` });

  if (readOnly || !interactive) return;

  // Clicking the status chip cycles it, so the common tweak needs no modal.
  statusChip.addClass("is-clickable");
  statusChip.setAttr("aria-label", cn ? "点击切换状态" : "Click to cycle status");
  statusChip.onclick = async () => {
    const order = ["active", "paused", "backlog", "done"];
    const next = order[(order.indexOf(p.status) + 1) % order.length];
    if (await updateProject(storeOf(ctx), p, { status: next })) ctx.refresh();
  };

  track.addClass("is-clickable");
  track.setAttr("aria-label", cn ? "点击设置进度" : "Click to set progress");
  track.onclick = async (e: MouseEvent) => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const pct = Math.max(0, Math.min(100, Math.round((ratio * 100) / 5) * 5));
    fill.style.width = `${pct}%`;
    label.setText(`${pct}%`);
    if (await updateProject(storeOf(ctx), p, { progress: pct })) ctx.refresh();
  };
}
