export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function intervalMeta(interval) {
  return formatClock(interval.amount);
}

export function isSet(node) {
  return !!node && node.kind === "set";
}

// Expands set containers into their repeated intervals, in play order.
export function flattenNodes(nodes) {
  const flat = [];
  for (const node of nodes) {
    if (isSet(node)) {
      for (let r = 0; r < node.rounds; r++) {
        for (const interval of node.intervals) {
          flat.push({ ...interval, setId: node.id, setName: node.name || "Set", setRound: r + 1, setTotalRounds: node.rounds });
        }
      }
    } else {
      flat.push(node);
    }
  }
  return flat;
}

export function setMeta(setNode) {
  const n = setNode.intervals.length;
  if (n === 0) return "No intervals yet";
  const totalSecs = setNode.intervals.reduce((sum, i) => sum + i.amount, 0) * setNode.rounds;
  return `${n} interval${n !== 1 ? "s" : ""} per round · ${formatClock(totalSecs)} total`;
}

// Builds the classic Pomodoro play sequence: `rounds` repeats of the block
// list (Focus + Short Break, in whatever order they've been dragged to),
// followed by one Long Break if enabled. The very last round's break block
// is skipped in favor of the Long Break, same as the classic technique.
export function pomodoroSequence(pomodoro) {
  const flat = [];
  for (let r = 1; r <= pomodoro.rounds; r++) {
    pomodoro.blocks.forEach((block, i) => {
      const isLastRound = r === pomodoro.rounds;
      const isTrailingBreak = isLastRound && block.kind === "break" && i === pomodoro.blocks.length - 1 && pomodoro.longBreak.enabled;
      if (isTrailingBreak) return;
      flat.push({ ...block, round: r, totalRounds: pomodoro.rounds });
    });
  }
  if (pomodoro.longBreak.enabled) {
    flat.push({ ...pomodoro.longBreak, round: pomodoro.rounds, totalRounds: pomodoro.rounds });
  }
  return flat;
}

export function pomodoroMeta(pomodoro) {
  const seq = pomodoroSequence(pomodoro);
  const totalSecs = seq.reduce((sum, i) => sum + i.amount, 0);
  return `${pomodoro.rounds} round${pomodoro.rounds !== 1 ? "s" : ""} · ${formatClock(totalSecs)} total`;
}

export function focusTimerMeta(timer) {
  if (timer.type === "pomodoro") return pomodoroMeta(timer.pomodoro);
  const flat = flattenNodes(timer.custom.intervals);
  const n = flat.length;
  if (n === 0) return "No intervals yet";
  const totalSecs = flat.reduce((sum, i) => sum + i.amount, 0);
  return `${n} interval${n !== 1 ? "s" : ""} · ${formatClock(totalSecs)} total`;
}

export function focusTimerSequence(timer) {
  if (timer.type === "pomodoro") return pomodoroSequence(timer.pomodoro);
  return flattenNodes(timer.custom.intervals).map((i) => ({ ...i, kind: "focus" }));
}

// ---- To-do lists ----

// Flattens a list's items (top-level + one level of children) into a single
// array, each tagged with its parent's text when it has one — used both to
// count progress and to build the randomizable pool for the player.
export function flattenTodoItems(list) {
  const flat = [];
  for (const item of list.items) {
    flat.push({ ...item, parentText: null });
    for (const child of item.children || []) {
      flat.push({ ...child, parentText: item.text });
    }
  }
  return flat;
}

export function todoCounts(list) {
  const flat = flattenTodoItems(list);
  const total = flat.length;
  const checked = flat.filter((i) => i.checked).length;
  return { checked, total };
}

export function todoListMeta(list) {
  const { checked, total } = todoCounts(list);
  if (total === 0) return "No items yet";
  return `${checked}/${total} checked`;
}

export function isTodoListComplete(list) {
  const { checked, total } = todoCounts(list);
  return total > 0 && checked === total;
}

// Plain-text rendering for sharing — indents children under their parent.
export function todoListToText(list) {
  const lines = [list.name || "Untitled list", ""];
  for (const item of list.items) {
    lines.push(`${item.checked ? "☑" : "☐"} ${item.text}`);
    for (const child of item.children || []) {
      lines.push(`  ${child.checked ? "☑" : "☐"} ${child.text}`);
    }
  }
  return lines.join("\n");
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
