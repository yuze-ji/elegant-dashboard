import { Notice } from "obsidian";
import { FocusEngine } from "../focus";
import { drawDial, themeColors } from "../charts";
import { Ctx, card } from "../ui";
import { mmss } from "../dates";
import { flipGroup, flipSeparator } from "./flip";

const DIAL_SIZE = 140;

/** Draws the remaining time; the two styles differ only in presentation. */
interface ClockFace {
  paint: (timeText: string, subText: string, progress: number) => void;
}

function dialFace(parent: HTMLElement): ClockFace {
  const wrap = parent.createDiv({ cls: "ed-dial" });
  const canvas = wrap.createEl("canvas");
  return {
    paint: (timeText, subText, progress) =>
      drawDial(canvas, DIAL_SIZE, progress, timeText, subText, themeColors()),
  };
}

function flipFace(parent: HTMLElement, ctx: Ctx): ClockFace {
  const wrap = parent.createDiv({ cls: "ed-focus-flip" });
  const row = wrap.createDiv({ cls: "ed-flip-row is-compact" });
  const mins = flipGroup(row, "25");
  flipSeparator(row);
  const secs = flipGroup(row, "00");
  const bar = wrap.createDiv({ cls: "ed-focus-bar" });
  const fill = bar.createDiv({ cls: "ed-focus-bar-fill" });
  const sub = wrap.createDiv({ cls: "ed-focus-flip-sub" });

  ctx.onCleanup(() => {
    mins.destroy();
    secs.destroy();
  });

  return {
    paint: (timeText, subText, progress) => {
      const [m, s] = timeText.split(":");
      mins.set(m ?? "00");
      secs.set(s ?? "00");
      fill.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
      sub.setText(subText);
    },
  };
}

export function renderFocusTimer(parent: HTMLElement, ctx: Ctx, engine: FocusEngine) {
  const { t } = ctx;
  const root = card(parent);
  root.addClass("ed-focus");

  // mode switch
  const modeRow = root.createDiv({ cls: "ed-focus-modes" });
  const countdownBtn = modeRow.createEl("button", {
    cls: "ed-mode-btn",
    text: t.countdownMode,
  });
  const accumulateBtn = modeRow.createEl("button", {
    cls: "ed-mode-btn",
    text: t.accumulateMode,
  });

  const contentRow = root.createDiv({ cls: "ed-focus-row" });
  const face =
    ctx.settings.focusClockStyle === "flip"
      ? flipFace(contentRow, ctx)
      : dialFace(contentRow);

  const info = contentRow.createDiv({ cls: "ed-focus-info" });
  info.createDiv({ cls: "ed-focus-title", text: t.focusSession });

  const setRow = info.createDiv({ cls: "ed-focus-set" });
  setRow.createSpan({ cls: "ed-focus-set-label", text: t.setLabel });
  const input = setRow.createEl("input", { cls: "ed-focus-input", type: "number" });
  input.min = "1";
  input.max = "180";
  input.value = String(Math.round(engine.targetSeconds / 60));
  setRow.createSpan({ cls: "ed-focus-set-label", text: t.minutes });
  const applyBtn = setRow.createEl("button", { cls: "ed-btn ed-btn-compact", text: "✓" });

  const statsRow = info.createDiv({ cls: "ed-focus-stats" });
  const todayStat = statBlock(statsRow, t.todayFocus);
  const monthStat = statBlock(statsRow, t.monthTotal);

  const controls = info.createDiv({ cls: "ed-focus-controls" });
  const startBtn = controls.createEl("button", { cls: "ed-btn", text: t.start });
  const pauseBtn = controls.createEl("button", { cls: "ed-btn", text: t.pause });
  const resetBtn = controls.createEl("button", { cls: "ed-btn", text: t.reset });

  const paint = () => {
    countdownBtn.toggleClass("is-active", engine.mode === "countdown");
    accumulateBtn.toggleClass("is-active", engine.mode === "accumulate");
    setRow.toggleClass("is-hidden", engine.mode !== "countdown");

    const sub = engine.running
      ? engine.mode === "countdown"
        ? t.countdownLabel
        : t.accumulateLabel
      : "";
    face.paint(mmss(engine.displaySeconds), sub, engine.progress);

    todayStat.value.setText(`${engine.todayMinutes()}${t.minuteUnit}`);
    monthStat.value.setText(`${engine.monthMinutes()}${t.minuteUnit}`);

    startBtn.disabled = engine.running;
    pauseBtn.disabled = !engine.running;
  };

  countdownBtn.onclick = () => void engine.switchMode("countdown");
  accumulateBtn.onclick = () => void engine.switchMode("accumulate");
  startBtn.onclick = () => engine.start();
  pauseBtn.onclick = () => void engine.pause();
  resetBtn.onclick = () => void engine.reset();

  applyBtn.onclick = () => {
    const mins = parseInt(input.value, 10);
    if (!engine.setTargetMinutes(mins)) {
      new Notice(t.focusRangeError);
      input.value = String(Math.round(engine.targetSeconds / 60));
      return;
    }
    new Notice(t.focusSetTo(Math.round(engine.targetSeconds / 60)));
  };
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") applyBtn.click();
  });

  const unsubscribe = engine.onChange(paint);
  ctx.onCleanup(unsubscribe);

  paint();
}

function statBlock(parent: HTMLElement, label: string) {
  const wrap = parent.createDiv({ cls: "ed-stat-block" });
  wrap.createDiv({ cls: "ed-stat-caption", text: label });
  const value = wrap.createDiv({ cls: "ed-stat-strong", text: "0" });
  return { wrap, value };
}
