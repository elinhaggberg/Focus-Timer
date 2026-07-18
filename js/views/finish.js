import { formatClock, formatDate } from "../util.js";
import { launchConfetti } from "../confetti.js";
import { addLogEntry, getGoals } from "../storage.js";
import { computeGoalStatus, describeGoal } from "../goals.js";
import { getTheme, PLAYFUL_SWATCHES } from "../theme.js";
import { ICON_GOAL } from "../icons.js";

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
  const isPlayful = getTheme().mode === "playful";
  const confettiOptions = isPlayful ? { colors: PLAYFUL_SWATCHES.map((s) => s.accent) } : {};
  requestAnimationFrame(() => launchConfetti(canvas, confettiOptions));

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

  // Every completed focus session is logged automatically — this only runs
  // once, since renderFinish only fires on an actual finish event (a page
  // reload on #/finish has no pending summary and bounces to Home).
  addLogEntry({
    kind: "focus",
    name: summary.timerName || "Untitled focus timer",
    totalSeconds: summary.totalSeconds,
    intervals: summary.intervals,
    completedAt: summary.completedAt,
  });

  const goals = getGoals();
  const goalStatusBox = root.querySelector("#goal-status-box");
  if (goals.length > 0) {
    goalStatusBox.classList.remove("hidden");
    goalStatusBox.replaceChildren(
      ...goals.map((goal) => {
        const { progress, streak } = computeGoalStatus(goal);
        const row = document.createElement("div");
        row.className = "goal-status-row";
        const icon = document.createElement("span");
        icon.className = "goal-status-icon";
        icon.innerHTML = ICON_GOAL;
        const label = document.createElement("span");
        label.className = "goal-status-label";
        label.textContent = `${describeGoal(goal)}: ${progress.count}/${progress.target} this week`;
        row.append(icon, label);
        if (streak > 0) {
          const streakEl = document.createElement("span");
          streakEl.className = "goal-status-streak";
          streakEl.textContent = `🔥 ${streak}`;
          row.appendChild(streakEl);
        }
        return row;
      })
    );
  }

  root.querySelector("#done-btn").addEventListener("click", () => nav.toHome());
}
