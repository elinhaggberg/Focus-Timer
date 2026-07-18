import { getTodoList, saveTodoList, deleteTodoList, saveAsTemplate } from "../storage.js";
import { todoListMeta, todoListToText, isTodoListComplete } from "../util.js";
import { openSheet } from "../sheet.js";
import { shareText } from "../share.js";
import { unlockAudio } from "../audio.js";
import { maybeLogCompletion } from "../todoCompletion.js";

export function openTodoOverview(todoId, nav, { onDeleted } = {}) {
  const list = getTodoList(todoId);
  if (!list) return;

  const sheet = openSheet("tpl-todo-overview");
  sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  renderHeader();
  renderChecklist();

  function renderHeader() {
    sheet.el.querySelector(".preview-title").textContent = list.name || "Untitled list";
    sheet.el.querySelector(".preview-meta").textContent = todoListMeta(list);
  }

  function renderChecklist() {
    const listEl = sheet.el.querySelector("#todo-overview-list");
    if (list.items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No items yet.";
      listEl.replaceChildren(empty);
      return;
    }
    const rows = [];
    for (const item of list.items) {
      rows.push(createChecklistRow(item));
      for (const child of item.children || []) {
        rows.push(createChecklistRow(child, true));
      }
    }
    listEl.replaceChildren(...rows);
  }

  function createChecklistRow(item, isChild = false) {
    const tpl = document.getElementById("tpl-todo-checklist-row");
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector(".todo-checklist-row");
    if (isChild) row.classList.add("nested");
    row.classList.toggle("checked", item.checked);
    row.querySelector(".todo-checkbox").classList.toggle("checked", item.checked);
    row.querySelector(".todo-item-label").textContent = item.text;
    row.addEventListener("click", () => toggleItem(item.id));
    return node;
  }

  function findItem(id) {
    for (const item of list.items) {
      if (item.id === id) return item;
      const child = (item.children || []).find((c) => c.id === id);
      if (child) return child;
    }
    return null;
  }

  function toggleItem(id) {
    const wasComplete = isTodoListComplete(list);
    const item = findItem(id);
    if (!item) return;
    item.checked = !item.checked;
    saveTodoList(list);
    maybeLogCompletion(list, wasComplete);
    renderHeader();
    renderChecklist();
  }

  sheet.el.querySelector(".clear-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-title").textContent = "Clear all checks?";
    confirmSheet.el.querySelector(".confirm-message").textContent = "This unchecks every item but keeps the list. This can't be undone.";
    confirmSheet.el.querySelector(".confirm-btn").textContent = "Clear";
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      for (const item of list.items) {
        item.checked = false;
        (item.children || []).forEach((c) => (c.checked = false));
      }
      saveTodoList(list);
      confirmSheet.close();
      renderHeader();
      renderChecklist();
    });
  });

  sheet.el.querySelector(".randomize-btn").addEventListener("click", () => {
    unlockAudio();
    sheet.close();
    nav.toTodoPlayer(list.id, { timerMode: "none" });
  });

  sheet.el.querySelector(".timer-btn").addEventListener("click", () => {
    openTimerSetup();
  });

  sheet.el.querySelector(".share-btn").addEventListener("click", () => {
    shareText(list.name || "To-do list", todoListToText(list));
  });

  sheet.el.querySelector(".edit-preview-btn").addEventListener("click", () => {
    sheet.close();
    nav.toTodoEditor(list.id);
  });

  const saveTemplateBtn = sheet.el.querySelector(".save-template-btn");
  saveTemplateBtn.addEventListener("click", () => {
    saveAsTemplate(list);
    const original = saveTemplateBtn.innerHTML;
    saveTemplateBtn.textContent = "✓";
    setTimeout(() => (saveTemplateBtn.innerHTML = original), 1200);
  });

  sheet.el.querySelector(".delete-preview-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-title").textContent = "Delete list?";
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${list.name || "Untitled list"}"? This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteTodoList(list.id);
      confirmSheet.close();
      sheet.close();
      onDeleted?.();
    });
  });

  function openTimerSetup() {
    const setupSheet = openSheet("tpl-todo-randomize-setup");
    setupSheet.el.querySelector(".close-btn").addEventListener("click", () => setupSheet.close());

    let mode = "perItem";
    const modeButtons = setupSheet.el.querySelectorAll("#todo-timer-mode .segmented-option");
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    setupSheet.el.querySelector(".start-timer-btn").addEventListener("click", () => {
      const min = Number(setupSheet.el.querySelector("#todo-timer-min").value) || 0;
      const sec = Number(setupSheet.el.querySelector("#todo-timer-sec").value) || 0;
      const duration = Math.max(1, min * 60 + sec);
      unlockAudio();
      setupSheet.close();
      sheet.close();
      nav.toTodoPlayer(list.id, { timerMode: mode, duration });
    });
  }
}
