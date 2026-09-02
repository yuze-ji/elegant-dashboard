import { Notice, setIcon } from "obsidian";
import { AlarmEngine, nextRingAt, normalizeTime } from "../alarm";
import { isoWeekday } from "../dates";
import { Strings } from "../i18n";
import { AlarmItem } from "../types";
import { Ctx, card, notifyUndo } from "../ui";
import { flipGroup, flipSeparator } from "./flip";

/** Fast enough that a second flips within a frame or two of the real tick. */
const TICK_MS = 200;

export function renderClock(parent: HTMLElement, ctx: Ctx, engine: AlarmEngine) {
  const { t, settings } = ctx;
  const root = card(parent);
  root.addClass("ed-clock");

  // ------------------------------------------------------------- flip face
  const face = root.createDiv({ cls: "ed-clock-face" });
  const row = face.createDiv({ cls: "ed-flip-row" });
  const hours = flipGroup(row, "00");
  flipSeparator(row, true);
  const minutes = flipGroup(row, "00");
  let seconds: ReturnType<typeof flipGroup> | null = null;
  if (settings.clockSeconds) {
    flipSeparator(row, true);
    seconds = flipGroup(row, "00");
  }
  const meridiem = settings.clock24h ? null : row.createDiv({ cls: "ed-clock-meridiem" });
  const dateLine = settings.clockShowDate ? face.createDiv({ cls: "ed-clock-date" }) : null;

  // ---------------------------------------------------------------- alarms
  const head = root.createDiv({ cls: "ed-alarm-head" });
  head.createDiv({ cls: "ed-alarm-title", text: t.alarms });
  const addBtn = head.createEl("button", { cls: "ed-btn ed-btn-compact", text: t.addAlarm });
  addBtn.onclick = () => void engine.add();

  const banner = root.createDiv({ cls: "ed-alarm-ring" });
  const list = root.createDiv({ cls: "ed-alarm-list" });

  /** Rebuilt with the list; refreshed once a minute without a rebuild. */
  let hints: Array<{ alarm: AlarmItem; el: HTMLElement }> = [];

  const refreshHints = (now: Date) => {
    for (const { alarm, el } of hints) el.setText(hintFor(alarm, now, t));
  };

  const renderList = () => {
    list.empty();
    hints = [];
    const alarms = engine.sorted();
    if (alarms.length === 0) {
      list.createDiv({ cls: "ed-empty", text: t.noAlarms });
      return;
    }
    for (const alarm of alarms) hints.push(renderRow(list, ctx, engine, alarm));
    refreshHints(new Date());
  };

  const paint = () => {
    const ringing = engine.ringing;
    banner.empty();
    banner.toggleClass("is-active", ringing !== null);
    if (ringing) {
      banner.createSpan({
        cls: "ed-alarm-ring-text",
        text: `⏰ ${ringing.time}　${ringing.label.trim() || t.alarmUntitled}`,
      });
      const stop = banner.createEl("button", {
        cls: "ed-btn ed-btn-compact",
        text: t.alarmStop,
      });
      stop.onclick = () => engine.dismiss();
    }
    renderList();
  };

  let lastMinute = -1;
  const paintTime = () => {
    const now = new Date();
    const h24 = now.getHours();
    const h = settings.clock24h ? h24 : h24 % 12 || 12;
    hours.set(String(h).padStart(2, "0"));
    minutes.set(String(now.getMinutes()).padStart(2, "0"));
    seconds?.set(String(now.getSeconds()).padStart(2, "0"));
    if (meridiem) meridiem.setText(h24 < 12 ? t.am : t.pm);

    if (now.getMinutes() !== lastMinute) {
      lastMinute = now.getMinutes();
      if (dateLine) {
        const weekday = t.weekdayFull[isoWeekday(now) - 1];
        dateLine.setText(
          `${t.formatDayTitle(now.getMonth() + 1, now.getDate())}　${weekday}`
        );
      }
      refreshHints(now);
    }
  };

  paintTime();
  paint();

  const timer = window.setInterval(paintTime, TICK_MS);
  const unsubscribe = engine.onChange(paint);
  ctx.onCleanup(() => {
    window.clearInterval(timer);
    unsubscribe();
    hours.destroy();
    minutes.destroy();
    seconds?.destroy();
  });
}

function renderRow(
  list: HTMLElement,
  ctx: Ctx,
  engine: AlarmEngine,
  alarm: AlarmItem
): { alarm: AlarmItem; el: HTMLElement } {
  const { t } = ctx;
  const row = list.createDiv({ cls: "ed-alarm-row" });
  row.toggleClass("is-off", !alarm.enabled);

  const timeInput = row.createEl("input", { cls: "ed-alarm-time", type: "time" });
  timeInput.value = alarm.time;
  timeInput.onchange = () => {
    const v = normalizeTime(timeInput.value);
    if (!v) {
      new Notice(t.alarmInvalidTime);
      timeInput.value = alarm.time;
      return;
    }
    void engine.update(alarm.id, { time: v });
  };

  const main = row.createDiv({ cls: "ed-alarm-main" });

  const labelInput = main.createEl("input", {
    cls: "ed-alarm-label",
    type: "text",
    placeholder: t.alarmLabelPlaceholder,
  });
  labelInput.value = alarm.label;
  // Saved silently: re-rendering the list mid-edit would steal the next click.
  labelInput.onchange = () => void engine.update(alarm.id, { label: labelInput.value }, true);

  const days = main.createDiv({ cls: "ed-alarm-days" });
  for (let iso = 1; iso <= 7; iso++) {
    const chip = days.createEl("button", {
      cls: "ed-alarm-day",
      text: t.weekdayShort[iso - 1],
    });
    chip.toggleClass("is-on", alarm.days.includes(iso));
    chip.onclick = () => {
      const next = alarm.days.includes(iso)
        ? alarm.days.filter((d) => d !== iso)
        : [...alarm.days, iso].sort((a, b) => a - b);
      void engine.update(alarm.id, { days: next });
    };
  }

  const hint = main.createDiv({ cls: "ed-alarm-next" });

  const toggle = row.createEl("input", { cls: "ed-alarm-toggle", type: "checkbox" });
  toggle.checked = alarm.enabled;
  toggle.setAttr("aria-label", t.alarms);
  toggle.onchange = () => void engine.update(alarm.id, { enabled: toggle.checked });

  const del = row.createEl("button", { cls: "ed-icon-btn ed-alarm-del" });
  setIcon(del, "trash-2");
  del.setAttr("aria-label", t.alarmDelete);
  del.onclick = async () => {
    const removed = await engine.remove(alarm.id);
    if (!removed) return;
    notifyUndo(t.alarmDeleted, t.undo, () => engine.restore(removed.item, removed.index));
  };

  return { alarm, el: hint };
}

function hintFor(alarm: AlarmItem, now: Date, t: Strings): string {
  if (!alarm.enabled) return t.alarmOff;
  const next = nextRingAt(alarm, now);
  if (!next) return "";
  const mins = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  const repeat = alarm.days.length === 0 ? t.alarmEveryDay : "";
  const countdown = t.alarmNextIn(Math.floor(mins / 60), mins % 60);
  return repeat ? `${repeat}　${countdown}` : countdown;
}
