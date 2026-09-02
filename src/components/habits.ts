import { setIcon } from "obsidian";
import { HabitItem } from "../types";
import { Ctx, card } from "../ui";
import { addDays, startOfDay, toKey } from "../dates";
import { Store, addHabit, deleteHabit, toggleHabitDay } from "../mutations";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

/** Width of the recent-days strip. Full-year, like the activity heatmap,
 *  would not scale to more than one or two habits on screen at once. */
const STRIP_DAYS = 14;

export function renderHabits(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `🔥 ${t.habits}`);
  const store = storeOf(ctx);

  const list = root.createDiv({ cls: "ed-habit-list" });
  if (ctx.settings.habits.length === 0) {
    list.createDiv({ cls: "ed-empty", text: t.noHabits });
  } else {
    for (const h of ctx.settings.habits) renderHabitRow(list, ctx, store, h);
  }

  renderAddRow(root, ctx, store);
}

/**
 * Consecutive checked days counting back from today. Today not being
 * checked yet does not break the streak — only a gap before it does —
 * mirroring the focus-history streak so the two read the same way.
 */
function streakFor(log: Record<string, boolean> | undefined, today: Date): number {
  if (!log) return 0;
  let day = today;
  if (!log[toKey(day)]) day = addDays(day, -1);
  let streak = 0;
  while (log[toKey(day)]) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

function renderHabitRow(list: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const { t } = ctx;
  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const log = ctx.settings.habitLog[habit.id];

  const row = list.createDiv({ cls: "ed-habit-row" });

  const head = row.createDiv({ cls: "ed-habit-head" });
  head.createSpan({ cls: "ed-habit-name", text: habit.name });
  const streak = streakFor(log, today);
  if (streak > 0) {
    head.createSpan({ cls: "ed-habit-streak", text: `🔥 ${streak}` });
  }
  const del = head.createEl("button", { cls: "ed-icon-btn ed-habit-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.habitDelete);
  del.onclick = () => void deleteHabit(store, habit.id).then((ok) => ok && ctx.refresh());

  const strip = row.createDiv({ cls: "ed-habit-strip" });
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    const done = !!log?.[key];
    const dot = strip.createDiv({ cls: "ed-habit-dot" });
    if (done) dot.addClass("is-done");
    if (key === todayKey) dot.addClass("is-today");
    dot.setAttr("aria-label", `${key}${done ? " ✓" : ""}`);
    dot.onclick = () =>
      void toggleHabitDay(store, habit.id, key).then((ok) => ok && ctx.refresh());
  }
}

function renderAddRow(root: HTMLElement, ctx: Ctx, store: Store) {
  const { t } = ctx;
  const row = root.createDiv({ cls: "ed-add-row" });

  const input = row.createEl("input", { cls: "ed-add-input", type: "text" });
  input.placeholder = t.habitAddPlaceholder;

  const submit = async () => {
    const name = input.value.trim();
    if (!name) return;
    if (await addHabit(store, name)) {
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

  const addBtn = row.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.addHabit });
  addBtn.onclick = () => void submit();
}
