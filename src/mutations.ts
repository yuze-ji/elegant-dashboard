import { Notice } from "obsidian";
import {
  DashboardSettings,
  DeadlineItem,
  HabitItem,
  ProjectItem,
  StoredProject,
  StoredTask,
  TaskItem,
  TaskRepeat,
  VOCAB_BOX_DAYS,
  VOCAB_MASTERED_BOX,
  VocabItem,
  newId,
} from "./types";
import { addDays, daysBetween, nextOccurrence, toKey } from "./dates";
import { normalizeTime } from "./alarm";

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
  note: string | null;
  repeat: TaskRepeat;
  repeatDays: number[];
  notes: string;
  deadlineId: string | null;
}

function findTask(store: Store, task: { id: string }): StoredTask | null {
  if (!task.id) return null;
  return store.settings.storedTasks.find((t) => t.id === task.id) ?? null;
}

function missing(): false {
  new Notice("⚠️ 找不到该条目，请刷新仪表板");
  return false;
}

// -------------------------------------------------------------------- tasks

/**
 * Checking off a repeating task spawns its next instance (due at the next
 * occurrence, same text/section/priority/note) and turns the finished one
 * into a plain one-off — so it still counts as a completion and sits in
 * Done, but un-checking it later doesn't spawn a second copy. The spawned
 * due date is returned so the caller can say so.
 */
export async function setTaskDone(
  store: Store,
  task: { id: string },
  done: boolean
): Promise<false | { spawnedDue: string | null }> {
  const target = findTask(store, task);
  if (!target) return missing();

  // No-op when already in the requested state, so an existing completion date
  // is never overwritten with today's.
  if (target.done === done && (!done || target.doneDate)) return { spawnedDue: null };

  target.done = done;
  target.doneDate = done ? target.doneDate ?? toKey(new Date()) : null;

  let spawnedDue: string | null = null;
  if (done && target.repeat !== "none") {
    spawnedDue = nextOccurrence(target.repeat, target.repeatDays, target.dueDate);
    const index = store.settings.storedTasks.indexOf(target);
    const next: StoredTask = {
      ...target,
      id: newId(),
      done: false,
      doneDate: null,
      dueDate: spawnedDue,
      tags: [...target.tags],
      repeatDays: [...target.repeatDays],
    };
    // Right after the original, so section order is preserved.
    store.settings.storedTasks.splice(index + 1, 0, next);
    target.repeat = "none";
    target.repeatDays = [];
  }
  await store.save();
  return { spawnedDue };
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
  target.note = draft.note;
  target.repeat = draft.repeat;
  target.repeatDays = draft.repeat === "weekly" ? [...draft.repeatDays] : [];
  target.notes = draft.notes.trim();
  target.deadlineId = draft.deadlineId;
  target.tags = draft.priority === "high" ? ["priority/high"] : [];
  await store.save();
  return true;
}

/** What a delete hands back, so the caller can offer an undo. */
export interface Removed<T> {
  item: T;
  index: number;
}

/**
 * Returns the removed row and its position (not just whether it worked) so
 * the caller can offer an undo — nothing in this plugin has version history,
 * so a delete with no way back is one stray click from losing real data.
 */
export async function deleteTask(
  store: Store,
  task: TaskItem
): Promise<Removed<StoredTask> | false> {
  const index = store.settings.storedTasks.findIndex((t) => t.id === task.id);
  if (index === -1) return missing();
  const [item] = store.settings.storedTasks.splice(index, 1);
  await store.save();
  return { item, index };
}

/** Re-inserts a task removed by `deleteTask`, in its original position. */
export async function restoreTask(store: Store, removed: Removed<StoredTask>): Promise<void> {
  const at = Math.min(removed.index, store.settings.storedTasks.length);
  store.settings.storedTasks.splice(at, 0, removed.item);
  await store.save();
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
    note: draft.note,
    repeat: draft.repeat,
    repeatDays: draft.repeat === "weekly" ? [...draft.repeatDays] : [],
    notes: draft.notes.trim(),
    deadlineId: draft.deadlineId,
  });
  await store.save();
  return true;
}

// ---------------------------------------------------------------- sections

