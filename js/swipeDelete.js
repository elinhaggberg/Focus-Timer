// Swipe-left-to-reveal-trash gesture for list rows (currently the "My saved
// activities" cards). `touch-action: pan-y` is set permanently in CSS on the
// content element — browsers ignore toggling touch-action mid-gesture for
// touch input, so it can't be flipped on only once a horizontal drag starts
// (see dragReorder.js for the same constraint on its handles).

const REVEAL_WIDTH = 76;

let openRow = null;
let openContent = null;

function closeOpenSwipe() {
  if (openContent) {
    openContent.style.transition = "transform 0.2s ease";
    openContent.style.transform = "translateX(0px)";
  }
  openRow = null;
  openContent = null;
}

// Call when the list is about to be rebuilt, so a stale reference from a row
// that's being thrown away doesn't linger.
export function closeAnySwipe() {
  closeOpenSwipe();
}

export function enableSwipeToDelete(row, content) {
  let startX = 0;
  let startY = 0;
  let startTranslate = 0;
  let current = 0;
  let axis = null; // null until the first few pixels decide "x" or "y"
  let pointerId = null;
  let suppressClick = false;

  function isOpen() {
    return openRow === row;
  }

  content.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startTranslate = isOpen() ? -REVEAL_WIDTH : 0;
    current = startTranslate;
    axis = null;
    content.style.transition = "none";
  });

  content.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "x") {
        content.setPointerCapture(pointerId);
        if (openRow && openRow !== row) closeOpenSwipe();
      }
    }
    if (axis !== "x") return;
    e.preventDefault();
    current = Math.min(0, Math.max(-REVEAL_WIDTH, startTranslate + dx));
    content.style.transform = `translateX(${current}px)`;
  });

  function finish(e) {
    if (e.pointerId !== pointerId) return;
    content.style.transition = "transform 0.2s ease";
    if (axis === "x") {
      const shouldOpen = current <= -REVEAL_WIDTH / 2;
      content.style.transform = shouldOpen ? `translateX(-${REVEAL_WIDTH}px)` : "translateX(0px)";
      if (shouldOpen) {
        openRow = row;
        openContent = content;
      } else if (isOpen()) {
        openRow = null;
        openContent = null;
      }
    } else if (axis === null && isOpen()) {
      // A plain tap (no drag) on a row that's already open just closes it —
      // the tap shouldn't also trigger whatever the card underneath does.
      suppressClick = true;
      closeOpenSwipe();
    }
    axis = null;
    pointerId = null;
  }

  content.addEventListener("pointerup", finish);
  content.addEventListener("pointercancel", finish);

  content.addEventListener(
    "click",
    (e) => {
      if (!suppressClick) return;
      suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );
}
