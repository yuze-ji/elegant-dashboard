import { Notice } from "obsidian";
import { FocusEngine } from "../focus";
import { FocusTarget, focusTargetKey } from "../types";
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

  // mode switch — icon and label in separate spans, so a narrow card can
  // keep just the icons (see the .ed-focus container query) instead of
  // overflowing or ellipsising the words.
  const modeRow = root.createDiv({ cls: "ed-focus-modes" });
  const modeBtn = (label: string) => {
    const b = modeRow.createEl("button", { cls: "ed-mode-btn" });
    const sp = label.indexOf(" ");
    const icon = sp > 0 ? label.slice(0, sp) : "";
    const text = sp > 0 ? label.slice(sp + 1) : label;
    if (icon) b.createSpan({ cls: "ed-mode-ico", text: icon });
    b.createSpan({ cls: "ed-mode-txt", text });
    b.setAttr("title", text);
    b.setAttr("aria-label", text);
    return b;
  };
  const countdownBtn = modeBtn(t.countdownMode);
  const accumulateBtn = modeBtn(t.accumulateMode);
  const pomodoroBtn = modeBtn(t.pomodoroMode);

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

  // What this session counts towards. Open tasks and unfinished projects;
  // the current target is kept in the list even if it has since been
  // finished, so the dropdown never shows something other than the truth.
  const targetRow = info.createDiv({ cls: "ed-focus-target" });
  targetRow.createSpan({ cls: "ed-focus-set-label", text: t.focusTargetLabel });
  const targetSelect = targetRow.createEl("select", { cls: "ed-focus-target-select" });
  const targetTotal = targetRow.createSpan({ cls: "ed-focus-target-total" });
  const fillTargets = () => {
    targetSelect.empty();
    targetSelect.createEl("option", { value: "", text: t.focusNoTarget });
    const current = engine.target;
    const currentKey = current ? focusTargetKey(current) : "";
    let currentListed = !current;
    // Habits first: they are the recurring things focus time usually goes to
    // (language study, paper reading…), while projects stay a rough overview.
    const habits = ctx.settings.habits;
    if (habits.length > 0) {
      const g = targetSelect.createEl("optgroup");
      g.label = t.focusTargetHabits;
      for (const h of habits) {
        const key = `habit:${h.id}`;
        g.createEl("option", { value: key, text: h.name });
        if (key === currentKey) currentListed = true;
      }
    }
    const tasks = ctx.settings.storedTasks.filter((x) => !x.done);
    if (tasks.length > 0) {
      const g = targetSelect.createEl("optgroup");
      g.label = t.focusTargetTasks;
      for (const x of tasks) {
        const key = `task:${x.id}`;
        g.createEl("option", { value: key, text: x.text });
        if (key === currentKey) currentListed = true;
      }
    }
    const projects = ctx.settings.storedProjects.filter((p) => p.status !== "done");
    if (projects.length > 0) {
      const g = targetSelect.createEl("optgroup");
      g.label = t.focusTargetProjects;
      for (const p of projects) {
        const key = `project:${p.id}`;
        g.createEl("option", { value: key, text: p.name });
        if (key === currentKey) currentListed = true;
      }
    }
    if (current && !currentListed) {
      targetSelect.createEl("option", { value: currentKey, text: current.name });
    }
    targetSelect.value = currentKey;
  };
  fillTargets();
  targetSelect.onchange = () => {
    const v = targetSelect.value;
    if (!v) {
      void engine.setTarget(null);
      return;
    }
    const [kind, id] = v.split(":") as [FocusTarget["kind"], string];
    const name =
      kind === "task"
        ? ctx.settings.storedTasks.find((x) => x.id === id)?.text
        : kind === "habit"
          ? ctx.settings.habits.find((h) => h.id === id)?.name
          : ctx.settings.storedProjects.find((p) => p.id === id)?.name;
    void engine.setTarget({ kind, id, name: name ?? v });
  };

  const statsRow = info.createDiv({ cls: "ed-focus-stats" });
  const todayStat = statBlock(statsRow, t.todayFocus);
  const monthStat = statBlock(statsRow, t.monthTotal);

  const controls = info.createDiv({ cls: "ed-focus-controls" });
  const startBtn = controls.createEl("button", { cls: "ed-btn", text: t.start });
  const pauseBtn = controls.createEl("button", { cls: "ed-btn", text: t.pause });
  const resetBtn = controls.createEl("button", { cls: "ed-btn", text: t.reset });
  const skipBtn = controls.createEl("button", { cls: "ed-btn ed-focus-skip", text: t.pomodoroSkip });

  const phaseLabel = () => {
    const s = ctx.settings;
    if (engine.phase === "work") return t.pomodoroWorkLabel(engine.round + 1, s.pomodoroRounds);
    return engine.phase === "short" ? t.pomodoroShortLabel : t.pomodoroLongLabel;
  };

  const paint = () => {
    countdownBtn.toggleClass("is-active", engine.mode === "countdown");
    accumulateBtn.toggleClass("is-active", engine.mode === "accumulate");
    pomodoroBtn.toggleClass("is-active", engine.mode === "pomodoro");
    setRow.toggleClass("is-hidden", engine.mode !== "countdown");
    skipBtn.toggleClass("is-hidden", engine.mode !== "pomodoro");
    root.toggleClass("is-break", engine.mode === "pomodoro" && engine.phase !== "work");

    // Pomodoro always shows which phase / round is on the clock, running or
    // not — that is the one thing the user needs to know between phases.
    const sub =
      engine.mode === "pomodoro"
        ? phaseLabel()
        : engine.running
          ? engine.mode === "countdown"
            ? t.countdownLabel
            : t.accumulateLabel
          : "";
    face.paint(mmss(engine.displaySeconds), sub, engine.progress);

    todayStat.value.setText(`${engine.todayMinutes()}${t.minuteUnit}`);
    monthStat.value.setText(`${engine.monthMinutes()}${t.minuteUnit}`);

    startBtn.disabled = engine.running;
    pauseBtn.disabled = !engine.running;

    const target = engine.target;
    const key = target ? focusTargetKey(target) : "";
    if (targetSelect.value !== key) fillTargets();
    targetTotal.setText(target ? t.focusTargetTotal(engine.targetTotal(target)) : "");
  };

  countdownBtn.onclick = () => void engine.switchMode("countdown");
  accumulateBtn.onclick = () => void engine.switchMode("accumulate");
  pomodoroBtn.onclick = () => void engine.switchMode("pomodoro");
  skipBtn.onclick = () => void engine.skipPhase();
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
