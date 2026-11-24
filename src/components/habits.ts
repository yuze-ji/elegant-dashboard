import { setIcon } from "obsidian";
import { HabitItem } from "../types";
import { Ctx, HoverTooltip, card, notifyUndo } from "../ui";
import { placeMonthLabels } from "./activity";
import {
  addDays,
  isoWeekday,
  startOfDay,
  startOfIsoWeek,
  toKey,
} from "../dates";
import {
  Store,
  addHabit,
  deleteHabit,
  restoreHabit,
  toggleHabitDay,
  updateHabit,
} from "../mutations";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

/** Width of the recent-days strip. Full-year, like the activity heatmap,
 *  would not scale to more than one or two habits on screen at once — this
 *  compact card is for a glance, not history; see renderHabitsPage for that. */
const STRIP_DAYS = 14;

/** Preset weekly targets offered in the select — covers the realistic range
 *  without a free-number field to validate. */
const TARGET_PRESETS = [1, 2, 3, 4, 5, 6, 7];

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
 * The dedicated Habits page: same per-habit header as the Overview card, but
 * with a full scrollable year heatmap instead of a 14-day strip — the same
 * "compact card on Overview, full history of its own page" split Deadlines
 * and Tasks use.
 */
export function renderHabitsPage(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `🔥 ${t.habits}`);
  const store = storeOf(ctx);

  if (ctx.settings.habits.length === 0) {
    root.createDiv({ cls: "ed-empty", text: t.noHabits });
  } else {
    ctx.settings.habits.forEach((h, i) => {
      if (i > 0) root.createDiv({ cls: "ed-divider" });
      const block = root.createDiv({ cls: "ed-habit-block" });
      const head = block.createDiv({ cls: "ed-habit-head" });
      renderHabitHeader(head, ctx, store, h);
      renderHabitHeatmap(block, ctx, store, h);
    });
  }

  renderAddRow(root, ctx, store);
}

/**
 * Consecutive checked days counting back from today. Today not being
 * checked yet does not break the streak — only a gap before it does.
 */
