export type Lang = "cn" | "en";

export type ModuleId =
  | "clock"
  | "today"
  | "agenda"
  | "links"
  | "custom"
  | "deadlines"
  | "activity"
  | "habits"
  | "language"
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
  "agenda",
  "links",
  "custom",
  "deadlines",
  "activity",
  "habits",
  "language",
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
  "agenda",
  "links",
  "custom",
  "habits",
  "language",
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

/** A bookmark on the home page: http(s)://, obsidian://, or a vault note path. */
export interface HomeLink {
  id: string;
  label: string;
  url: string;
}

export type CustomItemKind = "link" | "note" | "folder" | "tag" | "command";

export interface CustomItem {
  id: string;
  label: string;
  /** Emoji, or a Lucide icon name; "" = picked by kind / host. */
  icon: string;
  kind: CustomItemKind;
  /** URL, note path, folder path, tag, or command id — per `kind`. */
  target: string;
}

export interface CustomPanel {
  id: string;
  title: string;
  items: CustomItem[];
}

export interface FocusTarget {
  kind: "task" | "project" | "habit";
  id: string;
  /** Snapshot of the task text / project / habit name, for display after deletion. */
  name: string;
}

export interface FocusTargetLog {
  kind: FocusTarget["kind"];
  id: string;
  name: string;
  /** date (YYYY-MM-DD) -> minutes */
  log: Record<string, number>;
}

export const focusTargetKey = (t: { kind: string; id: string }) => `${t.kind}:${t.id}`;

/**
 * Overview layout. "grid" = one-screen bento: every module in a fixed
 * 12-column grid that fills the viewport, cards scrolling internally.
 * "rows" = the original stacked rows, scrolling as a page.
 */
export type OverviewLayout = "home" | "grid" | "rows";

/**
 * Bento placement: render order and column span (of 12). Each row sums to
 * 12, so with everything enabled the grid is exactly four rows; a disabled
 * module leaves a gap that dense packing lets later cells fill. Row heights
 * are set in CSS (.ed-modules.is-bento) to match what each row holds:
 *   1. a short summary strip — clock, today, task rings, vault numbers
 *   2. the two working lists, tallest — deadlines and the three task columns
 *   3. the day's companions — agenda, habits, projects, focus timer
 *   4. the retrospective row — heatmap, charts, recent files
 */
export const BENTO_LAYOUT: Array<[ModuleId, number]> = [
  ["clock", 3],
  ["today", 3],
  ["taskboard", 3],
  ["stats", 3],
  ["deadlines", 5],
  ["taskDetails", 7],
  ["agenda", 3],
  ["habits", 3],
  ["projects", 3],
  ["focus", 3],
  ["activity", 4],
  ["charts", 5],
  ["recent", 3],
  ["links", 3],
  ["custom", 6],
  // Fifth row: the vocabulary card is a late addition and keeps the four
  // rows above exactly as documented rather than squeezing one of them.
  ["language", 3],
];

/** How the focus timer draws its remaining time. */
export type FocusClockStyle = "dial" | "flip";

export type AlarmRepeat = "daily" | "weekly" | "once";

export interface AlarmItem {
  id: string;
  /** "HH:MM", always 24h regardless of the display setting. */
  time: string;
  label: string;
  enabled: boolean;
  repeat: AlarmRepeat;
  /** YYYY-MM-DD for a one-time alarm; null for repeating alarms. */
  date: string | null;
  /** ISO weekdays (1 = Mon … 7 = Sun) to ring on. Empty = every day. */
  days: number[];
  /** "YYYY-MM-DDTHH:MM" of the last ring, so one minute cannot fire twice. */
  lastFired: string | null;
}