export async function addSection(store: Store, name: string): Promise<boolean> {
  const n = name.trim();
  if (!n || store.settings.taskSections.includes(n)) return false;
  store.settings.taskSections.push(n);
  await store.save();
  return true;
}

/** Renames a section and re-files every task in it. */
export async function renameSection(store: Store, from: string, to: string): Promise<boolean> {
  const n = to.trim();
  if (!n || n === from) return false;
  if (store.settings.taskSections.includes(n)) return false;
  const i = store.settings.taskSections.indexOf(from);
  if (i < 0) return false;
  store.settings.taskSections[i] = n;
  for (const t of store.settings.storedTasks) if (t.section === from) t.section = n;
  await store.save();
  return true;
}

/** Removes a section; its tasks move to the first remaining one. Never empties the list. */
export async function deleteSection(store: Store, name: string): Promise<boolean> {
  const list = store.settings.taskSections;
  if (list.length <= 1 || !list.includes(name)) return false;
  store.settings.taskSections = list.filter((s) => s !== name);
  const fallback = store.settings.taskSections[0];
  for (const t of store.settings.storedTasks) if (t.section === name) t.section = fallback;
  await store.save();
  return true;
}

export async function moveSection(store: Store, name: string, delta: -1 | 1): Promise<boolean> {
  const list = store.settings.taskSections;
  const i = list.indexOf(name);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  await store.save();
  return true;
}

/** Open / total prep tasks hanging off a deadline. */
export function deadlineProgress(store: Store, deadlineId: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const t of store.settings.storedTasks) {
    if (t.deadlineId !== deadlineId) continue;
    total++;
    if (t.done) done++;
  }
  return { done, total };
}

/**
 * A prep task filed straight from a deadline row: no due date (the deadline
 * is the date), parked in the first section that isn't "today" so it lands
 * in To-do rather than crowding Today the moment it's typed.
 */
export async function addPrepTask(store: Store, deadlineId: string, text: string): Promise<boolean> {
  const sections = listSections(store);
  const section = sections.find((s) => !/今日|今天|本日|today/i.test(s)) ?? sections[0] ?? "";
  return addTask(store, section, {
    text,
    priority: "normal",
    pinned: false,
    dueDate: null,
    note: null,
    repeat: "none",
    repeatDays: [],
    notes: "",
    deadlineId,
  });
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
  if (patch.dueDate !== undefined) target.dueDate = patch.dueDate;
  if (patch.note !== undefined) target.note = patch.note;
  await store.save();
  return true;
}

export async function deleteProject(
  store: Store,
  project: ProjectItem
): Promise<Removed<StoredProject> | false> {
  const index = store.settings.storedProjects.findIndex((p) => p.id === project.id);
  if (index === -1) return missing();
  const [item] = store.settings.storedProjects.splice(index, 1);
  await store.save();
  return { item, index };
}

export async function restoreProject(
  store: Store,
  removed: Removed<StoredProject>
): Promise<void> {
  const at = Math.min(removed.index, store.settings.storedProjects.length);
  store.settings.storedProjects.splice(at, 0, removed.item);
  await store.save();
}

export async function addProject(
  store: Store,
  project: {
    name: string;
    status: string;
    priority: string;
    progress: number;
    dueDate: string | null;
    note: string | null;
  }
): Promise<boolean> {
  const name = project.name.trim();
  if (!name) return false;

  store.settings.storedProjects.push({
    id: newId(),
    name,
    status: project.status,
    priority: project.priority,
    progress: Math.max(0, Math.min(100, Math.round(project.progress))),
    // Stamped once, here, and never edited afterward — the Gantt bar's start.
    createdAt: toKey(new Date()),
    dueDate: project.dueDate,
    note: project.note,
  });
  await store.save();
  return true;
}

// ----------------------------------------------------------------- deadlines

/** "" / undefined = no time; otherwise must be a valid HH:MM or the add/update is rejected. */
function parseDeadlineTime(raw: string | null | undefined): string | null | false {
  if (raw == null || raw.trim() === "") return null;
  const t = normalizeTime(raw);
  return t === null ? false : t;
}