function dailyStreak(log: Record<string, boolean> | undefined, today: Date): number {
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

function countInWeek(log: Record<string, boolean> | undefined, weekStart: Date): number {
  if (!log) return 0;
  let n = 0;
  for (let i = 0; i < 7; i++) if (log[toKey(addDays(weekStart, i))]) n++;
  return n;
}

/**
 * Consecutive ISO weeks meeting the target, counting back from this week.
 * This week not having met it yet does not break the streak — the week
 * isn't over — mirroring the "today doesn't break it" rule `dailyStreak`
 * uses, just one level up.
 */
function weeklyStreak(
  log: Record<string, boolean> | undefined,
  target: number,
  today: Date
): number {
  let week = startOfIsoWeek(today);
  if (countInWeek(log, week) < target) week = addDays(week, -7);
  let streak = 0;
  while (countInWeek(log, week) >= target) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

function renderHabitRow(list: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const log = ctx.settings.habitLog[habit.id];

  const row = list.createDiv({ cls: "ed-habit-row" });
  const head = row.createDiv({ cls: "ed-habit-head" });
  renderHabitHeader(head, ctx, store, habit);

  const strip = row.createDiv({ cls: "ed-habit-strip" });
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const key = toKey(addDays(today, -i));
    const done = !!log?.[key];
    const isToday = key === todayKey;
    const dot = strip.createDiv({ cls: "ed-habit-dot" });
    if (done) dot.addClass("is-done");
    if (isToday) dot.addClass("is-today");
    dot.setAttr("aria-label", `${key}${done ? " ✓" : ""}`);
    // Only today is a check-in button — yesterday and earlier are a
    // read-only record, so an old day can't be quietly back-filled or
    // un-checked days after the fact.
    if (isToday) {
      dot.addClass("is-clickable");
      dot.onclick = () =>
        void toggleHabitDay(store, habit.id, key).then((ok) => ok && ctx.refresh());
    }
  }
  // Today is the rightmost dot and the strip now scrolls instead of
  // squeezing dots on a narrow card — land on today by default so a narrow
  // card doesn't hide the one dot that's actually clickable.
  strip.scrollLeft = strip.scrollWidth;
}

/** Name, streak/progress, target picker and delete — shared by the compact
 *  card row and the full page's per-habit block. */
function renderHabitHeader(head: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const { t } = ctx;
  const today = startOfDay(new Date());
  const log = ctx.settings.habitLog[habit.id];
  const target = habit.targetPerWeek;

  head.createSpan({ cls: "ed-habit-name", text: habit.name });

  if (target == null) {
    const streak = dailyStreak(log, today);
    if (streak > 0) head.createSpan({ cls: "ed-habit-streak", text: `🔥 ${streak}` });
  } else {
    const done = countInWeek(log, startOfIsoWeek(today));
    const progress = head.createSpan({ cls: "ed-habit-progress" });
    progress.toggleClass("is-met", done >= target);
    progress.setText(t.habitWeekProgress(done, target));
    const streak = weeklyStreak(log, target, today);
    if (streak > 0) {
      head.createSpan({ cls: "ed-habit-streak", text: t.habitStreakWeeks(streak) });
    }
  }

  renderTargetSelect(head, ctx, store, habit);
  renderReminderInput(head, ctx, store, habit);

  const del = head.createEl("button", { cls: "ed-icon-btn ed-habit-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.habitDelete);
  del.onclick = async () => {
    const removed = await deleteHabit(store, habit.id);
    if (!removed) return;
    ctx.refresh();
    notifyUndo(t.habitDeleted, t.undo, async () => {
      await restoreHabit(store, removed);
      ctx.refresh();
    });
  };
}

/**
 * A full year of the check-in record as a heatmap, same visual language as
 * the Activity module's grid (reuses its .ed-scroll/.ed-grid/.ed-pill
 * structure and cell sizing). Unlike Activity's 5-level intensity, a habit
 * day is binary — done or not — so a cell is either lit or it isn't.
 *
 * Only *today's* cell is clickable. Every earlier day is a fixed record:
 * back-filling or erasing a day after the fact would make the streak and
 * the heatmap mean less, not more.
 */
function renderHabitHeatmap(parent: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const { t } = ctx;
  const log = ctx.settings.habitLog[habit.id] ?? {};
  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const start = addDays(today, -364);

  const total = Object.values(log).filter(Boolean).length;
  parent.createDiv({ cls: "ed-habit-timeline-count", text: t.habitCheckinCount(total) });

  const tooltip = new HoverTooltip(ctx.onCleanup);

  const scroll = parent.createDiv({ cls: "ed-scroll" });
  const monthsRow = scroll.createDiv({ cls: "ed-months" });
  const gridBody = scroll.createDiv({ cls: "ed-grid-body" });

  const wkLabels = gridBody.createDiv({ cls: "ed-wk-labels" });
  t.weekdayShort.forEach((w, i) => {
    wkLabels.createDiv({ cls: "ed-wk-label", text: i % 2 === 0 ? w : "" });
  });

  const gridEl = gridBody.createDiv({ cls: "ed-grid" });
  let cursor = startOfIsoWeek(start);
  let weekIndex = 0;
  let lastMonth = -1;

  while (cursor.getTime() <= today.getTime()) {
    const col = gridEl.createDiv({ cls: "ed-week-col" });
    for (let i = 0; i < 7; i++) {
      const day = addDays(cursor, i);
      const inRange = day.getTime() >= start.getTime() && day.getTime() <= today.getTime();
      const cell = col.createDiv({ cls: "ed-pill ed-habit-pill" });
      if (!inRange) {
        cell.addClass("is-blank");
        continue;
      }

      const key = toKey(day);
      const done = !!log[key];
      const isToday = key === todayKey;
      if (done) cell.addClass("is-done");
      if (isToday) {
        // Two calls, not addClass("is-today is-clickable") — the space-
        // separated form throws (classList.add rejects multi-token strings),
        // which silently killed this and every later cell in the loop.
        cell.addClass("is-today");
        cell.addClass("is-clickable");
        cell.onclick = () =>
          void toggleHabitDay(store, habit.id, key).then((ok) => ok && ctx.refresh());
      }

      cell.addEventListener("mouseenter", () => {
        tooltip.el.empty();
        const wk = t.weekdayFull[isoWeekday(day) - 1];
        tooltip.el.createDiv({
          cls: "ed-tooltip-date",
          text: `${t.formatDayTitle(day.getMonth() + 1, day.getDate())} ${wk}`,
        });
        tooltip.el.createDiv({
          cls: "ed-tooltip-count",
          text: done ? t.habitCheckedIn : t.habitUnchecked,
        });
        tooltip.show();
      });
      cell.addEventListener("mousemove", (e: MouseEvent) => tooltip.move(e));
      cell.addEventListener("mouseleave", () => tooltip.hide());

      if (day.getDate() <= 7 && day.getMonth() !== lastMonth) {
        lastMonth = day.getMonth();
        const label = monthsRow.createSpan({
          cls: "ed-month-label",
          text: t.monthNames[day.getMonth()],
        });
        label.dataset.week = String(weekIndex);
      }
    }
    cursor = addDays(cursor, 7);
    weekIndex++;
  }
  placeMonthLabels(monthsRow, gridEl);
}

/** Per-habit reminder time; empty = fall back to the global daily reminder. */
function renderReminderInput(parent: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const { t } = ctx;
  const input = parent.createEl("input", { cls: "ed-habit-remind", type: "time" });
  input.value = habit.reminderTime ?? "";
  input.setAttr("aria-label", t.habitReminderTime);
  input.setAttr("title", t.habitReminderTime);
  input.onchange = async () => {
    if (!(await updateHabit(store, habit.id, { reminderTime: input.value || null }))) {
      input.value = habit.reminderTime ?? "";
      return;
    }
    ctx.refresh();
  };
}

function renderTargetSelect(parent: HTMLElement, ctx: Ctx, store: Store, habit: HabitItem) {
  const { t } = ctx;
  const select = parent.createEl("select", { cls: "ed-habit-target" });
  select.createEl("option", { value: "", text: t.habitTargetDaily });
  for (const n of TARGET_PRESETS) {
    select.createEl("option", { value: String(n), text: t.habitTargetPerWeek(n) });
  }
  select.value = habit.targetPerWeek == null ? "" : String(habit.targetPerWeek);
  select.onchange = async () => {
    const v = select.value === "" ? null : Number(select.value);
    await updateHabit(store, habit.id, { targetPerWeek: v });
    ctx.refresh();
  };
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
