import { Notice, setIcon } from "obsidian";
import { TaskBuckets, TaskItem } from "../types";
import { Ctx, card } from "../ui";
import { TaskEditModal } from "../modals";
import {
  Store,
  TaskDraft,
  addTask,
  deleteTask,
  listSections,
  setTaskDone,
  updateTask,
} from "../mutations";

interface ColumnSpec {
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
  const columns: ColumnSpec[] = [
    {
      title: `🎯 ${t.today}`,
      accent: "#F0A868",
      tasks: buckets.today.slice(0, limit),
      emptyText: t.noTodayTasks,
    },
    {
      title: `📝 ${t.todo}`,
      accent: "#8FB8D9",
      tasks: buckets.todo.slice(0, limit),
      emptyText: t.noTodoTasks,
    },
    {
      title: `✅ ${t.done}`,
      accent: "#C8AADC",
      tasks: buckets.done.slice(0, limit),
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
      renderTaskRow(list, ctx, task, !!col.strike, !!opts.readOnly);
    }
  }

  if (!opts.readOnly) renderAddRow(root, ctx);
}

function renderTaskRow(
  list: HTMLElement,
  ctx: Ctx,
  task: TaskItem,
  strike: boolean,
  readOnly: boolean
) {
  const item = list.createDiv({ cls: "ed-task-item" });
  if (strike) item.addClass("is-done");
  if (task.priority === "high") item.addClass("is-high");
  if (readOnly) item.addClass("is-readonly");

  if (readOnly) {
    // Static glyph instead of a control, so the overview reads as a report.
    item.createSpan({ cls: "ed-task-glyph", text: task.done ? "✓" : "○" });
    item.createSpan({ cls: "ed-task-text" }).setText(
      `${task.pinned ? "📌 " : ""}${task.name}`
    );
    if (task.dueDate && !strike) {
      item.createSpan({ cls: "ed-task-date", text: task.dueDate.slice(5) });
    }
    return;
  }

  const box = item.createEl("input", { cls: "ed-task-check", type: "checkbox" });
  box.checked = task.done;

  item.createSpan({ cls: "ed-task-text" }).setText(
    `${task.pinned ? "📌 " : ""}${task.name}`
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
    ctx.refresh();
  };

  const actions = item.createDiv({ cls: "ed-task-actions" });
  if (task.dueDate && !strike) {
    actions.createSpan({ cls: "ed-task-date", text: task.dueDate.slice(5) });
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
  };
  new TaskEditModal(ctx.app, ctx.settings.lang, {
    title: { cn: "编辑任务", en: "Edit task" },
    initial,
    onSubmit: async (draft) => {
      if (await updateTask(storeOf(ctx), task, draft)) ctx.refresh();
    },
    onDelete: async () => {
      if (await deleteTask(storeOf(ctx), task)) {
        new Notice(ctx.settings.lang === "en" ? "Task deleted" : "已删除任务");
        ctx.refresh();
      }
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
    const draft: TaskDraft = { text, priority: "normal", pinned: false, dueDate: null };
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
      },
      sections: sections.length > 0 ? sections : undefined,
      initialSection: sectionSelect.value,
      onSubmit: async (draft, section) => {
        if (await addTask(store, section, draft)) {
          input.value = "";
          ctx.refresh();
        }
      },
    }).open();
  };
}