export async function addDeadline(
  store: Store,
  title: string,
  date: string,
  time?: string | null,
  note: string | null = null
): Promise<boolean> {
  const t = title.trim();
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const tm = parseDeadlineTime(time);
  if (tm === false) return false;
  store.settings.deadlines.push({
    id: newId(),
    title: t,
    date,
    time: tm,
    remindDaysBefore: null,
    remindMinutesBefore: null,
    reminded: false,
    done: false,
    note,
    icsUid: null,
  });
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
    // A moved due date invalidates any reminder already fired for the old one.
    target.reminded = false;
  }
  if (patch.time !== undefined) {
    const tm = parseDeadlineTime(patch.time);
    if (tm === false) return false;
    target.time = tm;
    // A moved time moves a minute-based reminder with it; clearing the time
    // leaves such a reminder with nothing to count down to, so drop it.
    target.reminded = false;
    if (tm === null) target.remindMinutesBefore = null;
  }
  // The two reminder kinds share one dropdown, so setting either clears the other.
  if (patch.remindDaysBefore !== undefined) {
    target.remindDaysBefore = patch.remindDaysBefore;
    if (patch.remindDaysBefore !== null) target.remindMinutesBefore = null;
    target.reminded = false;
  }
  if (patch.remindMinutesBefore !== undefined) {
    target.remindMinutesBefore = patch.remindMinutesBefore;
    if (patch.remindMinutesBefore !== null) target.remindDaysBefore = null;
    target.reminded = false;
  }
  if (patch.done !== undefined) target.done = patch.done;
  if (patch.note !== undefined) target.note = patch.note;
  await store.save();
  return true;
}

export async function deleteDeadline(
  store: Store,
  id: string
): Promise<Removed<DeadlineItem> | false> {
  const index = store.settings.deadlines.findIndex((d) => d.id === id);
  if (index === -1) return missing();
  const [item] = store.settings.deadlines.splice(index, 1);
  // An imported event the user removed must not come back on the next sync.
  if (item.icsUid && !store.settings.icsDeletedUids.includes(item.icsUid)) {
    store.settings.icsDeletedUids.push(item.icsUid);
    if (store.settings.icsDeletedUids.length > 500) store.settings.icsDeletedUids.shift();
  }
  await store.save();
  return { item, index };
}

export async function restoreDeadline(
  store: Store,
  removed: Removed<DeadlineItem>
): Promise<void> {
  const at = Math.min(removed.index, store.settings.deadlines.length);
  store.settings.deadlines.splice(at, 0, removed.item);
  if (removed.item.icsUid) {
    store.settings.icsDeletedUids = store.settings.icsDeletedUids.filter(
      (u) => u !== removed.item.icsUid
    );
  }
  await store.save();
}

// -------------------------------------------------------------------- habits

export async function addHabit(store: Store, name: string): Promise<boolean> {
  const n = name.trim();
  if (!n) return false;
  store.settings.habits.push({ id: newId(), name: n, targetPerWeek: null, reminderTime: null, linkedLang: null });
  await store.save();
  return true;
}

export async function updateHabit(
  store: Store,
  id: string,
  patch: Partial<Omit<HabitItem, "id">>
): Promise<boolean> {
  const target = store.settings.habits.find((h) => h.id === id);
  if (!target) return missing();
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return false;
    target.name = n;
  }
  if (patch.targetPerWeek !== undefined) target.targetPerWeek = patch.targetPerWeek;
  if (patch.linkedLang !== undefined) target.linkedLang = patch.linkedLang || null;
  if (patch.reminderTime !== undefined) {
    if (patch.reminderTime === null || patch.reminderTime === "") {
      target.reminderTime = null;
    } else {
      const tm = normalizeTime(patch.reminderTime);
      if (!tm) return false;
      target.reminderTime = tm;
    }
    // A changed time may re-fire today; the per-habit stamp gates that.
    delete store.settings.habitReminderFiredById[id];
  }
  await store.save();
  return true;
}

/** The removed habit's check-in log rides along, or undo would resurrect a habit with its streak wiped. */
export interface RemovedHabit extends Removed<HabitItem> {
  log: Record<string, boolean> | undefined;
}

