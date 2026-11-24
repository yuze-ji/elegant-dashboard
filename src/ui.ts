import { App, Notice, setIcon } from "obsidian";
import { DataService } from "./data";
import { Strings } from "./i18n";
import { DashboardSettings, FocusTarget } from "./types";

export interface Ctx {
  app: App;
  data: DataService;
  t: Strings;
  settings: DashboardSettings;
  /** Persists settings (tasks, projects, focus log) to disk. */
  save: () => Promise<void>;
  /** Requests a full dashboard re-render. */
  refresh: () => void;
  /** Registers a cleanup callback run when the view unloads or re-renders. */
  onCleanup: (fn: () => void) => void;
  /** Switches the dashboard to one of its in-plugin pages (set by the view). */
  navigate?: (
    page: "projects" | "tasks" | "deadlines" | "habits" | "language" | "focus" | "links"
  ) => void;
  /** The plugin's focus engine, for "focus on this" buttons and time chips. */
  focus: {
    target: FocusTarget | null;
    running: boolean;
    setTarget: (t: FocusTarget | null) => Promise<void>;
    start: () => void;
    targetTotal: (t: { kind: string; id: string }) => number;
    /** Subscribe to timer state changes; returns the unsubscribe. */
    onChange: (fn: () => void) => () => void;
  };
}

/**
 * The ▶ button on a task row / project card: points the timer at it and
 * starts it. Starting is the common case; if the timer is already running
 * on something else, only the attribution switches (the engine flushes the
 * pending remainder to the old target first).
 */
export function renderFocusPlay(
  parent: HTMLElement,
  ctx: Ctx,
  engine: { target: FocusTarget | null; running: boolean; setTarget: (t: FocusTarget) => Promise<void>; start: () => void },
  target: FocusTarget,
  cls = "ed-task-icon"
): HTMLElement {
  const { t } = ctx;
  const btn = parent.createEl("button", { cls: `${cls} ed-focus-play` });
  const active =
    engine.running &&
    engine.target !== null &&
    engine.target.kind === target.kind &&
    engine.target.id === target.id;
  setIcon(btn, active ? "timer" : "play");
  if (active) btn.addClass("is-active");
  btn.setAttr("aria-label", t.focusPlay);
  btn.setAttr("title", t.focusPlay);
  btn.onclick = async (e) => {
    e.stopPropagation();
    await engine.setTarget(target);
    if (!engine.running) engine.start();
    new Notice(t.focusStartedOn(target.name), 3000);
    ctx.refresh();
  };
  return btn;
}

export function card(parent: HTMLElement, title?: string): HTMLElement {
  const el = parent.createDiv({ cls: "ed-card" });
  if (title) el.createDiv({ cls: "ed-card-title", text: title });
  return el;
}

export function empty(parent: HTMLElement, text: string): HTMLElement {
  return parent.createDiv({ cls: "ed-empty", text });
}

export function badge(parent: HTMLElement, text: string): HTMLElement {
  return parent.createDiv({ cls: "ed-badge", text });
}

/** Activity heat colours, carried over from the original dataviewjs dashboard. */
export const HEAT_COLORS = ["#E3E7E5", "#C8AADC", "#F3D98C", "#F0A868", "#E88E8E"];

export function heatLevel(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1 + Math.floor((count - 1) / 2), 4);
}

/**
 * A floating tooltip parented to <body> so it is never clipped by a card's
 * overflow or stacking context.
 */
export class HoverTooltip {
  readonly el: HTMLElement;

  constructor(onCleanup: (fn: () => void) => void) {
    this.el = document.body.createDiv({ cls: "ed-tooltip" });
    onCleanup(() => this.el.remove());
  }

  show() {
    this.el.addClass("is-visible");
  }

  hide() {
    this.el.removeClass("is-visible");
  }

  /** Keeps the tooltip inside the window, flipping sides near the edges. */
  move(e: MouseEvent) {
    const pad = 14;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    this.el.style.left = `${Math.max(8, x)}px`;
    this.el.style.top = `${Math.max(8, y)}px`;
  }
}

/**
 * Every delete in this plugin is final the moment it happens — there is no
 * version history or trash to fish it back out of, unlike a deleted line in
 * a markdown note. This is the standard shape for softening that: call it
 * right after a delete has already gone through, with a closure that puts
 * the item back. `noticeEl` is a documented part of Obsidian's `Notice`
 * class, so this needs no workaround to attach a button to it.
 */
export function notifyUndo(
  message: string,
  undoLabel: string,
  restore: () => void | Promise<void>
): void {
  const notice = new Notice(message, 6000);
  const btn = notice.noticeEl.createEl("button", { cls: "ed-undo-btn", text: undoLabel });
  btn.onclick = async (e) => {
    e.stopPropagation();
    notice.hide();
    await restore();
  };
}

export const TAG_COLORS = [
  "#C8AADC",
  "#F3D98C",
  "#F0A868",
  "#E88E8E",
  "#8FB8D9",
  "#9AD0B4",
];
