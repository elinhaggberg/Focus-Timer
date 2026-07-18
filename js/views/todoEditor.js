import { getTodoList, saveTodoList, createEmptyTodoList, makeTodoItem, getTodoTemplates, deleteTodoTemplate, instantiateFromTemplate } from "../storage.js";
import { openSheet } from "../sheet.js";
import { enableDragReorder, forceTeardownActiveDrag } from "../dragReorder.js";
import { initTabs } from "../tabs.js";
import { openTodoOverview } from "./todoOverview.js";

function stripEmptyItems(items) {
  return items
    .map((item) => ({ ...item, text: item.text.trim(), children: stripEmptyItems(item.children || []) }))
    .filter((item) => item.text.length > 0 || item.children.length > 0);
}

export function renderTodoHub(root, nav, todoId) {
  const isEdit = !!todoId;
  const list = isEdit ? structuredClone(getTodoList(todoId)) : createEmptyTodoList();
  if (!list) {
    nav.toHome();
    return;
  }
  if (list.items.length === 0) list.items.push(makeTodoItem());

  const tpl = document.getElementById("tpl-todo-hub");
  root.replaceChildren(tpl.content.cloneNode(true));

  root.querySelector("#todo-hub-title").textContent = isEdit ? "Edit list" : "New list";
  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());

  const titleInput = root.querySelector("#todo-title-input");
  titleInput.value = list.name;
  titleInput.addEventListener("input", () => {
    list.name = titleInput.value;
  });

  const tabsEl = root.querySelector("#todo-hub-tabs");
  const newPanel = root.querySelector("#todo-new-panel");
  const templatesPanel = root.querySelector("#todo-templates-panel");
  if (isEdit) {
    tabsEl.remove();
    templatesPanel.remove();
  } else {
    initTabs(root, { new: newPanel, templates: templatesPanel });
    renderTemplates();
  }

  root.querySelector(".save-list-btn").addEventListener("click", () => {
    list.name = titleInput.value.trim() || "Untitled list";
    list.items = stripEmptyItems(list.items);
    saveTodoList(list);
    nav.toHome();
    setTimeout(() => openTodoOverview(list.id, nav, {}), 0);
  });

  const listEl = root.querySelector("#todo-item-list");

  function ensureAtLeastOneItem() {
    if (list.items.length === 0) list.items.push(makeTodoItem());
  }

  function renderItems(focusId) {
    forceTeardownActiveDrag();
    ensureAtLeastOneItem();
    const groups = list.items.map((item) => createTopLevelGroup(item));
    listEl.replaceChildren(...groups);
    if (focusId) {
      const input = listEl.querySelector(`[data-id="${focusId}"] .todo-item-text`);
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }

  function clearNestHints() {
    listEl.querySelectorAll(".nest-hint").forEach((el) => el.classList.remove("nest-hint"));
  }

  function createTopLevelGroup(item) {
    const group = document.createElement("div");
    group.className = "todo-item-group";
    group.dataset.id = item.id;

    const row = createItemRow(item, list.items, { onEnter: (idx) => insertAfter(list.items, idx, item.id), onRemove: () => removeItem(list.items, item.id) });
    group.appendChild(row);

    if (item.children.length > 0) {
      const childrenEl = document.createElement("div");
      childrenEl.className = "todo-children";
      item.children.forEach((child) => {
        const childRow = createItemRow(child, item.children, {
          onEnter: (idx) => insertAfter(item.children, idx, child.id),
          onRemove: () => removeItem(item.children, child.id),
          isChild: true,
        });
        childRow.querySelector(".unnest-btn").classList.remove("hidden");
        childRow.querySelector(".unnest-btn").addEventListener("click", () => unnestItem(item, child.id));
        enableDragReorder(childRow, childRow.querySelector(".drag-handle"), childrenEl, (order) => {
          item.children.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        });
        childrenEl.appendChild(childRow);
      });
      group.appendChild(childrenEl);
    }

    enableDragReorder(group, row.querySelector(".drag-handle"), listEl, (order) => {
      list.items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }, {
      onHoverNest: (siblingSnapshot, pointerY, draggedCard) => {
        const draggedItem = list.items.find((i) => i.id === draggedCard.dataset.id);
        if (!draggedItem || draggedItem.children.length > 0) {
          clearNestHints();
          return null;
        }
        for (const { el, rect } of siblingSnapshot) {
          const lowerZoneStart = rect.top + rect.height * 0.6;
          if (pointerY >= lowerZoneStart && pointerY <= rect.bottom + 12) {
            clearNestHints();
            el.classList.add("nest-hint");
            return el.dataset.id;
          }
        }
        clearNestHints();
        return null;
      },
      onClearNestHint: clearNestHints,
      onDropNest: (targetId, draggedCard) => {
        const draggedId = draggedCard.dataset.id;
        const draggedIdx = list.items.findIndex((i) => i.id === draggedId);
        if (draggedIdx < 0) return;
        const [draggedItem] = list.items.splice(draggedIdx, 1);
        const target = list.items.find((i) => i.id === targetId);
        if (!target) {
          list.items.splice(draggedIdx, 0, draggedItem);
          renderItems();
          return;
        }
        target.children.push({ id: draggedItem.id, text: draggedItem.text, checked: draggedItem.checked, children: [] });
        renderItems();
      },
    });

    return group;
  }

  function createItemRow(item, ownerArray, { onEnter, onRemove, isChild = false } = {}) {
    const frag = document.getElementById("tpl-todo-item").content.cloneNode(true);
    const row = frag.querySelector(".todo-item");
    row.dataset.id = item.id;
    if (isChild) row.classList.add("nested");

    const checkbox = row.querySelector(".todo-checkbox");
    checkbox.classList.toggle("checked", item.checked);
    checkbox.addEventListener("click", () => {
      item.checked = !item.checked;
      checkbox.classList.toggle("checked", item.checked);
    });

    const input = row.querySelector(".todo-item-text");
    input.value = item.text;
    input.addEventListener("input", () => {
      item.text = input.value;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const idx = ownerArray.findIndex((i) => i.id === item.id);
        onEnter(idx);
      } else if (e.key === "Backspace" && input.selectionStart === 0 && input.selectionEnd === 0 && ownerArray.length > 1) {
        e.preventDefault();
        const idx = ownerArray.findIndex((i) => i.id === item.id);
        const prevId = idx > 0 ? ownerArray[idx - 1].id : null;
        onRemove();
        renderItems(prevId);
      }
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      if (ownerArray.length <= 1 && !isChild) return; // keep at least one top-level row
      onRemove();
      renderItems();
    });

    return row;
  }

  function insertAfter(array, idx, afterId) {
    const realIdx = array.findIndex((i) => i.id === afterId);
    const fresh = makeTodoItem();
    array.splice(realIdx + 1, 0, fresh);
    renderItems(fresh.id);
  }

  function removeItem(array, id) {
    const idx = array.findIndex((i) => i.id === id);
    if (idx >= 0) array.splice(idx, 1);
  }

  function unnestItem(parent, childId) {
    const idx = parent.children.findIndex((c) => c.id === childId);
    if (idx < 0) return;
    const [child] = parent.children.splice(idx, 1);
    const parentIdx = list.items.findIndex((i) => i.id === parent.id);
    list.items.splice(parentIdx + 1, 0, { id: child.id, text: child.text, checked: child.checked, children: [] });
    renderItems();
  }

  renderItems();

  function renderTemplates() {
    const templatesListEl = root.querySelector("#todo-templates-list");
    const templates = getTodoTemplates();
    if (templates.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No saved templates yet. Save a list as a template from its overview.";
      templatesListEl.replaceChildren(empty);
      return;
    }
    const cardTpl = document.getElementById("tpl-todo-template-card");
    templatesListEl.replaceChildren(
      ...templates.map((template) => {
        const node = cardTpl.content.cloneNode(true);
        node.querySelector(".card-title").textContent = template.name || "Untitled template";
        const n = template.items.length;
        node.querySelector(".card-meta").textContent = `${n} item${n !== 1 ? "s" : ""}`;
        node.querySelector(".use-btn").addEventListener("click", () => {
          const newList = instantiateFromTemplate(template);
          nav.toHome();
          setTimeout(() => openTodoOverview(newList.id, nav, {}), 0);
        });
        node.querySelector(".delete-btn").addEventListener("click", () => {
          const confirmSheet = openSheet("tpl-confirm-delete");
          confirmSheet.el.querySelector(".confirm-title").textContent = "Delete template?";
          confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${template.name || "Untitled template"}"? This can't be undone.`;
          confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
          confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
            deleteTodoTemplate(template.id);
            confirmSheet.close();
            renderTemplates();
          });
        });
        return node;
      })
    );
  }
}