/** Reorders `list` so the item with `id` sits right before/after `targetId`. */
function moveById<T extends { id: string }>(
  list: T[],
  id: string,
  targetId: string,
  after: boolean
): boolean {
  const from = list.findIndex((x) => x.id === id);
  if (from < 0 || id === targetId) return false;
  const [item] = list.splice(from, 1);
  let to = list.findIndex((x) => x.id === targetId);
  if (to < 0) {
    list.splice(from, 0, item);
    return false;
  }
  if (after) to += 1;
  list.splice(to, 0, item);
  return true;
}

/**
 * Deletes tasks finished `donePurgeAfterDays` or more days ago. Returns how
 * many went. Nothing is offered for undo — by then the daily snapshots have
 * had weeks to catch them.
 */
export async function purgeOldDoneTasks(store: Store): Promise<number> {
  const after = store.settings.donePurgeAfterDays;
  if (after <= 0) return 0;
  const now = new Date();
  const before = store.settings.storedTasks.length;
  store.settings.storedTasks = store.settings.storedTasks.filter((t) => {
    if (!t.done || !t.doneDate) return true;
    return daysBetween(new Date(t.doneDate + "T00:00:00"), now) < after;
  });
  const removed = before - store.settings.storedTasks.length;
  if (removed > 0) await store.save();
  return removed;
}

/** Drag-and-drop order. Array position is the tie-break after pin/priority. */
export async function moveTask(
  store: Store,
  id: string,
  targetId: string,
  after: boolean
): Promise<boolean> {
  if (!moveById(store.settings.storedTasks, id, targetId, after)) return missing();
  await store.save();
  return true;
}

/** Drag-and-drop order; the board shows projects in array order (done last). */
export async function moveProject(
  store: Store,
  id: string,
  targetId: string,
  after: boolean
): Promise<boolean> {
  if (!moveById(store.settings.storedProjects, id, targetId, after)) return missing();
  await store.save();
  return true;
}

export async function deleteHabit(store: Store, id: string): Promise<RemovedHabit | false> {
  const index = store.settings.habits.findIndex((h) => h.id === id);
  if (index === -1) return missing();
  const [item] = store.settings.habits.splice(index, 1);
  const log = store.settings.habitLog[id];
  delete store.settings.habitLog[id];
  await store.save();
  return { item, index, log };
}

export async function restoreHabit(store: Store, removed: RemovedHabit): Promise<void> {
  const at = Math.min(removed.index, store.settings.habits.length);
  store.settings.habits.splice(at, 0, removed.item);
  if (removed.log) store.settings.habitLog[removed.item.id] = removed.log;
  await store.save();
}

/**
 * Toggles a single day for a habit. `dateKey` is YYYY-MM-DD, and must be
 * *today* — enforced here, not just by the UI omitting a click handler on
 * past cells, so no future call site can quietly back-fill or erase a day
 * after the fact and undermine what the streak and the heatmap are supposed
 * to mean: a fixed, honest record.
 */
export async function toggleHabitDay(
  store: Store,
  habitId: string,
  dateKey: string
): Promise<boolean> {
  if (!store.settings.habits.some((h) => h.id === habitId)) return missing();
  if (dateKey !== toKey(new Date())) return false;
  const log = (store.settings.habitLog[habitId] ??= {});
  if (log[dateKey]) delete log[dateKey];
  else log[dateKey] = true;
  await store.save();
  return true;
}

/**
 * Checks off today for every habit linked to one of `langs`. Only ever sets
 * today — never clears it, never touches another day — so it stays within
 * the same "honest record" rule as toggleHabitDay. Does not save; callers
 * already do. Returns whether anything changed.
 */
function markLinkedHabits(store: Store, langs: string[]): boolean {
  const today = toKey(new Date());
  let changed = false;
  for (const h of store.settings.habits) {
    if (!h.linkedLang || !langs.includes(h.linkedLang)) continue;
    const log = (store.settings.habitLog[h.id] ??= {});
    if (!log[today]) {
      log[today] = true;
      changed = true;
    }
  }
  return changed;
}

/** Which language a kana / hangul drill counts towards, by common names. */
const SCRIPT_LANGS: Record<string, string[]> = {
  hiragana: ["日本語", "日语", "日文", "Japanese"],
  katakana: ["日本語", "日语", "日文", "Japanese"],
  hangul: ["한국어", "韩语", "韓國語", "Korean"],
  hangulSyllables: ["한국어", "韩语", "韓國語", "Korean"],
};

