export type Lang = "cn" | "en";

export type ModuleId =
  | "activity"
  | "focus"
  | "projects"
  | "taskboard"
  | "taskDetails"
  | "recent"
  | "stats"
  | "charts"
  | "plugins";

export const MODULE_ORDER: ModuleId[] = [
  "activity",
  "focus",
  "projects",
  "taskboard",
  "taskDetails",
  "recent",
  "stats",
  "charts",
  "plugins",
];

export interface DashboardSettings {
  lang: Lang;
  /** Folder scanned for task/project source notes. */
  dashboardFolder: string;
  /** Only notes whose basename contains this string are parsed for tasks. Empty = all. */
  taskFileFilter: string;
  focusDefaultMinutes: number;
  taskTargetToday: number;
  taskTargetWeek: number;
  taskTargetMonth: number;
  taskLimit: number;
  recentLimit: number;
  backgroundImage: string;
  backgroundOpacity: number;
  /** 0 = fully transparent cards (background shows through), 1 = full glass tint. */
  cardOpacity: number;
  /** Frosted "liquid glass" treatment on cards and the navbar. */
  liquidGlass: boolean;
  /** Backdrop blur radius in px when liquidGlass is on. */
  glassBlur: number;
  modules: Record<ModuleId, boolean>;
  /** date (YYYY-MM-DD) -> minutes focused */
  focusLog: Record<string, number>;
  migratedFocusFromLocalStorage: boolean;
  /** Auto-create the data notes on first load. */
  scaffoldOnInstall: boolean;
  /** Set once the scaffold has run, so deleting the notes does not resurrect them. */
  scaffolded: boolean;
  /** "markdown" reads/writes the notes; "plugin" keeps everything in data.json. */
  storageMode: StorageMode;
  storedTasks: StoredTask[];
  storedProjects: StoredProject[];
  /** Section names offered when adding a task in plugin storage. */
  taskSections: string[];
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  lang: "cn",
  dashboardFolder: "Dashboard",
  taskFileFilter: "List",
  focusDefaultMinutes: 25,
  taskTargetToday: 5,
  taskTargetWeek: 25,
  taskTargetMonth: 100,
  taskLimit: 15,
  recentLimit: 5,
  backgroundImage: "",
  backgroundOpacity: 0.18,
  cardOpacity: 1,
  liquidGlass: true,
  glassBlur: 24,
  modules: {
    activity: true,
    focus: true,
    projects: true,
    taskboard: true,
    taskDetails: true,
    recent: true,
    stats: true,
    charts: true,
    plugins: true,
  },
  focusLog: {},
  migratedFocusFromLocalStorage: false,
  scaffoldOnInstall: false,
  scaffolded: true,
  storageMode: "plugin",
  storedTasks: [],
  storedProjects: [],
  taskSections: ["今日任务", "本周任务", "本月任务", "长期目标"],
};

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Where tasks and projects live. */
export type StorageMode = "markdown" | "plugin";

export interface StoredTask {
  id: string;
  text: string;
  done: boolean;
  doneDate: string | null;
  dueDate: string | null;
  pinned: boolean;
  priority: "high" | "normal";
  tags: string[];
  section: string;
}

export interface StoredProject {
  id: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
}

export interface ProjectItem {
  name: string;
  status: "active" | "paused" | "done" | "backlog" | string;
  priority: "high" | "medium" | "low" | string;
  progress: number;
  /** Note whose frontmatter this project came from; empty in plugin storage. */
  sourcePath: string;
  /** Position inside that note's `projects` array, for in-place edits. */
  index: number;
  /** Stable id when stored in the plugin; null when parsed from markdown. */
  id: string | null;
}

export const PROJECT_STATUSES = ["active", "paused", "done", "backlog"] as const;
export const PROJECT_PRIORITIES = ["high", "medium", "low"] as const;

export interface TaskItem {
  name: string;
  raw: string;
  done: boolean;
  pinned: boolean;
  priority: "high" | "normal";
  tags: string[];
  doneDate: string | null;
  dueDate: string | null;
  section: string;
  /** Source note; empty when the task lives in plugin storage. */
  path: string;
  line: number;
  /** Stable id when stored in the plugin; null when parsed from markdown. */
  id: string | null;
}

export interface TaskBuckets {
  today: TaskItem[];
  todo: TaskItem[];
  done: TaskItem[];
}

export interface ActivityData {
  /** YYYY-MM-DD -> number of files modified that day */
  modified: Record<string, number>;
  /** YYYY-MM-DD -> names of files created that day */
  created: Record<string, string[]>;
}

export interface VaultStats {
  noteCount: number;
  wordCount: number;
  linkCount: number;
  monthlyWords: Record<string, number>;
  topTags: Array<[string, number]>;
}
