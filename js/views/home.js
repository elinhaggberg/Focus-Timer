import {
  getFocusTimers,
  getActivity,
  exportBackupData,
  importData,
  getHomeTitle,
  setHomeTitle,
  getGoals,
} from "../storage.js";
import { focusTimerMeta } from "../util.js";
import { unlockAudio } from "../audio.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload, filenameFor } from "../share.js";
import { getTheme, setTheme } from "../theme.js";
import { activityIconSvg } from "../activityIcons.js";
import { openFocusPreview } from "./focusEditor.js";
import { openActivitiesLibrary } from "./activitiesLibrary.js";
import { computeGoalStatus, describeGoal } from "../goals.js";

const GENERIC_TIMER_ICON =
  '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><circle cx="256" cy="256" r="216" fill="none" stroke="currentColor" stroke-width="40"/><rect x="236" y="120" width="40" height="170" rx="20"/><rect x="256" y="226" width="140" height="40" rx="20"/></svg>';

export function renderHome(root, nav) {
  const tpl = document.getElementById("tpl-home");
  root.replaceChildren(tpl.content.cloneNode(true));

  document.getElementById("home-title").textContent = getHomeTitle();

  document.getElementById("new-focus-timer-btn").addEventListener("click", () => nav.toFocusEditor(null));
  document.getElementById("new-todo-btn").addEventListener("click", () => {
    // To-do lists ship in a follow-up pass; the card is already wired for it.
  });
  document.getElementById("settings-btn").addEventListener("click", openSettingsMenu);
  document.getElementById("home-goal-strip").addEventListener("click", () => nav.toGoals());

  renderGoalStrip();
  renderList();

  function renderGoalStrip() {
    const strip = document.getElementById("home-goal-strip");
    const goal = getGoals().find((g) => g.showOnHome);
    if (!goal) {
      strip.classList.add("hidden");
      return;
    }
    const { progress, streak } = computeGoalStatus(goal);
    const pct = progress.target > 0 ? Math.min(100, (progress.count / progress.target) * 100) : 0;
    strip.classList.remove("hidden");
    strip.querySelector(".home-goal-label").textContent = describeGoal(goal);
    strip.querySelector(".home-goal-progress-fill").style.width = `${pct}%`;
    strip.querySelector(".home-goal-streak").textContent = streak > 0 ? `🔥 ${streak}` : `${progress.count}/${progress.target}`;
  }

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

  function openSettingsMenu() {
    const sheet = openSheet("tpl-settings-menu");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector("#log-btn").addEventListener("click", () => {
      sheet.close();
      nav.toLog();
    });
    sheet.el.querySelector("#goals-btn").addEventListener("click", () => {
      sheet.close();
      nav.toGoals();
    });
    sheet.el.querySelector("#instructions-btn").addEventListener("click", () => {
      sheet.close();
      openInstructions();
    });
    sheet.el.querySelector("#customize-btn").addEventListener("click", () => {
      sheet.close();
      openCustomize();
    });
    sheet.el.querySelector("#activities-library-btn").addEventListener("click", () => {
      sheet.close();
      openActivitiesLibrary();
    });
    sheet.el.querySelector("#export-all-btn").addEventListener("click", async () => {
      const data = exportBackupData();
      const stamp = new Date().toISOString().slice(0, 10);
      await shareOrDownload(`focus-timer-backup-${stamp}.json`, JSON.stringify(data, null, 2));
      sheet.close();
    });
    sheet.el.querySelector("#import-btn").addEventListener("click", () => {
      sheet.close();
      openImport();
    });
  }

  function openInstructions() {
    const sheet = openSheet("tpl-instructions");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  }

  function openCustomize() {
    const sheet = openSheet("tpl-customize");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

    const titleInput = sheet.el.querySelector("#home-title-input");
    titleInput.value = getHomeTitle();
    titleInput.addEventListener("input", () => {
      setHomeTitle(titleInput.value);
      document.getElementById("home-title").textContent = getHomeTitle();
    });

    const accentPicker = sheet.el.querySelector("#playful-accent-picker");
    const themeButtons = sheet.el.querySelectorAll(".theme-option");
    const swatchButtons = sheet.el.querySelectorAll(".swatch-btn");

    function renderActiveState() {
      const pref = getTheme();
      themeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.themeMode === pref.mode));
      swatchButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.accent === pref.playfulAccent));
      accentPicker.classList.toggle("hidden", pref.mode !== "playful");
    }

    themeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setTheme({ ...getTheme(), mode: btn.dataset.themeMode });
        renderActiveState();
      });
    });
    swatchButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setTheme({ ...getTheme(), playfulAccent: btn.dataset.accent });
        renderActiveState();
      });
    });

    renderActiveState();
  }

  function openImport() {
    const sheet = openSheet("tpl-import");
    const fileInput = sheet.el.querySelector(".import-file-input");
    const messageEl = sheet.el.querySelector(".import-message");

    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector(".import-file-btn").addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      messageEl.classList.remove("error");

      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        messageEl.textContent = "That doesn't look like valid JSON.";
        messageEl.classList.add("error");
        return;
      }
      try {
        const result = importData(parsed);
        messageEl.textContent = `Imported ${result.timerCount} focus timer${result.timerCount !== 1 ? "s" : ""}.`;
        renderList();
        renderGoalStrip();
        setTimeout(() => sheet.close(), 900);
      } catch (err) {
        messageEl.textContent = err.message || "That doesn't look like a valid backup file.";
        messageEl.classList.add("error");
      }
    });
  }
}
