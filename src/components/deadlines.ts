import { setIcon } from "obsidian";
import { DeadlineItem } from "../types";
import { Ctx, card, empty, notifyUndo } from "../ui";
import { NotePickModal, renderNoteButton } from "../noteLink";
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
  addPrepTask,
  deadlineProgress,
  deleteDeadline,
  restoreDeadline,
  setTaskDone,
  updateDeadline,
} from "../mutations";

/** Deadline ids whose prep-task panel is unfolded; survives re-renders. */
const openPanels = new Set<string>();

/**
 * The "3/5" chip on a deadline row, and the fold-out list of its prep
 * tasks beneath: check them off, add more. The panel is a sibling of the
 * row (not a child) so the row's flex layout stays a single line.
 */
function renderSubtasks(list: HTMLElement, row: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const { t } = ctx;
  const { done, total } = deadlineProgress(store, item.id);

  const chip = row.createEl("button", { cls: "ed-deadline-progress" });
  chip.setText(total > 0 ? `${done}/${total}` : "+");
  chip.toggleClass("is-complete", total > 0 && done === total);
  chip.toggleClass("is-empty", total === 0);
  chip.setAttr("title", total > 0 ? t.deadlinePrepProgress(done, total) : t.deadlinePrepAdd);
  chip.setAttr("aria-label", chip.getAttr("title") ?? "");

  const panel = list.createDiv({ cls: "ed-deadline-prep" });
  const sync = () => {
    const open = openPanels.has(item.id);
    panel.toggle(open);
    chip.toggleClass("is-open", open);
  };
  chip.onclick = (e) => {
    e.stopPropagation();
    if (openPanels.has(item.id)) openPanels.delete(item.id);
    else openPanels.add(item.id);
    sync();
    if (openPanels.has(item.id)) input.focus();
  };

  const tasks = ctx.settings.storedTasks.filter((x) => x.deadlineId === item.id);
  for (const task of tasks) {
    const line = panel.createDiv({ cls: "ed-deadline-prep-row" });
    if (task.done) line.addClass("is-done");
    const box = line.createEl("input", { cls: "ed-task-check", type: "checkbox" });
    box.checked = task.done;
    box.onchange = async () => {
      if (await setTaskDone(store, { id: task.id }, box.checked)) ctx.refresh();
    };
    line.createSpan({ cls: "ed-deadline-prep-text", text: task.text, title: task.text });
  }

  const addRow = panel.createDiv({ cls: "ed-deadline-prep-add" });
  const input = addRow.createEl("input", { cls: "ed-add-input", type: "text" });
  input.placeholder = t.deadlinePrepPlaceholder;
  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;
    if (await addPrepTask(store, item.id, text)) {
      input.value = "";
      openPanels.add(item.id);
      ctx.refresh();
    }
  };
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  });
  const addBtn = addRow.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.addDeadline });
  addBtn.onclick = () => void submit();

  sync();
}

const storeOf = (ctx: Ctx): Store => ({ settings: ctx.settings, save: ctx.save });

export type Urgency = "overdue" | "today" | "soon" | "near" | "far";

export function urgencyOf(days: number): Urgency {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  if (days <= 7) return "near";
  return "far";
}

/** `time` only decorates the "today" badge — on any other day the countdown
 *  already says what matters, and the row shows the time in its own field. */
export function badgeText(days: number, t: Ctx["t"], time: string | null = null): string {
  if (days < 0) return t.deadlineOverdue(-days);
  if (days === 0) return time ? `${t.deadlineToday} ${time}` : t.deadlineToday;
  return t.deadlineDaysLeft(days);
}

/** Same day: timed items in clock order, untimed ones after them. */
export function compareTime(a: { time: string | null }, b: { time: string | null }): number {
  if (a.time === b.time) return 0;
  if (a.time == null) return 1;
  if (b.time == null) return -1;
  return a.time.localeCompare(b.time);
}

/** `<input type="time">` bound to `item.time`; clearing it stores null. */
function renderTimeInput(parent: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const input = parent.createEl("input", { cls: "ed-deadline-time", type: "time" });
  input.value = item.time ?? "";
  input.setAttr("aria-label", ctx.t.deadlineTime);
  input.setAttr("title", ctx.t.deadlineTime);
  input.onchange = async () => {
    if (!(await updateDeadline(store, item.id, { time: input.value }))) {
      input.value = item.time ?? "";
      return;
    }
    ctx.refresh();
  };
  return input;
}

