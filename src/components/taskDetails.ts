import { Notice, setIcon } from "obsidian";
import { TaskBuckets, TaskItem } from "../types";
import { Ctx, card, notifyUndo, renderFocusPlay } from "../ui";
import { TaskEditModal } from "../modals";
import { renderNoteButton } from "../noteLink";
import { makeDraggable } from "../dnd";
import {
  Store,
  TaskDraft,
  addTask,
  deleteTask,
  listSections,
  moveTask,
  restoreTask,
  setTaskDone,
  updateTask,
} from "../mutations";

interface ColumnSpec {
  key: "today" | "todo" | "done";
  title: string;
  accent: string;
  tasks: TaskItem[];
  emptyText: string;
  strike?: boolean;
}

export interface TaskDetailsOptions {
  /** Show every task instead of the per-column cap — used by the Tasks page. */
  full?: boolean;
  /** Display only: no checkboxes, no edit buttons, no add row. */
  readOnly?: boolean;
}

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

/** Tasks-page filter, module-level so a refresh keeps it. */
const filter = { text: "", section: "", highOnly: false, dueOnly: false };

function matches(task: TaskItem): boolean {
  if (filter.section && task.section !== filter.section) return false;
  if (filter.highOnly && task.priority !== "high") return false;
  if (filter.dueOnly && !task.dueDate) return false;
  if (filter.text) {
    const q = filter.text.toLowerCase();
    const hay = `${task.name}\n${task.notes}\n${task.tags.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function filterActive(): boolean {
  return !!(filter.text || filter.section || filter.highOnly || filter.dueOnly);
}

/** Search box, section dropdown and two toggles above the columns on the Tasks page. */
function renderFilterBar(root: HTMLElement, ctx: Ctx) {
  const cn = ctx.settings.lang !== "en";
  const bar = root.createDiv({ cls: "ed-task-filter" });
  const input = bar.createEl("input", { cls: "ed-add-input ed-task-filter-text", type: "search" });
  input.placeholder = cn ? "搜索任务、备注、标签…" : "Search tasks, notes, tags…";
  input.value = filter.text;
  let timer: number | null = null;
  input.oninput = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      filter.text = input.value.trim();
      ctx.refresh();
    }, 200);
  };
  const sel = bar.createEl("select", { cls: "ed-add-section" });
  sel.createEl("option", { value: "", text: cn ? "全部分区" : "All sections" });
  for (const s of listSections(storeOf(ctx))) sel.createEl("option", { value: s, text: s });
  sel.value = filter.section;
  sel.onchange = () => {
    filter.section = sel.value;
    ctx.refresh();
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = bar.createEl("button", { cls: "ed-btn ed-btn-compact ed-task-filter-toggle", text: label });
    b.toggleClass("is-active", get());
    b.onclick = () => {
      set(!get());
      ctx.refresh();
    };
  };
  toggle(cn ? "高优先级" : "High priority", () => filter.highOnly, (v) => (filter.highOnly = v));
  toggle(cn ? "有到期日" : "Has due date", () => filter.dueOnly, (v) => (filter.dueOnly = v));
  if (filterActive()) {
    const clear = bar.createEl("button", { cls: "ed-btn ed-btn-compact", text: cn ? "清除" : "Clear" });
    clear.onclick = () => {
      filter.text = "";
      filter.section = "";
      filter.highOnly = false;
      filter.dueOnly = false;
      ctx.refresh();
    };
  }
  // Keep the caret where it was: the bar is rebuilt on every refresh.
  if (document.activeElement === null || document.activeElement === document.body) {
    if (filter.text) window.setTimeout(() => input.focus(), 0);
  }
}

/** Deadlines a task can be filed under: not done, soonest first. */
export function openDeadlines(ctx: Ctx) {
  return ctx.settings.deadlines
    .filter((d) => !d.done)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ id: d.id, title: d.title, date: d.date }));
}

/** The "⏳ exam" chip on a row whose task is preparation for a deadline. */
function renderDeadlineChip(parent: HTMLElement, ctx: Ctx, task: TaskItem) {
  if (!task.deadlineId) return;
  const dl = ctx.settings.deadlines.find((d) => d.id === task.deadlineId);
  if (!dl) return;
  parent.createSpan({ cls: "ed-task-deadline", text: `⏳ ${dl.title}`, title: `${dl.title} · ${dl.date}` });
}

/** Task ids whose notes are unfolded — module-level so a refresh keeps them open. */
const openNotes = new Set<string>();

/**
 * The ≡ toggle and the notes block under the row. The block is a full-width
 * flex child (`.ed-task-item` wraps), so it sits beneath text and actions
 * without a wrapper element for every task that has no notes at all.
 */
function renderTaskNotes(item: HTMLElement, actions: HTMLElement, ctx: Ctx, task: TaskItem) {
  if (!task.notes) return;
  const cn = ctx.settings.lang !== "en";
  const btn = actions.createEl("button", { cls: "ed-task-icon ed-task-notes-toggle" });
  setIcon(btn, "align-left");
  btn.setAttr("aria-label", cn ? "备注" : "Notes");
  btn.setAttr("title", task.notes);
  const block = item.createDiv({ cls: "ed-task-notes", text: task.notes });
  const sync = () => {
    const open = openNotes.has(task.id);
    block.toggle(open);
    btn.toggleClass("is-on", open);
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    if (openNotes.has(task.id)) openNotes.delete(task.id);
    else openNotes.add(task.id);
    sync();
  };
  sync();
}

export function renderTaskDetails(
  parent: HTMLElement,
  ctx: Ctx,
  buckets: TaskBuckets,
  opts: TaskDetailsOptions = {}
) {
  const { t, settings } = ctx;
  const root = card(parent, opts.full ? `📋 ${t.allTasks}` : `📋 ${t.taskDetails}`);
  if (opts.full) root.addClass("ed-tasks-full");

  const limit = opts.full ? Number.MAX_SAFE_INTEGER : settings.taskLimit;
  // The filter only exists on the full Tasks page; the overview card is a report.
  const pick = (list: TaskItem[]) =>
    (opts.full ? list.filter(matches) : list).slice(0, limit);
  if (opts.full) renderFilterBar(root, ctx);
  const columns: ColumnSpec[] = [
    {
      key: "today",
      title: `🎯 ${t.today}`,
      accent: "#F0A868",
      tasks: pick(buckets.today),
      emptyText: t.noTodayTasks,
    },
    {
      key: "todo",
      title: `📝 ${t.todo}`,
      accent: "#8FB8D9",
      tasks: pick(buckets.todo),
      emptyText: t.noTodoTasks,
    },
    {
      key: "done",
      title: `✅ ${t.done}`,
      accent: "#C8AADC",
      tasks: pick(buckets.done),
      emptyText: t.noDoneTasks,
      strike: true,
    },
  ];

  const grid = root.createDiv({ cls: "ed-task-grid" });

  for (const col of columns) {
    const colEl = grid.createDiv({ cls: "ed-task-col" });
    colEl.style.setProperty("--ed-col-accent", col.accent);

    const head = colEl.createDiv({ cls: "ed-task-head" });
    head.createSpan({ text: col.title });
    head.createSpan({ cls: "ed-task-count", text: String(col.tasks.length) });

    const list = colEl.createDiv({ cls: "ed-task-list" });
    if (col.tasks.length === 0) {
      list.createDiv({ cls: "ed-task-empty", text: col.emptyText });
      continue;
    }
    for (const task of col.tasks) {
      renderTaskRow(list, ctx, task, !!col.strike, !!opts.readOnly, col.key);
    }
  }

  // Hidden-but-kept completions, only on the full Tasks page and only as a
  // collapsed fold: out of the way, never out of reach (to un-check or edit).
  if (opts.full && buckets.archived.length > 0) {
    const fold = root.createEl("details", { cls: "ed-task-archive" });
    fold.createEl("summary", { text: t.taskArchived(buckets.archived.length) });
    const list = fold.createDiv({ cls: "ed-task-list ed-task-archive-list" });
    for (const task of buckets.archived) {
      renderTaskRow(list, ctx, task, true, !!opts.readOnly, "done");
    }
  }

  if (!opts.readOnly) renderAddRow(root, ctx);
}

function renderTaskRow(
  list: HTMLElement,
  ctx: Ctx,
  task: TaskItem,
  strike: boolean,
  readOnly: boolean,
  column: ColumnSpec["key"]
) {
  const item = list.createDiv({ cls: "ed-task-item" });
  // Done is sorted by completion date, so there is nothing to reorder there.
  if (!readOnly && column !== "done") {
    makeDraggable(item, task.id, `tasks:${column}`, "y", async (dragged, after) => {
      if (await moveTask(storeOf(ctx), dragged, task.id, after)) ctx.refresh();
    });
  }
  if (strike) item.addClass("is-done");
  if (task.priority === "high") item.addClass("is-high");
  if (readOnly) item.addClass("is-readonly");

  if (readOnly) {
    // Static glyph instead of a control, so the overview reads as a report.
    item.createSpan({ cls: "ed-task-glyph", text: task.done ? "✓" : "○" });
    item.createSpan({ cls: "ed-task-text" }).setText(
      `${task.pinned ? "📌 " : ""}${task.repeat !== "none" ? "🔁 " : ""}${task.name}`
    );
    if (task.dueDate && !strike) {
      item.createSpan({ cls: "ed-task-date", text: task.dueDate.slice(5) });
    }
    // The two controls the read-only overview keeps: opening the note and
    // unfolding the notes are navigation / reading, not editing.
    const ro = item.createDiv({ cls: "ed-task-actions" });
    renderDeadlineChip(ro, ctx, task);
    renderNoteButton(ro, ctx.app, ctx.settings.lang, task.note);
    renderTaskNotes(item, ro, ctx, task);
    return;
  }

  const box = item.createEl("input", { cls: "ed-task-check", type: "checkbox" });
  box.checked = task.done;

  item.createSpan({ cls: "ed-task-text" }).setText(
    `${task.pinned ? "📌 " : ""}${task.repeat !== "none" ? "🔁 " : ""}${task.name}`
  );

  box.onclick = async (e) => {
    e.stopPropagation();
    const next = box.checked;
    // Optimistic: reflect the click immediately, then reconcile with storage.
    item.toggleClass("is-done", next);
    box.disabled = true;
    const ok = await setTaskDone(storeOf(ctx), task, next);
    box.disabled = false;
    if (!ok) {
      box.checked = !next;
      item.toggleClass("is-done", !next);
      return;
    }
    if (ok.spawnedDue) new Notice(ctx.t.taskRepeatedNotice(ok.spawnedDue), 4000);
    ctx.refresh();
  };

  const actions = item.createDiv({ cls: "ed-task-actions" });
  if (task.dueDate && !strike) {
    actions.createSpan({ cls: "ed-task-date", text: task.dueDate.slice(5) });
  }
  renderDeadlineChip(actions, ctx, task);
  renderNoteButton(actions, ctx.app, ctx.settings.lang, task.note);
  renderTaskNotes(item, actions, ctx, task);
  const focused = ctx.focus.targetTotal({ kind: "task", id: task.id });
  if (focused > 0) {
    actions.createSpan({ cls: "ed-task-focus", text: `⏱ ${focused}${ctx.t.minuteUnitShort}` });
  }
  if (!strike) {
    renderFocusPlay(actions, ctx, ctx.focus, { kind: "task", id: task.id, name: task.name });
  }

  const editBtn = actions.createEl("button", { cls: "ed-task-icon" });
  setIcon(editBtn, "pencil");
  editBtn.setAttr("aria-label", ctx.settings.lang === "en" ? "Edit" : "编辑");
  editBtn.onclick = (e) => {
    e.stopPropagation();
    openEditModal(ctx, task);
  };
}

function openEditModal(ctx: Ctx, task: TaskItem) {
  const initial: TaskDraft = {
    text: task.name,
    priority: task.priority,
    pinned: task.pinned,
    dueDate: task.dueDate,
    note: task.note,
    repeat: task.repeat,
    repeatDays: [...task.repeatDays],
    notes: task.notes,
    deadlineId: task.deadlineId,
  };
  new TaskEditModal(ctx.app, ctx.settings.lang, {
    title: { cn: "编辑任务", en: "Edit task" },
    initial,
    deadlines: openDeadlines(ctx),
    onSubmit: async (draft) => {
      if (await updateTask(storeOf(ctx), task, draft)) ctx.refresh();
    },
    onDelete: async () => {
      const store = storeOf(ctx);
      const removed = await deleteTask(store, task);
      if (!removed) return;
      ctx.refresh();
      notifyUndo(ctx.t.taskDeleted, ctx.t.undo, async () => {
        await restoreTask(store, removed);
        ctx.refresh();
      });
    },
  }).open();
}

function renderAddRow(root: HTMLElement, ctx: Ctx) {
  const cn = ctx.settings.lang !== "en";
  const store = storeOf(ctx);
  const sections = listSections(store);

  const row = root.createDiv({ cls: "ed-add-row" });
  const input = row.createEl("input", { cls: "ed-add-input", type: "text" });
  input.placeholder = cn ? "新增任务，回车添加…" : "New task, press Enter…";

  const sectionSelect = row.createEl("select", { cls: "ed-add-section" });
  if (sections.length === 0) {
    sectionSelect.createEl("option", { value: "", text: cn ? "未分类" : "Uncategorised" });
  } else {
    sections.forEach((s) => sectionSelect.createEl("option", { value: s, text: s }));
    const todayish = sections.find((s) => /今日|今天|today/i.test(s));
    if (todayish) sectionSelect.value = todayish;
  }

  const moreBtn = row.createEl("button", { cls: "ed-btn ed-btn-compact" });
  setIcon(moreBtn, "settings-2");
  moreBtn.setAttr("aria-label", cn ? "更多选项" : "More options");

  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;
    const draft: TaskDraft = {
      text,
      priority: "normal",
      pinned: false,
      dueDate: null,
      note: null,
      repeat: "none",
      repeatDays: [],
      notes: "",
      deadlineId: null,
    };
    if (await addTask(store, sectionSelect.value, draft)) {
      input.value = "";
      ctx.refresh();
    }
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  });

  moreBtn.onclick = () => {
    new TaskEditModal(ctx.app, ctx.settings.lang, {
      title: { cn: "新增任务", en: "New task" },
      initial: {
        text: input.value.trim(),
        priority: "normal",
        pinned: false,
        dueDate: null,
        note: null,
        repeat: "none",
        repeatDays: [],
        notes: "",
        deadlineId: null,
      },
      sections: sections.length > 0 ? sections : undefined,
      initialSection: sectionSelect.value,
      deadlines: openDeadlines(ctx),
      onSubmit: async (draft, section) => {
        if (await addTask(store, section, draft)) {
          input.value = "";
          ctx.refresh();
        }
      },
    }).open();
  };
}
