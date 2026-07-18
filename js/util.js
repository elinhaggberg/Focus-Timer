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

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
