// Shared pointer-based drag-to-reorder for card lists (interval/set editors,
// to-do items). Ported from Workout Timer's editor.js drag implementation.

// Only one drag gesture can be in flight at a time across the whole page.
// Tracking it here lets a new pointerdown forcibly tear down a stuck previous
// session (e.g. one a native browser gesture interrupted before it could
// clean up itself), instead of leaking listeners that corrupt every attempt
// after it.
let activeDragTeardown = null;

export function forceTeardownActiveDrag() {
  if (activeDragTeardown) {
    const teardown = activeDragTeardown;
    activeDragTeardown = null;
    teardown();
  }
}

// The handle needs touch-action: none set permanently in CSS, so a touch
// starting on it is never eligible to become a native scroll — unlike
// toggling touch-action mid-gesture, which browsers ignore for a touch
// that's already in progress.
export function enableDragReorder(card, handle, listEl, onReorder, options = {}) {
  handle.addEventListener("dragstart", (e) => e.preventDefault());
  handle.addEventListener("contextmenu", (e) => e.preventDefault());
  handle.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    forceTeardownActiveDrag();
    e.preventDefault();
    beginDrag(e, card, listEl, onReorder, options);
  });
}

function beginDrag(e, card, listEl, onReorder, options) {
  const rect = card.getBoundingClientRect();

  if (navigator.vibrate) navigator.vibrate(12);

  const placeholder = document.createElement("div");
  placeholder.className = "drag-placeholder";
  placeholder.style.height = rect.height + "px";
  card.before(placeholder);

  card.classList.add("dragging");
  card.style.position = "fixed";
  card.style.left = rect.left + "px";
  card.style.top = rect.top + "px";
  card.style.width = rect.width + "px";
  document.body.appendChild(card);

  const startY = e.clientY;
  const pointerId = e.pointerId;
  let nestTarget = null;

  // Captured once, before the reorder logic below ever moves the
  // placeholder — nest hit-testing uses this frozen snapshot rather than
  // live rects. Without this, the reorder fallback (which runs on any
  // frame the pointer isn't inside a nest zone) repositions the placeholder
  // and shifts sibling layout, which in turn shifts the nest zone the very
  // next frame, chasing the pointer instead of ever settling under it.
  const nestSiblingSnapshot = options.onHoverNest
    ? [...listEl.children].filter((c) => c !== placeholder).map((el) => ({ el, rect: el.getBoundingClientRect() }))
    : null;

  function onMove(ev) {
    if (ev.pointerId !== pointerId) return;
    const dy = ev.clientY - startY;
    card.style.top = rect.top + dy + "px";

    const pointerY = ev.clientY;
    const siblings = [...listEl.children].filter((c) => c !== placeholder);

    if (options.onHoverNest) {
      nestTarget = options.onHoverNest(nestSiblingSnapshot, pointerY, card);
    }
    if (nestTarget) {
      placeholder.remove();
      return;
    }

    // Use the pointer position itself (not the dragged card's midpoint) so
    // cards much taller or shorter than their siblings still land wherever
    // the finger/cursor actually is.
    let target = null;
    for (const sib of siblings) {
      const sRect = sib.getBoundingClientRect();
      if (pointerY < sRect.top + sRect.height / 2) {
        target = sib;
        break;
      }
    }
    if (target) listEl.insertBefore(placeholder, target);
    else listEl.appendChild(placeholder);
  }

  function finish(shouldReorder) {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    if (activeDragTeardown === finish) activeDragTeardown = null;

    card.classList.remove("dragging");
    card.style.position = "";
    card.style.left = "";
    card.style.top = "";
    card.style.width = "";

    if (options.onHoverNest) options.onClearNestHint?.();

    if (nestTarget && options.onDropNest) {
      options.onDropNest(nestTarget, card);
      if (placeholder.isConnected) placeholder.remove();
      // beginDrag() detached `card` to document.body for the drag; the nest
      // handler is expected to fully re-render the list from data, so this
      // now-stale node must be removed rather than left dangling off-screen.
      if (card.parentNode) card.parentNode.removeChild(card);
      return;
    }

    if (placeholder.isConnected) placeholder.replaceWith(card);
    else if (card.parentNode !== listEl) listEl.appendChild(card);

    if (shouldReorder) {
      const newOrder = [...listEl.children].map((el) => el.dataset.id);
      onReorder(newOrder);
    }
  }

  function onUp(ev) {
    if (ev.pointerId !== pointerId) return;
    finish(true);
  }

  activeDragTeardown = () => finish(false);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}
