export type Lang = "cn" | "en";

export type ModuleId =
  | "clock"
  | "today"
  | "deadlines"
  | "activity"
  | "habits"
  | "focus"
  | "projects"
  | "taskboard"
  | "taskDetails"
  | "recent"
  | "stats"
  | "charts";

export const MODULE_ORDER: ModuleId[] = [
  "clock",
  "today",
  "deadlines",
  "activity",
  "habits",
  "focus",
  "projects",
  "taskboard",
  "taskDetails",
  "recent",
  "stats",
  "charts",
];

/**
 * Modules narrow enough to share a row instead of each claiming a full-width
 * one. Consecutive *enabled* compact modules (in MODULE_ORDER) are grouped
 * into one responsive grid; anything not in this list — a heatmap, three
 * columns of tasks, a chart with its own internal columns, a deadline row
 * with four inline-editable fields — gets the full card width to itself.
 * Grouping is by position in MODULE_ORDER, so toggling a module on/off
 * reshuffles neighbouring groups automatically rather than needing new pairs
 * hand-picked every time.
 */
export const COMPACT_MODULES: ModuleId[] = [
  "clock",
  "today",
  "habits",
  "focus",
  "projects",
  "taskboard",
];

/**
 * Recent and Stats are pulled out of the generic compact-grid flow and
 * stacked in a narrow column beside Charts instead: two short cards next to
 * one taller one reads better than a wide gap under Recent (whose own
 * height rarely matches Stats' one-row-of-numbers height) with Charts
 * squeezed underneath, full-width, mostly empty at the sides.
 */
export const SIDEBAR_MODULES: ModuleId[] = ["recent", "stats"];

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

export interface DeadlineItem {
  id: string;
  title: string;
  /** YYYY-MM-DD. Deadlines are day-granularity, not timed events. */
  date: string;
  /** Fire a one-time reminder once this many days (or fewer) remain; null = off. */
  remindDaysBefore: number | null;
  /** Whether the reminder already fired for the current date/remindDaysBefore. */
  reminded: boolean;
}

export interface HabitItem {
  id: string;
  name: string;
  /** null = daily habit (streak = consecutive days). A number = "N times a
   *  week" (streak = consecutive weeks the target was met), for habits that
   *  were never meant to happen every single day. */
  targetPerWeek: number | null;
}

export interface DashboardSettings {
  lang: Lang;
  /** Opens the dashboard tab once the workspace layout has restored. */
  openOnStartup: boolean;
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
  deadlines: DeadlineItem[];
  habits: HabitItem[];
  /** habit id -> (date YYYY-MM-DD -> done) */
  habitLog: Record<string, Record<string, boolean>>;
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
  // Off by default: a plugin silently taking over the workspace on every
  // launch is the kind of thing that should be an opt-in, not a surprise.
  openOnStartup: false,
  focusDefaultMinutes: 25,
  focusClockStyle: "dial",
  clock24h: true,
  clockSeconds: true,
  clockShowDate: true,
  alarmSound: true,
  alarms: [],
  deadlines: [],
  habits: [],
  habitLog: {},
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
    today: true,
    deadlines: true,
    activity: true,
    habits: true,
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
