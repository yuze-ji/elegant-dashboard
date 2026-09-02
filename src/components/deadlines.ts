import { setIcon } from "obsidian";
import { DeadlineItem } from "../types";
import { Ctx, card, empty, notifyUndo } from "../ui";
import {
  addMonths,
  daysBetween,
  endOfMonth,
  isoWeekday,
  startOfDay,
  startOfMonth,
  toKey,
} from "../dates";
import {
  Store,
  addDeadline,
  deleteDeadline,
  restoreDeadline,
  updateDeadline,
} from "../mutations";

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

export type Urgency = "overdue" | "today" | "soon" | "near" | "far";

export function urgencyOf(days: number): Urgency {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  if (days <= 7) return "near";
  return "far";
}

export function badgeText(days: number, t: Ctx["t"]): string {
  if (days < 0) return t.deadlineOverdue(-days);
  if (days === 0) return t.deadlineToday;
  return t.deadlineDaysLeft(days);
}

/** Preset choices, not a free-number field — five options cover the real
 *  cases and a dropdown is one click instead of a validated text input. */
const REMIND_PRESETS = [1, 3, 7];

function renderRemindSelect(parent: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const { t } = ctx;
  const select = parent.createEl("select", { cls: "ed-deadline-remind" });
  select.createEl("option", { value: "", text: t.deadlineRemindNone });
  select.createEl("option", { value: "0", text: t.deadlineRemindSameDay });
  for (const n of REMIND_PRESETS) {
    select.createEl("option", { value: String(n), text: t.deadlineRemindNDays(n) });
  }
  select.value = item.remindDaysBefore == null ? "" : String(item.remindDaysBefore);
  select.onchange = async () => {
    const v = select.value === "" ? null : Number(select.value);
    await updateDeadline(store, item.id, { remindDaysBefore: v });
    ctx.refresh();
  };
  return select;
}

function deleteRow(ctx: Ctx, store: Store, item: DeadlineItem) {
  return async () => {
    const removed = await deleteDeadline(store, item.id);
    if (!removed) return;
    ctx.refresh();
    notifyUndo(ctx.t.deadlineDeletedNotice, ctx.t.undo, async () => {
      await restoreDeadline(store, removed);
      ctx.refresh();
    });
  };
}

// -------------------------------------------------------- overview card

/**
 * The compact Overview card: every deadline as a row, soonest first, overdue
 * ones sunk to the bottom the way finished projects are. For the full
 * calendar, see `renderDeadlineCalendar` — that's its own page, the way
 * Tasks has a compact taskboard on Overview and a full board of its own.
 */
export function renderDeadlines(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `⏳ ${t.deadlines}`);
  const store = storeOf(ctx);
  const today = startOfDay(new Date());

  const withDays = ctx.settings.deadlines.map((d) => ({
    item: d,
    days: daysBetween(today, new Date(d.date + "T00:00:00")),
  }));
  const upcoming = withDays.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);
  const overdue = withDays.filter((x) => x.days < 0).sort((a, b) => b.days - a.days);
  const ordered = [...upcoming, ...overdue];

  const list = root.createDiv({ cls: "ed-deadline-list" });
  if (ordered.length === 0) {
    list.createDiv({ cls: "ed-empty", text: t.noDeadlines });
  } else {
    for (const { item, days } of ordered) renderListRow(list, ctx, store, item, days);
  }

  renderListAddRow(root, ctx, store);
}

function renderListRow(
  list: HTMLElement,
  ctx: Ctx,
  store: Store,
  item: DeadlineItem,
  days: number
) {
  const { t } = ctx;
  const row = list.createDiv({ cls: "ed-deadline-row" });
  row.addClass(`is-${urgencyOf(days)}`);
  row.dataset.urgency = urgencyOf(days);

  row.createDiv({ cls: "ed-deadline-badge", text: badgeText(days, t) });

  const main = row.createDiv({ cls: "ed-deadline-main" });
  const titleInput = main.createEl("input", { cls: "ed-deadline-title", type: "text" });
  titleInput.value = item.title;
  titleInput.onchange = async () => {
    if (!(await updateDeadline(store, item.id, { title: titleInput.value }))) {
      titleInput.value = item.title;
      return;
    }
    ctx.refresh();
  };

  const dateInput = main.createEl("input", { cls: "ed-deadline-date", type: "date" });
  dateInput.value = item.date;
  dateInput.onchange = async () => {
    if (!(await updateDeadline(store, item.id, { date: dateInput.value }))) {
      dateInput.value = item.date;
      return;
    }
    ctx.refresh();
  };

  renderRemindSelect(main, ctx, store, item);

  const del = row.createEl("button", { cls: "ed-icon-btn ed-deadline-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.deadlineDelete);
  del.onclick = () => void deleteRow(ctx, store, item)();
}

function renderListAddRow(root: HTMLElement, ctx: Ctx, store: Store) {
  const { t } = ctx;
  const row = root.createDiv({ cls: "ed-add-row" });

  const titleInput = row.createEl("input", { cls: "ed-add-input", type: "text" });
  titleInput.placeholder = t.deadlineAddPlaceholder;

  const dateInput = row.createEl("input", { cls: "ed-deadline-date", type: "date" });

  const submit = async () => {
    const title = titleInput.value.trim();
    if (!title || !dateInput.value) return;
    if (await addDeadline(store, title, dateInput.value)) {
      titleInput.value = "";
      dateInput.value = "";
      ctx.refresh();
    }
  };

  titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  });

  const addBtn = row.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.addDeadline });
  addBtn.onclick = () => void submit();
}

