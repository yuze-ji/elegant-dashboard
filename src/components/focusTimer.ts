import { Notice } from "obsidian";
import { FocusEngine } from "../focus";
import { drawDial, themeColors } from "../charts";
import { Ctx, card } from "../ui";
import { mmss } from "../dates";

const DIAL_SIZE = 140;

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
  const dialWrap = contentRow.createDiv({ cls: "ed-dial" });
  const canvas = dialWrap.createEl("canvas");

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
    drawDial(
      canvas,
      DIAL_SIZE,
      engine.progress,
      mmss(engine.displaySeconds),
      sub,
      themeColors()
    );

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
