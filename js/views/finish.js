import { formatClock, formatDate } from "../util.js";
import { launchConfetti } from "../confetti.js";

function groupByKind(intervals) {
  const groups = [];
  for (const interval of intervals) {
    const last = groups[groups.length - 1];
    if (last && last.kind === interval.kind && last.name === interval.name) {
      last.count += 1;
    } else {
      groups.push({ kind: interval.kind, name: interval.name, amount: interval.amount, count: 1 });
    }
  }
  return groups;
}

const KIND_LABEL = { focus: "Focus", break: "Break", longBreak: "Long break" };

export function renderFinish(root, nav, summary) {
  const tpl = document.getElementById("tpl-finish");
  root.replaceChildren(tpl.content.cloneNode(true));

  const canvas = root.querySelector("#confetti-canvas");
  requestAnimationFrame(() => launchConfetti(canvas));

  const summaryBox = root.querySelector("#summary-box");
  const strong = document.createElement("strong");
  strong.textContent = summary.timerName || "Untitled focus timer";
  summaryBox.appendChild(strong);
  summaryBox.appendChild(document.createTextNode(`\n${formatDate(summary.completedAt)}`));
  summaryBox.appendChild(document.createTextNode(`\nTotal time: ${formatClock(summary.totalSeconds)}\n\n`));
  groupByKind(summary.intervals).forEach((g) => {
    const label = KIND_LABEL[g.kind] || g.name;
    const line = g.count > 1 ? `• ${label} × ${g.count} (${formatClock(g.amount)} each)` : `• ${label} (${formatClock(g.amount)})`;
    summaryBox.appendChild(document.createTextNode(`${line}\n`));
  });

  root.querySelector("#done-btn").addEventListener("click", () => nav.toHome());
}