export interface DeadlineItem {
  id: string;
  title: string;
  /** YYYY-MM-DD. Urgency / countdown is day-granularity, driven by this alone. */
  date: string;
  /** Optional "HH:MM" (24h) note of *when* on that day — shown next to the
   *  date and used to order same-day items, but never changes the day count
   *  or when the reminder fires. null = no specific time. */
  time: string | null;
  /** Fire a one-time reminder once this many days (or fewer) remain; null = off. */
  remindDaysBefore: number | null;
  /** Fire a one-time reminder this many minutes before `date`+`time`; null =
   *  off. Only meaningful with a `time` set, and mutually exclusive with
   *  `remindDaysBefore` — one dropdown, one reminder. */
  remindMinutesBefore: number | null;
  /** Whether the reminder already fired for the current date/time/offset. */
  reminded: boolean;
  /** Vault path of a related note (see noteLink.ts); null = none. */
  note: string | null;
  /** UID of the calendar event this was imported from (see ics.ts); null if
   *  entered by hand. Re-syncing matches on it instead of duplicating. */
  icsUid: string | null;
  /** Checked off. Done items leave the countdown, the reminders and the
   *  Today card, and sit in a collapsed "done" section instead of being
   *  deleted — a finished exam is still worth seeing on the calendar. */
  done: boolean;
}

export interface HabitItem {
  id: string;
  name: string;
  /** null = daily habit (streak = consecutive days). A number = "N times a
   *  week" (streak = consecutive weeks the target was met), for habits that
   *  were never meant to happen every single day. */
  targetPerWeek: number | null;
  /** "HH:MM" for a reminder of this habit's own; null = covered by the
   *  global daily reminder (if that is on). A habit with its own time is
   *  left out of the global one, so nothing nags twice. */
  reminderTime: string | null;
}

/**
 * One vocabulary entry. Scheduling is a Leitner box ladder: a correct
 * answer moves the word up one box (and its next review further out, see
 * VOCAB_BOX_DAYS), a miss drops it back to box 0 — due again right away.
 */
export interface VocabItem {
  id: string;
  word: string;
  meaning: string;
  /** Example sentence or usage note; "" = none. */
  example: string;
  /** One of `vocabLanguages` (free text — a removed language just reads as
   *  an extra filter option until its words are moved or deleted). */
  lang: string;
  /** YYYY-MM-DD the word was added. */
  createdAt: string;
  /** 0 … VOCAB_BOX_DAYS.length-1; the top box counts as mastered. */
  box: number;
  /** YYYY-MM-DD of the next review; due when <= today. */
  due: string;
  /** Total answers given, right or wrong. */
  reviews: number;
  /** Wrong answers, for the hardest-words list. */
  lapses: number;
}

/** Days until the next review, by box. Box 0 = new / just missed = today. */
export const VOCAB_BOX_DAYS = [0, 1, 3, 7, 14, 30, 90];
export const VOCAB_MASTERED_BOX = VOCAB_BOX_DAYS.length - 1;

/** A day's study counters: cards answered and words added. */
export interface VocabDayLog {
  reviewed: number;
  added: number;
}

