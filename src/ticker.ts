/**
 * A 1 Hz tick that survives a hidden window.
 *
 * Chromium freezes main-thread timers once the Obsidian window is hidden —
 * measured in this vault: zero `setInterval` callbacks in six seconds — which
 * would silently stall anything timed on the main thread (an alarm that never
 * rings while you are looking elsewhere, a focus session that stops counting
 * the moment you switch apps). Worker timers are exempt, and delivering their
 * message wakes the main thread.
 *
 * Shared by the alarm engine and the focus timer so both survive the same way.
 */
export class Ticker {
  private worker: Worker | null = null;
  private url: string | null = null;
  private fallback: number | null = null;

  start(fn: () => void) {
    const source = "setInterval(() => postMessage(0), 1000);";
    try {
      this.url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      this.worker = new Worker(this.url);
      this.worker.onmessage = () => fn();
    } catch {
      // Blob workers can be blocked on mobile; a throttled tick beats none.
      this.fallback = window.setInterval(fn, 1000);
    }
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
    if (this.fallback !== null) {
      window.clearInterval(this.fallback);
      this.fallback = null;
    }
  }
}
