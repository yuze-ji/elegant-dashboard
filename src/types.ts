export type Lang = "cn" | "en";

export type ModuleId =
  | "clock"
  | "activity"
  | "focus"
  | "projects"
  | "taskboard"
  | "taskDetails"
  | "recent"
  | "stats"
  | "charts";

export const MODULE_ORDER: ModuleId[] = [
  "clock",
  "activity",
  "focus",
  "projects",
  "taskboard",
  "taskDetails",
  "recent",
  "stats",
  "charts",
];

/** How the focus timer draws its remaining time. */
export type FocusClockStyle = "dial" | "flip";

export interface AlarmItem {
  id: string;
  /** "HH:MM", always 24h regardless of the display setting. */
  time: string;
  label: string;
  enabled: boolean;
  /** ISO weekdays (1 = Mon … 7 = Sun) to ring on. Empty = every day. */
  days: number[];
  /** "YYYY-MM-DDTHH:MM" of the last ring, so one minute cannot fire twice. */
  lastFired: string | null;
}

export interface DashboardSettings {
  lang: Lang;
  focusDefaultMinutes: number;
  /** "dial" = canvas ring, "flip" = flip-clock digits. */
  focusClockStyle: FocusClockStyle;
  /** Clock module: 24-hour vs 12-hour display. */
  clock24h: boolean;
  /** Clock module: show the seconds pair. */
  clockSeconds: boolean;
  /** Clock module: show the date / weekday line. */
  clockShowDate: boolean;
  /** Play a tone when an alarm fires (in addition to the notice). */
  alarmSound: boolean;
  alarms: AlarmItem[];
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
  storedTasks: StoredTask[];
  storedProjects: StoredProject[];
  /** Section names offered when adding a task. */
  taskSections: string[];
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  lang: "cn",
  focusDefaultMinutes: 25,
  focusClockStyle: "dial",
  clock24h: true,
  clockSeconds: true,
  clockShowDate: true,
  alarmSound: true,
  alarms: [],
  taskTargetToday: 5,
  taskTargetWeek: 25,
  taskTargetMonth: 100,
  taskLimit: 15,
  recentLimit: 5,
  // Ships with the bundled Monet background switched on, so a fresh install
  // looks like the screenshots rather than a blank panel.
  backgroundImage: "@bundled",
  backgroundOpacity: 1,
  cardOpacity: 1,
  liquidGlass: true,
  glassBlur: 24,
  modules: {
    clock: true,
    activity: true,
    focus: true,
    projects: true,
    taskboard: true,
    taskDetails: true,
    recent: true,
    stats: true,
    charts: true,
  },
  focusLog: {},
  storedTasks: [],
  storedProjects: [],
  taskSections: ["今日任务", "本周任务", "本月任务", "长期目标"],
};

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  id: string;
}

export const PROJECT_STATUSES = ["active", "paused", "done", "backlog"] as const;
export const PROJECT_PRIORITIES = ["high", "medium", "low"] as const;

export interface TaskItem {
  name: string;
  done: boolean;
  pinned: boolean;
  priority: "high" | "normal";
  tags: string[];
  doneDate: string | null;
  dueDate: string | null;
  section: string;
  id: string;
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
