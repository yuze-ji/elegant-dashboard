import { Notice } from "obsidian";
import {
  DashboardSettings,
  DeadlineItem,
  HabitItem,
  ProjectItem,
  StoredProject,
  StoredTask,
  TaskItem,
  newId,
} from "./types";
import { toKey } from "./dates";

/**
 * Tasks and projects live in the plugin's own data.json. Every mutation edits
 * the in-memory arrays and then persists, so there are no markdown files to
 * parse, no stale line numbers, and no clobbering of concurrent editor edits.
 */

export interface Store {
  settings: DashboardSettings;
  save: () => Promise<void>;
}

export interface TaskDraft {
  text: string;
  priority: "high" | "normal";
  pinned: boolean;
  dueDate: string | null;
}

function findTask(store: Store, task: TaskItem): StoredTask | null {
  if (!task.id) return null;
  return store.settings.storedTasks.find((t) => t.id === task.id) ?? null;
}

function missing(): false {
  new Notice("⚠️ 找不到该条目，请刷新仪表板");
  return false;
}

// -------------------------------------------------------------------- tasks

export async function setTaskDone(
  store: Store,
  task: TaskItem,
  done: boolean
): Promise<boolean> {
  const target = findTask(store, task);
  if (!target) return missing();

  // No-op when already in the requested state, so an existing completion date
  // is never overwritten with today's.
  if (target.done === done && (!done || target.doneDate)) return true;

  target.done = done;
  target.doneDate = done ? target.doneDate ?? toKey(new Date()) : null;
  await store.save();
  return true;
}

export async function updateTask(
  store: Store,
  task: TaskItem,
  draft: TaskDraft
): Promise<boolean> {
  const target = findTask(store, task);
  if (!target) return missing();

  const text = draft.text.trim();
  if (!text) return false;

  target.text = text;
  target.priority = draft.priority;
  target.pinned = draft.pinned;
  target.dueDate = draft.dueDate;
  target.tags = draft.priority === "high" ? ["priority/high"] : [];
  await store.save();
  return true;
}

export async function deleteTask(store: Store, task: TaskItem): Promise<boolean> {
  const idx = store.settings.storedTasks.findIndex((t) => t.id === task.id);
  if (idx === -1) return missing();
  store.settings.storedTasks.splice(idx, 1);
  await store.save();
  return true;
}

export async function addTask(
  store: Store,
  section: string,
  draft: TaskDraft
): Promise<boolean> {
  const text = draft.text.trim();
  if (!text) return false;

  store.settings.storedTasks.push({
    id: newId(),
    text,
    done: false,
    doneDate: null,
    dueDate: draft.dueDate,
    pinned: draft.pinned,
    priority: draft.priority,
    tags: draft.priority === "high" ? ["priority/high"] : [],
    section: section || store.settings.taskSections[0] || "",
  });
  await store.save();
  return true;
}

export function listSections(store: Store): string[] {
  const fromTasks = new Set(
    store.settings.storedTasks.map((t) => t.section).filter(Boolean)
  );
  const merged = [...store.settings.taskSections];
  fromTasks.forEach((s) => {
    if (!merged.includes(s)) merged.push(s);
  });
  return merged;
}

// ------------------------------------------------------------------ projects

function findProject(store: Store, project: ProjectItem): StoredProject | null {
  if (!project.id) return null;
  return store.settings.storedProjects.find((p) => p.id === project.id) ?? null;
}

export async function updateProject(
  store: Store,
  project: ProjectItem,
  patch: Partial<Omit<ProjectItem, "id">>
): Promise<boolean> {
  const target = findProject(store, project);
  if (!target) return missing();

  if (patch.name !== undefined) target.name = patch.name.trim() || target.name;
  if (patch.status !== undefined) target.status = patch.status;
  if (patch.priority !== undefined) target.priority = patch.priority;
  if (patch.progress !== undefined) {
    target.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
  }
  await store.save();
  return true;
}

export async function deleteProject(
  store: Store,
  project: ProjectItem
): Promise<boolean> {
  const idx = store.settings.storedProjects.findIndex((p) => p.id === project.id);
  if (idx === -1) return missing();
  store.settings.storedProjects.splice(idx, 1);
  await store.save();
  return true;
}

export async function addProject(
  store: Store,
  project: { name: string; status: string; priority: string; progress: number }
): Promise<boolean> {
  const name = project.name.trim();
  if (!name) return false;

  store.settings.storedProjects.push({
    id: newId(),
    name,
    status: project.status,
    priority: project.priority,
    progress: Math.max(0, Math.min(100, Math.round(project.progress))),
  });
  await store.save();
  return true;
}

// ----------------------------------------------------------------- deadlines

export async function addDeadline(
  store: Store,
  title: string,
  date: string
): Promise<boolean> {
  const t = title.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  store.settings.deadlines.push({ id: newId(), title: t, date });
  await store.save();
  return true;
}

export async function updateDeadline(
  store: Store,
  id: string,
  patch: Partial<Omit<DeadlineItem, "id">>
): Promise<boolean> {
  const target = store.settings.deadlines.find((d) => d.id === id);
  if (!target) return missing();
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return false;
    target.title = t;
  }
  if (patch.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) return false;
    target.date = patch.date;
  }
  await store.save();
  return true;
}

export async function deleteDeadline(store: Store, id: string): Promise<boolean> {
  const idx = store.settings.deadlines.findIndex((d) => d.id === id);
  if (idx === -1) return missing();
  store.settings.deadlines.splice(idx, 1);
  await store.save();
  return true;
}

// -------------------------------------------------------------------- habits

export async function addHabit(store: Store, name: string): Promise<boolean> {
  const n = name.trim();
  if (!n) return false;
  store.settings.habits.push({ id: newId(), name: n });
  await store.save();
  return true;
}

export async function renameHabit(
  store: Store,
  id: string,
  name: string
): Promise<boolean> {
  const target = store.settings.habits.find((h) => h.id === id);
  if (!target) return missing();
  const n = name.trim();
  if (!n) return false;
  target.name = n;
  await store.save();
  return true;
}

export async function deleteHabit(store: Store, id: string): Promise<boolean> {
  const idx = store.settings.habits.findIndex((h) => h.id === id);
  if (idx === -1) return missing();
  store.settings.habits.splice(idx, 1);
  delete store.settings.habitLog[id];
  await store.save();
  return true;
}

/** Toggles a single day for a habit. `dateKey` is YYYY-MM-DD. */
export async function toggleHabitDay(
  store: Store,
  habitId: string,
  dateKey: string
): Promise<boolean> {
  if (!store.settings.habits.some((h) => h.id === habitId)) return missing();
  const log = (store.settings.habitLog[habitId] ??= {});
  if (log[dateKey]) delete log[dateKey];
  else log[dateKey] = true;
  await store.save();
  return true;
}
