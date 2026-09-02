import { TaskBuckets } from "../types";
import { Ctx, card, empty } from "../ui";
import { daysBetween, startOfDay, toKey } from "../dates";
import { badgeText, urgencyOf } from "./deadlines";

/**
 * A compact "what's on today" summary, meant to sit next to the clock rather
 * than claim a row of its own — synthesises data the other modules already
 * own (deadlines, tasks, habits) instead of tracking anything new.
 */
export function renderTodayOverview(parent: HTMLElement, ctx: Ctx, buckets: TaskBuckets) {
  const { t, settings } = ctx;
  const root = card(parent, `📌 ${t.todayOverview}`);
  root.addClass("ed-today");

  const today = startOfDay(new Date());
  const todayKey = toKey(today);
  const list = root.createDiv({ cls: "ed-today-list" });
  let rows = 0;

  const nextDeadline = [...settings.deadlines]
    .map((d) => ({ item: d, days: daysBetween(today, new Date(d.date + "T00:00:00")) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
  if (nextDeadline) {
    const row = list.createDiv({ cls: "ed-today-row" });
    row.createSpan({ cls: "ed-today-icon", text: "⏳" });
    row.createSpan({ cls: "ed-today-text", text: nextDeadline.item.title });
    const badge = row.createSpan({
      cls: "ed-today-badge",
      text: badgeText(nextDeadline.days, t),
    });
    badge.dataset.urgency = urgencyOf(nextDeadline.days);
    rows++;
  }

  if (buckets.today.length > 0) {
    const row = list.createDiv({ cls: "ed-today-row" });
    row.createSpan({ cls: "ed-today-icon", text: "✅" });
    row.createSpan({ cls: "ed-today-text", text: t.todayTasksLeft(buckets.today.length) });
    rows++;
  }

  const pendingHabits = settings.habits.filter(
    (h) => !settings.habitLog[h.id]?.[todayKey]
  ).length;
  if (pendingHabits > 0) {
    const row = list.createDiv({ cls: "ed-today-row" });
    row.createSpan({ cls: "ed-today-icon", text: "🔥" });
    row.createSpan({ cls: "ed-today-text", text: t.todayHabitsLeft(pendingHabits) });
    rows++;
  }

  if (rows === 0) empty(list, t.todayAllDone);
}
