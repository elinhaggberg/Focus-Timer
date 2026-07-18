import {
  getFocusTimers,
  getTodoLists,
  getActivity,
  exportBackupData,
  importData,
  getHomeTitle,
  setHomeTitle,
  getGoals,
  getAlarmSound,
  setAlarmSound,
} from "../storage.js";
import { focusTimerMeta, todoListMeta } from "../util.js";
import { unlockAudio, previewAlarm } from "../audio.js";
import { openSheet } from "../sheet.js";
import { shareOrDownload, filenameFor } from "../share.js";
import { getTheme, setTheme } from "../theme.js";
import { activityIconSvg } from "../activityIcons.js";
import { openFocusPreview } from "./focusEditor.js";
import { openActivitiesLibrary } from "./activitiesLibrary.js";
import { openTodoOverview } from "./todoOverview.js";
import { computeGoalStatus, describeGoal } from "../goals.js";

const GENERIC_TIMER_ICON =
  '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><circle cx="256" cy="256" r="216" fill="none" stroke="currentColor" stroke-width="40"/><rect x="236" y="120" width="40" height="170" rx="20"/><rect x="256" y="226" width="140" height="40" rx="20"/></svg>';

const ALARM_SOUND_OPTIONS = [
  { key: "classic", label: "Classic beep" },
  { key: "chime", label: "Chime" },
  { key: "urgent", label: "Urgent" },
];

const TODO_ICON =
  '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><rect x="32" y="48" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="60" width="352" height="32" rx="16"/><rect x="32" y="228" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="240" width="352" height="32" rx="16"/><rect x="32" y="408" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="420" width="352" height="32" rx="16"/></svg>';

export function renderHome(root, nav) {
  const tpl = document.getElementById("tpl-home");
  root.replaceChildren(tpl.content.cloneNode(true));

  document.getElementById("home-title").textContent = getHomeTitle();

  document.getElementById("new-focus-timer-btn").addEventListener("click", () => nav.toFocusEditor(null));
  document.getElementById("new-todo-btn").addEventListener("click", () => nav.toTodoEditor(null));
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
    const focusItems = getFocusTimers().map((t) => ({ kind: "focus", data: t }));
    const todoItems = getTodoLists().map((l) => ({ kind: "todo", data: l }));
    const items = [...focusItems, ...todoItems].sort((a, b) => b.data.createdAt - a.data.createdAt);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nothing saved yet. Tap a card above to create your first one.";
      listEl.replaceChildren(empty);
      return;
    }

    const cardTpl = document.getElementById("tpl-saved-card");
    const nodes = items.map((entry) => (entry.kind === "focus" ? buildFocusCard(entry.data) : buildTodoCard(entry.data)));
    listEl.replaceChildren(...nodes);

    function buildFocusCard(timer) {
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
    }

    function buildTodoCard(list) {
      const node = cardTpl.content.cloneNode(true);
      const card = node.querySelector(".saved-card");
      node.querySelector(".card-icon").innerHTML = TODO_ICON;
      node.querySelector(".card-title").textContent = list.name || "Untitled list";
      node.querySelector(".card-meta").textContent = `To-do list · ${todoListMeta(list)}`;
      node.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        nav.toTodoEditor(list.id);
      });
      const playBtn = node.querySelector(".play-btn");
      playBtn.setAttribute("aria-label", "Open");
      playBtn.title = "Open";
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openTodoOverview(list.id, nav, { onDeleted: renderList });
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".card-actions")) return;
        openTodoOverview(list.id, nav, { onDeleted: renderList });
      });
      return node;
    }
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

    const alarmSoundListEl = sheet.el.querySelector("#alarm-sound-list");
    let selectedAlarmSound = getAlarmSound();
    const alarmRows = ALARM_SOUND_OPTIONS.map(({ key, label }) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "alarm-sound-row";
      row.classList.toggle("active", key === selectedAlarmSound);
      const name = document.createElement("span");
      name.textContent = label;
      const check = document.createElement("span");
      check.className = "alarm-sound-check";
      row.append(name, check);
      row.addEventListener("click", () => {
        selectedAlarmSound = key;
        setAlarmSound(key);
        alarmRows.forEach((r, i) => r.classList.toggle("active", ALARM_SOUND_OPTIONS[i].key === key));
        previewAlarm(key);
      });
      return row;
    });
    alarmSoundListEl.replaceChildren(...alarmRows);
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
        const parts = [];
        if (result.timerCount) parts.push(`${result.timerCount} focus timer${result.timerCount !== 1 ? "s" : ""}`);
        if (result.todoListCount) parts.push(`${result.todoListCount} to-do list${result.todoListCount !== 1 ? "s" : ""}`);
        messageEl.textContent = parts.length ? `Imported ${parts.join(" and ")}.` : "Nothing new to import.";
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
