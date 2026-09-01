import { Notice } from "obsidian";
import {
  DashboardSettings,
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
