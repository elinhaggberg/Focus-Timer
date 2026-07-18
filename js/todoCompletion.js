import { isTodoListComplete, todoCounts } from "./util.js";
import { addLogEntry } from "./storage.js";

// Call after toggling a checkbox (with the completion state from *before*
// the toggle). Detects a false -> true transition to "every item checked"
// and logs it — shared by the overview modal's direct checking and the
// randomize player's Done button, since either can be what finishes a list.
// A list can be logged as finished more than once (e.g. a reusable grocery
// list checked off again next week) — that's intentional, not a duplicate.
export function maybeLogCompletion(list, wasCompleteBefore) {
  const isCompleteNow = isTodoListComplete(list);
  if (isCompleteNow && !wasCompleteBefore) {
    const { total } = todoCounts(list);
    addLogEntry({
      kind: "todo",
      name: list.name || "Untitled list",
      itemsCompleted: total,
      totalItems: total,
      completedAt: Date.now(),
    });
  }
  return isCompleteNow;
}
