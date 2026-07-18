import { getFocusTimers, getActivity } from "../storage.js";
import { focusTimerMeta } from "../util.js";
import { unlockAudio } from "../audio.js";
import { getTheme, setTheme } from "../theme.js";
import { activityIconSvg } from "../activityIcons.js";
import { openFocusPreview } from "./focusEditor.js";

const GENERIC_TIMER_ICON =
  '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><circle cx="256" cy="256" r="216" fill="none" stroke="currentColor" stroke-width="40"/><rect x="236" y="120" width="40" height="170" rx="20"/><rect x="256" y="226" width="140" height="40" rx="20"/></svg>';

export function renderHome(root, nav) {
  const tpl = document.getElementById("tpl-home");
  root.replaceChildren(tpl.content.cloneNode(true));

  document.getElementById("new-focus-timer-btn").addEventListener("click", () => nav.toFocusEditor(null));
  document.getElementById("new-todo-btn").addEventListener("click", () => {
    // To-do lists ship in a follow-up pass; the card is already wired for it.
  });

  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  themeToggleBtn.addEventListener("click", () => {
    const next = getTheme().mode === "dark" ? "light" : "dark";
    setTheme({ mode: next });
  });

  renderList();

  function renderList() {
    const listEl = document.getElementById("saved-list");
    const timers = getFocusTimers()
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);

    if (timers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nothing saved yet. Tap a card above to create your first one.";
      listEl.replaceChildren(empty);
      return;
    }

    const cardTpl = document.getElementById("tpl-saved-card");
    const nodes = timers.map((timer) => {
      const node = cardTpl.content.cloneNode(true);
      const card = node.querySelector(".saved-card");
      const iconEl = node.querySelector(".card-icon");
      const activity = timer.activityId ? getActivity(timer.activityId) : null;
      iconEl.innerHTML = activity ? activityIconSvg(activity.iconKey) : GENERIC_TIMER_ICON;
      node.querySelector(".card-title").textContent = timer.name || "Untitled focus timer";
      const typeLabel = timer.type === "pomodoro" ? "Pomodoro" : "Custom";
      node.querySelector(".card-meta").textContent = `${typeLabel} · ${focusTimerMeta(timer)}`;
      node.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        nav.toFocusEditor(timer.id);
      });
      node.querySelector(".play-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        startTimer(timer.id);
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".card-actions")) return;
        openFocusPreview(timer.id, nav, { onDeleted: renderList });
      });
      return node;
    });
    listEl.replaceChildren(...nodes);
  }

  function startTimer(id) {
    unlockAudio();
    nav.toFocusPlayer(id);
  }
}