/** Preset choices, not a free-number field — a handful of options cover the
 *  real cases and a dropdown is one click instead of a validated text input. */
const REMIND_DAY_PRESETS = [1, 3, 7];
/** Offered only once the item has a time of day — nothing to count down to otherwise. */
const REMIND_MINUTE_PRESETS = [15, 30, 60, 120];

function renderRemindSelect(parent: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const { t } = ctx;
  const select = parent.createEl("select", { cls: "ed-deadline-remind" });
  select.createEl("option", { value: "", text: t.deadlineRemindNone });
  // Day offsets are stored as plain numbers, minute offsets as "m:<n>", so
  // one <select> can carry both kinds without a second control.
  if (item.time) {
    for (const n of REMIND_MINUTE_PRESETS) {
      select.createEl("option", { value: `m:${n}`, text: t.deadlineRemindMinutes(n) });
    }
  }
  select.createEl("option", { value: "0", text: t.deadlineRemindSameDay });
  for (const n of REMIND_DAY_PRESETS) {
    select.createEl("option", { value: String(n), text: t.deadlineRemindNDays(n) });
  }
  select.value =
    item.remindMinutesBefore != null && item.time
      ? `m:${item.remindMinutesBefore}`
      : item.remindDaysBefore == null
        ? ""
        : String(item.remindDaysBefore);
  select.onchange = async () => {
    const v = select.value;
    if (v.startsWith("m:")) {
      await updateDeadline(store, item.id, { remindMinutesBefore: Number(v.slice(2)) });
    } else {
      await updateDeadline(store, item.id, {
        remindDaysBefore: v === "" ? null : Number(v),
        remindMinutesBefore: null,
      });
    }
    ctx.refresh();
  };
  return select;
}

/**
 * Deadline rows are edited inline, not through a modal, so the note link
 * gets two small buttons: "open" (only when linked) and "link / change"
 * which pops the picker.
 */
function renderNoteControls(parent: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const { t } = ctx;
  renderNoteButton(parent, ctx.app, ctx.settings.lang, item.note, "ed-icon-btn");
  const pick = parent.createEl("button", { cls: "ed-icon-btn ed-deadline-note-pick" });
  setIcon(pick, "paperclip");
  if (item.note) pick.addClass("is-linked");
  pick.setAttr("aria-label", t.noteLink);
  pick.setAttr("title", t.noteLink);
  pick.onclick = () => {
    new NotePickModal(ctx.app, ctx.settings.lang, item.note, async (path) => {
      if (await updateDeadline(store, item.id, { note: path })) ctx.refresh();
    }).open();
  };
}