export interface DashboardSettings {
  lang: Lang;
  /** Opens the dashboard tab once the workspace layout has restored. */
  openOnStartup: boolean;
  /** Daily data.json snapshot under the vault's config dir (see backup.ts). */
  autoBackup: boolean;
  /** How many daily snapshots to keep. */
  autoBackupKeep: number;
  focusDefaultMinutes: number;
  /** Pomodoro lengths in minutes and the number of work rounds per long break. */
  pomodoroWork: number;
  pomodoroShort: number;
  pomodoroLong: number;
  pomodoroRounds: number;
  /** Roll straight into the next phase, or stop and wait for Start. */
  pomodoroAutoStart: boolean;
  /** "dial" = canvas ring, "flip" = flip-clock digits. */
  focusClockStyle: FocusClockStyle;
  overviewLayout: OverviewLayout;
  /** Home layout: banner image (URL or vault path; "" = the bundled painting). */
  homeBanner: string;
  /** Home layout: the line under the avatar; "" = a default by language. */
  homeMotto: string;
  /** Home layout: avatar — an image URL / vault path, or a short text / emoji. */
  homeAvatar: string;
  /** The Sites module's bookmarks (see components/links.ts). */
  homeLinks: HomeLink[];
  /** User-defined panels (see components/custom.ts). */
  customPanels: CustomPanel[];
  /** Clock module: 24-hour vs 12-hour display. */
  clock24h: boolean;
  /** Clock module: show the seconds pair. */
  clockSeconds: boolean;
  /** Clock module: show the date / weekday line. */
  clockShowDate: boolean;
  /** Play a tone when an alarm fires (in addition to the notice). */
  alarmSound: boolean;
  /** Language page: read kana / hangul / words aloud with system TTS. */
  speakAloud: boolean;
  alarms: AlarmItem[];
  deadlines: DeadlineItem[];
  habits: HabitItem[];
  /** Calendar subscription (https:// or webcal://) pulled into the deadlines. "" = none. */
  icsUrl: string;
  /** Comma-separated; only events whose title contains one are imported. "" = all. */
  icsKeywords: string;
  icsSyncOnStartup: boolean;
  /** YYYY-MM-DD of the last successful URL sync, so startup syncs once a day. */
  icsLastSync: string | null;
  /** UIDs of imported deadlines the user deleted — not re-created on the next sync. */
  icsDeletedUids: string[];
  /** habit id -> (date YYYY-MM-DD -> done) */
  habitLog: Record<string, Record<string, boolean>>;
  /** Off by default — a plugin nagging you daily should be opt-in. */
  habitReminderEnabled: boolean;
  /** "HH:MM", 24h. */
  habitReminderTime: string;
  /** YYYY-MM-DD of the last time the reminder fired, so it fires once a day. */
  habitReminderFiredDate: string | null;
  /** habit id -> YYYY-MM-DD its own reminder last fired. */
  habitReminderFiredById: Record<string, string>;
  /** The vocabulary deck (see components/language.ts). */
  vocab: VocabItem[];
  /** Languages offered when adding a word; the first is the default. */
  vocabLanguages: string[];
  /** Language picked the last time a word was added — the add form's
   *  default, so a run of Japanese words needn't re-pick Japanese each time.
   *  null / not in the list = the first language. */
  vocabLastLang: string | null;
  /** Daily goal: how many new words to add. 0 = no goal shown. */
  vocabNewPerDay: number;
  /** Daily goal: how many cards to answer. 0 = no goal shown. */
  vocabReviewPerDay: number;
  /** date (YYYY-MM-DD) -> that day's counters */
  vocabLog: Record<string, VocabDayLog>;
  /** Mirror the deck into one note per language (see vocabNotes.ts). */
  vocabNotesEnabled: boolean;
  /** Vault folder those notes live in. */
  vocabNotesFolder: string;
  /** Kana / hangul drill record, keyed "<script>:<char>" (see scripts.ts). */
  scriptLog: Record<string, { right: number; wrong: number }>;
  taskTargetToday: number;
  taskTargetWeek: number;
  taskTargetMonth: number;
  taskLimit: number;
  /** Days after completion before a task leaves the Done column (still
   *  counted in the stats, reachable under a fold on the Tasks page). 0 = never. */
  doneHideAfterDays: number;
  /** Days after completion before a task is deleted outright. 0 = never.
   *  Kept well past a month by default so "this month" totals stay honest. */
  donePurgeAfterDays: number;
  recentLimit: number;
  backgroundImage: string;
  backgroundOpacity: number;
  /** Gaussian blur on the background image, in px (0 = sharp). */
  backgroundBlur: number;
  /** 0 = fully transparent cards (background shows through), 1 = full glass tint. */
  cardOpacity: number;
  /** Frosted "liquid glass" treatment on cards and the navbar. */
  liquidGlass: boolean;
  /** Backdrop blur radius in px when liquidGlass is on. */
  glassBlur: number;
  modules: Record<ModuleId, boolean>;
  /** date (YYYY-MM-DD) -> minutes focused */
  focusLog: Record<string, number>;
  /**
   * Focus time attributed to a task or project, keyed "task:<id>" /
   * "project:<id>". Each entry carries the name as last seen, so time spent
   * on something since deleted still has a label in the breakdown. The
   * per-day log here is a subset of `focusLog` (untargeted sessions only
   * land in the latter).
   */
  focusTargets: Record<string, FocusTargetLog>;
  /** What the timer is currently attributed to; persists across reloads. */
  focusTarget: FocusTarget | null;
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
  // On by default: it costs a few KB a day and is the only thing standing
  // between a sync conflict and every task ever entered.
  autoBackup: true,
  autoBackupKeep: 7,
  focusDefaultMinutes: 25,
  pomodoroWork: 25,
  pomodoroShort: 5,
  pomodoroLong: 15,
  pomodoroRounds: 4,
  pomodoroAutoStart: true,
  focusClockStyle: "dial",
  overviewLayout: "home",
  homeBanner: "",
  homeMotto: "",
  homeAvatar: "🌿",
  homeLinks: [],
  customPanels: [],
  clock24h: true,
  clockSeconds: true,
  clockShowDate: true,
  alarmSound: true,
  speakAloud: true,
  alarms: [],
  deadlines: [],
  habits: [],
  icsUrl: "",
  icsKeywords: "Prüfung, Klausur, Exam",
  icsSyncOnStartup: true,
  icsLastSync: null,
  icsDeletedUids: [],
  habitLog: {},
  habitReminderEnabled: false,
  habitReminderTime: "21:00",
  habitReminderFiredDate: null,
  habitReminderFiredById: {},
  vocab: [],
  vocabLanguages: ["Deutsch", "English", "日本語", "한국어"],
  vocabLastLang: null,
  vocabNewPerDay: 5,
  vocabReviewPerDay: 20,
  vocabLog: {},
  vocabNotesEnabled: true,
  vocabNotesFolder: "Note/词汇表",
  scriptLog: {},
  taskTargetToday: 5,
  taskTargetWeek: 25,
  taskTargetMonth: 100,
  taskLimit: 15,
  doneHideAfterDays: 1,
  donePurgeAfterDays: 35,
  recentLimit: 5,
  // Ships with the bundled Monet background switched on, so a fresh install
  // looks like the screenshots rather than a blank panel.
  backgroundImage: "@bundled",
  backgroundOpacity: 1,
  backgroundBlur: 0,
  cardOpacity: 1,
  liquidGlass: true,
  glassBlur: 24,
  modules: {
    clock: true,
    today: true,
    agenda: true,
    // Off until the user adds sites: an empty bookmarks card is just noise.
    links: false,
    custom: false,
    deadlines: true,
    activity: true,
    habits: true,
    language: true,
    focus: true,
    projects: true,
    taskboard: true,
    taskDetails: true,
    recent: true,
    stats: true,
    charts: true,
  },
  focusLog: {},
  focusTargets: {},
  focusTarget: null,
  storedTasks: [],
  storedProjects: [],
  taskSections: ["今日任务", "本周任务", "本月任务", "长期目标"],
};

