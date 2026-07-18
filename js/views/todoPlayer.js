import { getTodoList, saveTodoList, getSoundEnabled } from "../storage.js";
import { flattenTodoItems, formatClock, isTodoListComplete } from "../util.js";
import { launchConfetti } from "../confetti.js";
import { maybeLogCompletion } from "../todoCompletion.js";
import * as audio from "../audio.js";
import { setWakeLockWanted } from "../wakelock.js";
import { getTheme, PLAYFUL_SWATCHES } from "../theme.js";
import { openSheet } from "../sheet.js";

const RING_CIRCUMFERENCE = 2 * Math.PI * 54;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function renderTodoPlayer(root, nav, todoId, config) {
  const list = getTodoList(todoId);
  if (!list) {
    nav.toHome();
    return;
  }
  const timerMode = config?.timerMode || "none";
  const duration = config?.duration || 30;

  const totalItems = flattenTodoItems(list).length;
  let queue = shuffle(flattenTodoItems(list).filter((i) => !i.checked).map((i) => i.id));

  const tpl = document.getElementById("tpl-todo-player");
  root.replaceChildren(tpl.content.cloneNode(true));

  const totalTimerEl = root.querySelector("#todo-total-timer");
  const progressCountEl = root.querySelector("#todo-progress-count");
  const progressFillEl = root.querySelector("#todo-player-progress-fill");
  const parentContextEl = root.querySelector("#todo-parent-context");
  const itemTextEl = root.querySelector("#todo-item-text");
  const countdownRingEl = root.querySelector("#todo-countdown-ring");
  const countdownRingFillEl = root.querySelector("#todo-countdown-ring-fill");
  const itemTimerEl = root.querySelector("#todo-item-timer");
  const checkAnimEl = root.querySelector("#todo-check-anim");
  const confettiCanvas = root.querySelector("#todo-item-confetti-canvas");
  const doneBtn = root.querySelector("#todo-done-btn");
  const randomizeAgainBtn = root.querySelector("#todo-randomize-again-btn");

  audio.setEnabled(getSoundEnabled());
  setWakeLockWanted(true);

  let itemRemaining = duration;
  let overallRemaining = duration;
  let tickHandle = null;
  let busy = false; // guards against double-tapping Done mid-animation

  if (timerMode === "overall") {
    totalTimerEl.classList.remove("hidden");
  }

  startTicking();

  function findLiveItem(id) {
    for (const item of list.items) {
      if (item.id === id) return item;
      const child = (item.children || []).find((c) => c.id === id);
      if (child) return child;
    }
    return null;
  }

  function parentTextFor(id) {
    for (const item of list.items) {
      if ((item.children || []).some((c) => c.id === id)) return item.text;
    }
    return null;
  }

  function startTicking() {
    if (timerMode === "none") return;
    tickHandle = setInterval(tick, 1000);
  }

  function stopTicking() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function tick() {
    if (timerMode === "perItem") {
      itemRemaining = Math.max(0, itemRemaining - 1);
    } else if (timerMode === "overall") {
      overallRemaining = Math.max(0, overallRemaining - 1);
      if (overallRemaining <= 0) {
        finish("timeup");
        return;
      }
    }
    render();
  }

  function render() {
    if (queue.length === 0) {
      finish("done");
      return;
    }
    const currentId = queue[0];
    const item = findLiveItem(currentId);
    itemTextEl.textContent = item ? item.text : "";

    const parentText = parentTextFor(currentId);
    if (parentText) {
      parentContextEl.textContent = `Part of: ${parentText}`;
      parentContextEl.classList.remove("hidden");
    } else {
      parentContextEl.classList.add("hidden");
    }

    const checkedCount = totalItems - queue.length;
    progressCountEl.textContent = `${checkedCount}/${totalItems}`;
    progressFillEl.style.width = `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%`;

    if (timerMode === "overall") {
      totalTimerEl.textContent = formatClock(overallRemaining);
    }

    if (timerMode === "perItem") {
      countdownRingEl.classList.remove("hidden");
      itemTimerEl.classList.remove("hidden");
      itemTimerEl.textContent = formatClock(itemRemaining);
      itemTimerEl.className = "big-number" + (itemRemaining <= 3 ? " countdown" : "");
      const fraction = 1 - itemRemaining / duration;
      countdownRingFillEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, fraction))));
    } else {
      countdownRingEl.classList.add("hidden");
      itemTimerEl.classList.add("hidden");
    }

    randomizeAgainBtn.classList.toggle("hidden", queue.length <= 1);
  }

  function resetItemTimer() {
    itemRemaining = duration;
  }

  doneBtn.addEventListener("click", () => {
    if (busy || queue.length === 0) return;
    busy = true;
    const currentId = queue[0];
    const wasComplete = isTodoListComplete(list);
    const item = findLiveItem(currentId);
    if (item) item.checked = true;
    saveTodoList(list);
    maybeLogCompletion(list, wasComplete);

    audio.intervalEnd();
    playCheckBurst();

    setTimeout(() => {
      queue.shift();
      resetItemTimer();
      busy = false;
      render();
    }, 550);
  });

  randomizeAgainBtn.addEventListener("click", () => {
    if (busy || queue.length <= 1) return;
    const skipped = queue.shift();
    const insertAt = 1 + Math.floor(Math.random() * queue.length);
    queue.splice(insertAt, 0, skipped);
    resetItemTimer();
    render();
  });

  root.querySelector("#todo-show-list-btn").addEventListener("click", () => {
    const sheet = openSheet("tpl-todo-full-list-sheet");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    const listEl = sheet.el.querySelector("#todo-full-list");
    const rows = [];
    for (const item of list.items) {
      rows.push(buildReadOnlyRow(item));
      for (const child of item.children || []) rows.push(buildReadOnlyRow(child, true));
    }
    listEl.replaceChildren(...rows);
  });

  root.querySelector(".back-btn").addEventListener("click", () => {
    stopTicking();
    setWakeLockWanted(false);
    nav.toHome();
  });

  function playCheckBurst() {
    checkAnimEl.classList.remove("hidden");
    checkAnimEl.classList.add("checked");
    itemTimerEl.classList.add("hidden");
    countdownRingEl.classList.add("hidden");
    const isPlayful = getTheme().mode === "playful";
    const confettiOptions = isPlayful ? { colors: PLAYFUL_SWATCHES.map((s) => s.accent), durationMs: 900, count: 46 } : { durationMs: 900, count: 46 };
    launchConfetti(confettiCanvas, confettiOptions);
    setTimeout(() => {
      checkAnimEl.classList.add("hidden");
      checkAnimEl.classList.remove("checked");
    }, 550);
  }

  function finish(reason) {
    stopTicking();
    setWakeLockWanted(false);
    audio.workoutComplete();

    const doneTpl = document.getElementById("tpl-todo-done");
    root.replaceChildren(doneTpl.content.cloneNode(true));
    root.querySelector("#todo-done-title").firstChild.textContent = reason === "done" ? "All done! " : "Time's up! ";

    const canvas = root.querySelector("#confetti-canvas");
    const isPlayful = getTheme().mode === "playful";
    const confettiOptions = isPlayful ? { colors: PLAYFUL_SWATCHES.map((s) => s.accent) } : {};
    requestAnimationFrame(() => launchConfetti(canvas, confettiOptions));

    const listEl = root.querySelector("#todo-done-list");
    const rows = [];
    for (const item of list.items) {
      rows.push(buildReadOnlyRow(item));
      for (const child of item.children || []) rows.push(buildReadOnlyRow(child, true));
    }
    listEl.replaceChildren(...rows);

    root.querySelector("#todo-done-btn-final").addEventListener("click", () => nav.toHome());
  }

  function buildReadOnlyRow(item, isChild = false) {
    const rowTpl = document.getElementById("tpl-todo-checklist-row");
    const node = rowTpl.content.cloneNode(true);
    const row = node.querySelector(".todo-checklist-row");
    if (isChild) row.classList.add("nested");
    row.classList.toggle("checked", item.checked);
    row.querySelector(".todo-checkbox").classList.toggle("checked", item.checked);
    row.querySelector(".todo-item-label").textContent = item.text;
    row.style.pointerEvents = "none";
    return node;
  }

  render();
}