// -------------------------------------------------------------- calendar page

/**
 * The dedicated Deadlines page: a month calendar with an urgency-coloured dot
 * on any day that has something due, and a detail panel below it for the
 * selected day — the same "compact card on Overview, full view of its own
 * page" split the Tasks / Projects pages use.
 */
export function renderDeadlineCalendar(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `⏳ ${t.deadlines}`);
  const store = storeOf(ctx);

  const today = startOfDay(new Date());
  const todayKey = toKey(today);

  let viewMonth = startOfMonth(today);
  let selectedKey = todayKey;

  const body = root.createDiv();

  const byDay = () => {
    const map = new Map<string, DeadlineItem[]>();
    for (const d of ctx.settings.deadlines) {
      const list = map.get(d.date);
      if (list) list.push(d);
      else map.set(d.date, [d]);
    }
    return map;
  };

  const draw = () => {
    body.empty();
    const grouped = byDay();

    const topRow = body.createDiv({ cls: "ed-deadline-cal-head" });
    const prevBtn = topRow.createEl("button", { cls: "ed-icon-btn" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.onclick = () => {
      viewMonth = addMonths(viewMonth, -1);
      draw();
    };
    topRow.createDiv({
      cls: "ed-month-title",
      text: t.formatMonthTitle(viewMonth.getFullYear(), viewMonth.getMonth() + 1),
    });
    const nextBtn = topRow.createEl("button", { cls: "ed-icon-btn" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.onclick = () => {
      viewMonth = addMonths(viewMonth, 1);
      draw();
    };

    // Its own grid classes, not activity.ts's `.ed-cal-*` — this is a full
    // page, not a card squeezed next to others, so it is sized much bigger.
    const weekdays = body.createDiv({ cls: "ed-deadline-cal-weekdays" });
    t.weekdayShort.forEach((w) =>
      weekdays.createDiv({ cls: "ed-deadline-cal-wk-label", text: w })
    );

    const grid = body.createDiv({ cls: "ed-deadline-cal-grid" });
    const first = startOfMonth(viewMonth);
    const last = endOfMonth(viewMonth);
    const lead = isoWeekday(first) - 1;
    for (let i = 0; i < lead; i++) grid.createDiv({ cls: "ed-deadline-cell is-empty" });

    for (let d = 1; d <= last.getDate(); d++) {
      const day = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const key = toKey(day);
      const items = grouped.get(key) ?? [];

      const cell = grid.createDiv({ cls: "ed-deadline-cell" });
      cell.createSpan({ cls: "ed-deadline-cell-num", text: String(d) });
      if (items.length > 0) {
        cell.dataset.urgency = urgencyOf(daysBetween(today, day));
        const dot = cell.createSpan({ cls: "ed-deadline-cell-dot" });
        if (items.length > 1) dot.setText(String(items.length));
      }
      if (key === todayKey) cell.addClass("is-today");
      if (key === selectedKey) cell.addClass("is-selected");
      cell.onclick = () => {
        selectedKey = key;
        draw();
      };
    }

    const selectedDay = startOfDay(new Date(selectedKey + "T00:00:00"));
    const days = daysBetween(today, selectedDay);
    const panel = body.createDiv({ cls: "ed-deadline-panel" });
    const panelHead = panel.createDiv({ cls: "ed-deadline-panel-head" });
    panelHead.createSpan({
      cls: "ed-deadline-panel-date",
      text: t.formatDayTitle(selectedDay.getMonth() + 1, selectedDay.getDate()),
    });
    const badge = panelHead.createSpan({
      cls: "ed-deadline-badge",
      text: badgeText(days, t),
    });
    badge.dataset.urgency = urgencyOf(days);

    const items = grouped.get(selectedKey) ?? [];
    const list = panel.createDiv({ cls: "ed-deadline-panel-list" });
    if (items.length === 0) {
      empty(list, t.noDeadlines);
    } else {
      for (const item of items) {
        const row = list.createDiv({ cls: "ed-deadline-row" });
        const titleInput = row.createEl("input", {
          cls: "ed-deadline-title",
          type: "text",
        });
        titleInput.value = item.title;
        titleInput.onchange = async () => {
          if (!(await updateDeadline(store, item.id, { title: titleInput.value }))) {
            titleInput.value = item.title;
            return;
          }
          ctx.refresh();
        };

        renderRemindSelect(row, ctx, store, item);

        const del = row.createEl("button", { cls: "ed-icon-btn ed-deadline-del" });
        setIcon(del, "trash-2");
        del.setAttr("aria-label", t.deadlineDelete);
        del.onclick = () => void deleteRow(ctx, store, item)();
      }
    }

    const addRow = panel.createDiv({ cls: "ed-add-row" });
    const titleInput = addRow.createEl("input", { cls: "ed-add-input", type: "text" });
    titleInput.placeholder = t.deadlineAddPlaceholder;
    const submit = async () => {
      const title = titleInput.value.trim();
      if (!title) return;
      if (await addDeadline(store, title, selectedKey)) {
        titleInput.value = "";
        ctx.refresh();
      }
    };
    titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    });
    const addBtn = addRow.createEl("button", {
      cls: "ed-btn ed-btn-compact",
      text: t.addDeadline,
    });
    addBtn.onclick = () => void submit();
  };

  draw();
}