/** The check-off box at the head of a row. */
function renderDoneBox(parent: HTMLElement, ctx: Ctx, store: Store, item: DeadlineItem) {
  const box = parent.createEl("input", { cls: "ed-deadline-check", type: "checkbox" });
  box.checked = item.done;
  box.setAttr("aria-label", ctx.t.deadlineDone);
  box.setAttr("title", ctx.t.deadlineDone);
  box.onchange = async () => {
    await updateDeadline(store, item.id, { done: box.checked });
    ctx.refresh();
  };
  return box;
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
  const open = withDays.filter((x) => !x.item.done);
  const upcoming = open
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days || compareTime(a.item, b.item));
  const overdue = open
    .filter((x) => x.days < 0)
    .sort((a, b) => b.days - a.days || compareTime(a.item, b.item));
  const ordered = [...upcoming, ...overdue];
  // Most recent first: the one just checked off is the one most likely to be
  // un-checked by mistake.
  const done = withDays
    .filter((x) => x.item.done)
    .sort((a, b) => b.days - a.days || compareTime(a.item, b.item));

  const list = root.createDiv({ cls: "ed-deadline-list" });
  if (ordered.length === 0 && done.length === 0) {
    list.createDiv({ cls: "ed-empty", text: t.noDeadlines });
  } else {
    for (const { item, days } of ordered) renderListRow(list, ctx, store, item, days);
  }
  // A native <details>, collapsed by default: finished items stay reachable
  // (to un-check or delete) without padding the live countdown.
  if (done.length > 0) {
    const fold = list.createEl("details", { cls: "ed-deadline-done" });
    fold.createEl("summary", { text: t.deadlineDoneSection(done.length) });
    const doneList = fold.createDiv({ cls: "ed-deadline-done-list" });
    for (const { item, days } of done) renderListRow(doneList, ctx, store, item, days);
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
  renderDoneBox(row, ctx, store, item);
  if (item.done) {
    row.addClass("is-done");
    row.createDiv({ cls: "ed-deadline-badge", text: "✓" });
  } else {
    row.addClass(`is-${urgencyOf(days)}`);
    row.dataset.urgency = urgencyOf(days);
    row.createDiv({ cls: "ed-deadline-badge", text: badgeText(days, t, item.time) });
  }

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

  renderTimeInput(main, ctx, store, item);
  renderRemindSelect(main, ctx, store, item);
  renderNoteControls(main, ctx, store, item);

  const del = row.createEl("button", { cls: "ed-icon-btn ed-deadline-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.deadlineDelete);
  del.onclick = () => void deleteRow(ctx, store, item)();

  renderSubtasks(list, row, ctx, store, item);
}

function renderListAddRow(root: HTMLElement, ctx: Ctx, store: Store) {
  const { t } = ctx;
  const row = root.createDiv({ cls: "ed-add-row" });

  const titleInput = row.createEl("input", { cls: "ed-add-input", type: "text" });
  titleInput.placeholder = t.deadlineAddPlaceholder;

  const dateInput = row.createEl("input", { cls: "ed-deadline-date", type: "date" });
  const timeInput = row.createEl("input", { cls: "ed-deadline-time", type: "time" });
  timeInput.setAttr("aria-label", t.deadlineTime);
  timeInput.setAttr("title", t.deadlineTime);

  const submit = async () => {
    const title = titleInput.value.trim();
    if (!title || !dateInput.value) return;
    if (await addDeadline(store, title, dateInput.value, timeInput.value)) {
      titleInput.value = "";
      dateInput.value = "";
      timeInput.value = "";
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
        // A day whose every item is done keeps its dot (something happened
        // there) but loses its urgency colour — nothing is pending.
        const openCount = items.filter((i) => !i.done).length;
        if (openCount > 0) cell.dataset.urgency = urgencyOf(daysBetween(today, day));
        else cell.addClass("is-all-done");
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

    const items = [...(grouped.get(selectedKey) ?? [])].sort(
      (a, b) => Number(a.done) - Number(b.done) || compareTime(a, b)
    );
    const list = panel.createDiv({ cls: "ed-deadline-panel-list" });
    if (items.length === 0) {
      empty(list, t.noDeadlines);
    } else {
      for (const item of items) {
        const row = list.createDiv({ cls: "ed-deadline-row" });
        if (item.done) row.addClass("is-done");
        renderDoneBox(row, ctx, store, item);
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

        renderTimeInput(row, ctx, store, item);
        renderRemindSelect(row, ctx, store, item);
        renderNoteControls(row, ctx, store, item);

        const del = row.createEl("button", { cls: "ed-icon-btn ed-deadline-del" });
        setIcon(del, "trash-2");
        del.setAttr("aria-label", t.deadlineDelete);
        del.onclick = () => void deleteRow(ctx, store, item)();

        renderSubtasks(list, row, ctx, store, item);
      }
    }

    const addRow = panel.createDiv({ cls: "ed-add-row" });
    const titleInput = addRow.createEl("input", { cls: "ed-add-input", type: "text" });
    titleInput.placeholder = t.deadlineAddPlaceholder;
    const timeInput = addRow.createEl("input", { cls: "ed-deadline-time", type: "time" });
    timeInput.setAttr("aria-label", t.deadlineTime);
    timeInput.setAttr("title", t.deadlineTime);
    const submit = async () => {
      const title = titleInput.value.trim();
      if (!title) return;
      if (await addDeadline(store, title, selectedKey, timeInput.value)) {
        titleInput.value = "";
        timeInput.value = "";
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