// ---------------------------------------------------------------- vocabulary

export interface VocabDraft {
  word: string;
  meaning: string;
  example: string;
  lang: string;
}

function vocabDayLog(store: Store, dateKey: string) {
  return (store.settings.vocabLog[dateKey] ??= { reviewed: 0, added: 0 });
}

export async function addVocab(store: Store, draft: VocabDraft): Promise<boolean> {
  const word = draft.word.trim();
  const meaning = draft.meaning.trim();
  if (!word || !meaning) return false;
  const today = toKey(new Date());
  store.settings.vocab.push({
    id: newId(),
    word,
    meaning,
    example: draft.example.trim(),
    lang: draft.lang.trim() || store.settings.vocabLanguages[0] || "",
    createdAt: today,
    box: 0,
    due: today,
    reviews: 0,
    lapses: 0,
  });
  vocabDayLog(store, today).added++;
  markLinkedHabits(store, [store.settings.vocab[store.settings.vocab.length - 1].lang]);
  store.settings.vocabLastLang = draft.lang.trim() || null;
  await store.save();
  return true;
}

/** The add form's default language: the last one used, if still offered. */
export function defaultVocabLang(settings: DashboardSettings): string {
  const last = settings.vocabLastLang;
  if (last && settings.vocabLanguages.includes(last)) return last;
  return settings.vocabLanguages[0] ?? "";
}

export async function updateVocab(
  store: Store,
  id: string,
  patch: Partial<VocabDraft>
): Promise<boolean> {
  const item = store.settings.vocab.find((v) => v.id === id);
  if (!item) return missing();
  if (patch.word !== undefined) {
    const w = patch.word.trim();
    if (!w) return false;
    item.word = w;
  }
  if (patch.meaning !== undefined) {
    const m = patch.meaning.trim();
    if (!m) return false;
    item.meaning = m;
  }
  if (patch.example !== undefined) item.example = patch.example.trim();
  if (patch.lang !== undefined) item.lang = patch.lang.trim();
  await store.save();
  return true;
}

export async function deleteVocab(store: Store, id: string): Promise<Removed<VocabItem> | false> {
  const index = store.settings.vocab.findIndex((v) => v.id === id);
  if (index < 0) return missing();
  const [item] = store.settings.vocab.splice(index, 1);
  await store.save();
  return { item, index };
}

export async function restoreVocab(store: Store, removed: Removed<VocabItem>): Promise<void> {
  const at = Math.min(removed.index, store.settings.vocab.length);
  store.settings.vocab.splice(at, 0, removed.item);
  await store.save();
}

/**
 * One flashcard answer. Right: up a box, next review VOCAB_BOX_DAYS[box]
 * days out. Wrong: back to box 0 and due today, so it comes round again
 * before the session ends — the whole point of a miss is to see it again
 * soon, not next week.
 */
export async function reviewVocab(store: Store, id: string, correct: boolean): Promise<boolean> {
  const item = store.settings.vocab.find((v) => v.id === id);
  if (!item) return missing();
  const today = new Date();
  item.reviews++;
  if (correct) {
    item.box = Math.min(item.box + 1, VOCAB_MASTERED_BOX);
    item.due = toKey(addDays(today, VOCAB_BOX_DAYS[item.box]));
  } else {
    item.box = 0;
    item.lapses++;
    item.due = toKey(today);
  }
  vocabDayLog(store, toKey(today)).reviewed++;
  markLinkedHabits(store, [item.lang]);
  await store.save();
  return true;
}

/** One kana / hangul drill answer; `key` is "<script>:<char>". */
export async function recordScriptAnswer(store: Store, key: string, correct: boolean): Promise<void> {
  const rec = (store.settings.scriptLog[key] ??= { right: 0, wrong: 0 });
  if (correct) rec.right++;
  else rec.wrong++;
  markLinkedHabits(store, SCRIPT_LANGS[key.split(":")[0]] ?? []);
  await store.save();
}

/** Put a word back at the start of the ladder — a manual "relearn". */
export async function resetVocab(store: Store, id: string): Promise<boolean> {
  const item = store.settings.vocab.find((v) => v.id === id);
  if (!item) return missing();
  item.box = 0;
  item.due = toKey(new Date());
  await store.save();
  return true;
}