export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * How a task comes back after being checked off. "none" = a one-off. The
 * others spawn a fresh copy due at the next occurrence (see setTaskDone),
 * so the completed one still counts in the stats and stays in Done.
 */
export type TaskRepeat = "none" | "daily" | "weekly" | "monthly";

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
  /** Vault path of a related note; null = none. */
  note: string | null;
  repeat: TaskRepeat;
  /** ISO weekdays (1 = Mon … 7 = Sun) for a weekly repeat; empty = every 7 days. */
  repeatDays: number[];
  /** Free-text details, plain text with newlines; "" = none. */
  notes: string;
  /** The deadline this is preparation for (its id), or null. A dangling id
   *  (deadline since deleted) simply reads as unlinked. */
  deadlineId: string | null;
}

export interface StoredProject {
  id: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  /** YYYY-MM-DD, set once at creation — the Gantt bar's start, never edited. */
  createdAt: string;
  /** YYYY-MM-DD, optional — the Gantt bar's end. No due date = no bar. */
  dueDate: string | null;
  /** Vault path of a related note; null = none. */
  note: string | null;
}

export interface ProjectItem {
  name: string;
  status: "active" | "paused" | "done" | "backlog" | string;
  priority: "high" | "medium" | "low" | string;
  progress: number;
  createdAt: string;
  dueDate: string | null;
  note: string | null;
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
  note: string | null;
  repeat: TaskRepeat;
  repeatDays: number[];
  notes: string;
  deadlineId: string | null;
  id: string;
}

export interface TaskBuckets {
  today: TaskItem[];
  todo: TaskItem[];
  done: TaskItem[];
  /** Done long enough ago to be hidden from the Done column (see doneHideAfterDays). */
  archived: TaskItem[];
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
