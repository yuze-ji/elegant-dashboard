/**
 * Minimal HTML5 drag-and-drop for reordering within one list. One module-level
 * "what is being dragged" record, because dataTransfer is unreadable during
 * dragover in Chromium and the plugin only ever drags one thing at a time.
 *
 * `group` keeps drops inside the list they started in: a task from the
 * To-do column can't land in Today (the column is derived from due date /
 * section, not from position, so the drop would silently do nothing).
 */
let current: { id: string; group: string } | null = null;

export function makeDraggable(
  el: HTMLElement,
  id: string,
  group: string,
  /** "y" for a vertical list (before = above), "x" for a wrapping card grid (before = left). */
  axis: "x" | "y",
  onDrop: (draggedId: string, after: boolean) => void
) {
  el.draggable = true;
  el.addClass("ed-draggable");

  const clear = () => {
    el.removeClass("is-drop-before");
    el.removeClass("is-drop-after");
  };

  el.addEventListener("dragstart", (e: DragEvent) => {
    current = { id, group };
    el.addClass("is-dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    }
  });
  el.addEventListener("dragend", () => {
    current = null;
    el.removeClass("is-dragging");
    clear();
  });
  el.addEventListener("dragover", (e: DragEvent) => {
    if (!current || current.group !== group || current.id === id) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const r = el.getBoundingClientRect();
    const after =
      axis === "y" ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    el.toggleClass("is-drop-before", !after);
    el.toggleClass("is-drop-after", after);
  });
  el.addEventListener("dragleave", clear);
  el.addEventListener("drop", (e: DragEvent) => {
    if (!current || current.group !== group || current.id === id) return;
    e.preventDefault();
    const after = el.hasClass("is-drop-after");
    clear();
    const dragged = current.id;
    current = null;
    onDrop(dragged, after);
  });
}
