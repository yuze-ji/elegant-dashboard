/**
 * Flip-clock digits, built from four half-cards: two static halves that hold
 * the current value and two animated "leaves" that only exist during a flip.
 */

/** Total time of the two-phase flip; keep in sync with the CSS keyframes. */
const FLIP_MS = 600;

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export interface FlipDigit {
  root: HTMLElement;
  set: (value: string) => void;
  destroy: () => void;
}

export function flipDigit(parent: HTMLElement, initial: string): FlipDigit {
  const root = parent.createDiv({ cls: "ed-flip" });
  const topHalf = root.createDiv({ cls: "ed-flip-half is-top" });
  const topText = topHalf.createSpan({ cls: "ed-flip-text", text: initial });
  const botHalf = root.createDiv({ cls: "ed-flip-half is-bottom" });
  const botText = botHalf.createSpan({ cls: "ed-flip-text", text: initial });

  let current = initial;
  let leaves: HTMLElement[] = [];
  let timer: number | null = null;

  const clearLeaves = () => {
    leaves.forEach((l) => l.remove());
    leaves = [];
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const set = (next: string) => {
    if (next === current) return;
    const prev = current;
    current = next;
    // A pending flip is abandoned rather than queued: catching up matters more
    // than showing every intermediate value after the tab was backgrounded.
    clearLeaves();
    botText.setText(prev);
    topText.setText(next);

    if (reducedMotion()) {
      botText.setText(next);
      return;
    }

    const front = root.createDiv({ cls: "ed-flip-half is-top is-leaf is-front" });
    front.createSpan({ cls: "ed-flip-text", text: prev });
    const back = root.createDiv({ cls: "ed-flip-half is-bottom is-leaf is-back" });
    back.createSpan({ cls: "ed-flip-text", text: next });
    leaves = [front, back];

    timer = window.setTimeout(() => {
      botText.setText(next);
      clearLeaves();
    }, FLIP_MS + 20);
  };

  return { root, set, destroy: clearLeaves };
}

export interface FlipGroup {
  root: HTMLElement;
  /** Value is padded / truncated to the digit count. */
  set: (value: string) => void;
  destroy: () => void;
}

/**
 * A run of digits that flip independently, e.g. the "07" of 07:30. The group
 * grows past `count` when handed a longer value — a 180-minute countdown needs
 * three digits — and shrinks back to `count` afterwards.
 */
export function flipGroup(parent: HTMLElement, initial: string, count = 2): FlipGroup {
  const root = parent.createDiv({ cls: "ed-flip-group" });
  const padded = initial.padStart(count, "0").slice(-count);
  const digits = Array.from({ length: count }, (_, i) =>
    flipDigit(root, padded[i] ?? "0")
  );

  // Digits are added on the left, so the units column keeps its identity (and
  // its in-flight animation) when the value gains or loses a place.
  const resize = (n: number) => {
    while (digits.length < n) {
      const d = flipDigit(root, "0");
      root.insertBefore(d.root, root.firstChild);
      digits.unshift(d);
    }
    while (digits.length > n) {
      const d = digits.shift();
      d?.destroy();
      d?.root.remove();
    }
  };

  return {
    root,
    set: (value: string) => {
      resize(Math.max(count, value.length));
      const v = value.padStart(digits.length, "0").slice(-digits.length);
      digits.forEach((d, i) => d.set(v[i] ?? "0"));
    },
    destroy: () => digits.forEach((d) => d.destroy()),
  };
}

export function flipSeparator(parent: HTMLElement, blink = false): HTMLElement {
  const el = parent.createDiv({ cls: "ed-flip-sep" });
  if (blink) el.addClass("is-blinking");
  el.createSpan({ text: ":" });
  return el;
}
