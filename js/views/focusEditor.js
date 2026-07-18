import {
  getFocusTimer,
  saveFocusTimer,
  deleteFocusTimer,
  createEmptyFocusTimer,
  makeIntervalInstance,
  makeSetContainer,
  uid,
  getActivities,
  getActivity,
} from "../storage.js";
import { intervalMeta, isSet, setMeta, formatClock, focusTimerMeta } from "../util.js";
import { openSheet } from "../sheet.js";
import { activityIconSvg } from "../activityIcons.js";
import { enableDragReorder, forceTeardownActiveDrag } from "../dragReorder.js";
import { unlockAudio } from "../audio.js";
import { openActivityForm } from "./activityForm.js";

export function renderFocusEditor(root, nav, timerId) {
  const timer = timerId ? structuredClone(getFocusTimer(timerId)) : createEmptyFocusTimer();
  if (!timer) {
    nav.toHome();
    return;
  }

  const tpl = document.getElementById("tpl-focus-editor");
  root.replaceChildren(tpl.content.cloneNode(true));

  const nameInput = root.querySelector(".timer-name-input");
  nameInput.value = timer.name;

  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());
  root.querySelector(".save-timer-btn").addEventListener("click", () => {
    timer.name = nameInput.value.trim() || "Untitled focus timer";
    saveFocusTimer(timer);
    nav.toHome();
  });

  const fab = root.querySelector("#add-interval-btn");
  fab.addEventListener("click", () => openAddChoice(timer.custom.intervals));

  const tabButtons = [...root.querySelectorAll(".tab-option")];
  const panels = {
    pomodoro: root.querySelector("#pomodoro-panel"),
    custom: root.querySelector("#custom-panel"),
  };
  function activateTab(tab) {
    timer.type = tab;
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle("hidden", key !== tab));
    fab.classList.toggle("hidden", tab !== "custom");
  }
  tabButtons.forEach((b) => b.addEventListener("click", () => activateTab(b.dataset.tab)));
  activateTab(timer.type);

  renderActivityField(root.querySelector("#pomodoro-activity-btn"));
  renderActivityField(root.querySelector("#custom-activity-btn"));
  renderPomodoroPanel();
  renderCustomList();

  function renderActivityField(btn) {
    const iconEl = btn.querySelector(".card-icon");
    const labelEl = btn.querySelector(".activity-field-label");
    const activity = timer.activityId ? getActivity(timer.activityId) : null;
    if (activity) {
      iconEl.innerHTML = activityIconSvg(activity.iconKey);
      labelEl.textContent = activity.name;
      labelEl.classList.remove("activity-field-placeholder");
    } else {
      iconEl.innerHTML = "";
      labelEl.textContent = "Add activity (optional)";
      labelEl.classList.add("activity-field-placeholder");
    }
    btn.onclick = () => openActivityPicker();
  }

  function refreshActivityFields() {
    renderActivityField(root.querySelector("#pomodoro-activity-btn"));
    renderActivityField(root.querySelector("#custom-activity-btn"));
  }

  // ---- Pomodoro ----

  function renderPomodoroPanel() {
    const setHost = root.querySelector("#pomodoro-set-card");
    const lbHost = root.querySelector("#pomodoro-longbreak-card");
    forceTeardownActiveDrag();

    const setCard = document.createElement("article");
    setCard.className = "card set-card";
    const header = document.createElement("div");
    header.className = "set-header";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = "Focus cycle";
    const stepper = buildRoundsStepper(
      timer.pomodoro.rounds,
      (v) => {
        timer.pomodoro.rounds = v;
        renderPomodoroPanel();
      }
    );
    header.append(title, stepper);
    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `Repeats ${timer.pomodoro.rounds} time${timer.pomodoro.rounds !== 1 ? "s" : ""}`;
    const blocksHost = document.createElement("div");
    blocksHost.className = "set-intervals";
    setCard.append(header, meta, blocksHost);
    setHost.replaceChildren(setCard);

    const blockCards = timer.pomodoro.blocks.map((block) =>
      createPomodoroBlockCard(block, blocksHost, (order) => {
        timer.pomodoro.blocks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      })
    );
    blocksHost.replaceChildren(...blockCards);

    const lbCard = createPomodoroBlockCard(timer.pomodoro.longBreak, null, null, {
      toggle: {
        checked: timer.pomodoro.longBreak.enabled,
        onChange: (checked) => {
          timer.pomodoro.longBreak.enabled = checked;
          renderPomodoroPanel();
        },
      },
    });
    lbHost.replaceChildren(lbCard);
  }

  function createPomodoroBlockCard(block, listEl, onReorder, opts = {}) {
    const frag = document.getElementById("tpl-pomodoro-interval-card").content.cloneNode(true);
    const card = frag.querySelector(".interval-card");
    const handle = frag.querySelector(".drag-handle");
    card.dataset.id = block.id;
    frag.querySelector(".card-title").textContent = block.name;
    frag.querySelector(".card-meta").textContent = block.enabled === false ? "Skipped" : intervalMeta(block);

    if (opts.toggle) {
      const label = document.createElement("label");
      label.className = "field-checkbox";
      label.style.marginTop = "6px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = opts.toggle.checked;
      const span = document.createElement("span");
      span.textContent = "Include long break";
      label.append(checkbox, span);
      checkbox.addEventListener("change", () => opts.toggle.onChange(checkbox.checked));
      card.querySelector(".card-main").appendChild(label);
      handle.remove();
    }

    frag.querySelector(".edit-btn").addEventListener("click", () => {
      if (opts.toggle && !opts.toggle.checked) return;
      openDurationForm(block, () => {
        renderPomodoroPanel();
      });
    });

    if (listEl && onReorder) enableDragReorder(card, handle, listEl, onReorder);
    return card;
  }

  function buildRoundsStepper(value, onChange) {
    const stepper = document.createElement("div");
    stepper.className = "rounds-stepper";
    stepper.style.marginLeft = "auto";
    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "icon-btn rounds-dec";
    dec.setAttribute("aria-label", "Fewer rounds");
    dec.innerHTML = '<svg class="icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32z"/></svg>';
    const valueEl = document.createElement("span");
    valueEl.className = "rounds-value";
    valueEl.textContent = value;
    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "icon-btn rounds-inc";
    inc.setAttribute("aria-label", "More rounds");
    inc.innerHTML = '<svg class="icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z"/></svg>';
    dec.addEventListener("click", () => onChange(Math.max(1, value - 1)));
    inc.addEventListener("click", () => onChange(Math.min(20, value + 1)));
    stepper.append(dec, valueEl, inc);
    return stepper;
  }

  function openDurationForm(block, onSaved) {
    const sheet = openSheet("tpl-duration-form");
    const form = sheet.el.querySelector("#duration-form");
    sheet.el.querySelector(".form-title").textContent = `Edit ${block.name}`;
    form["amount-min"].value = Math.floor(block.amount / 60);
    form["amount-sec"].value = block.amount % 60;
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = (Number(form["amount-min"].value) || 0) * 60 + (Number(form["amount-sec"].value) || 0);
      if (amount <= 0) return;
      block.amount = amount;
      sheet.close();
      onSaved();
    });
    form["amount-min"].focus();
  }

  // ---- Custom ----

  function resortArray(arr, newOrderIds) {
    arr.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
  }

  function renderCustomList(scrollToId) {
    forceTeardownActiveDrag();
    const listEl = root.querySelector("#custom-interval-list");
    if (timer.custom.intervals.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Tap + to add your first interval or set.";
      listEl.replaceChildren(empty);
      return;
    }
    const cards = timer.custom.intervals.map((node) =>
      isSet(node)
        ? createSetCardEl(node, listEl, (order) => resortArray(timer.custom.intervals, order))
        : createIntervalCardEl(
            node,
            {
              onEdit: () => openIntervalForm({ mode: "edit", interval: node }),
              onDuplicate: () => {
                const idx = timer.custom.intervals.indexOf(node);
                timer.custom.intervals.splice(idx + 1, 0, { ...node, id: uid() });
                renderCustomList();
              },
              onRemove: () => {
                timer.custom.intervals = timer.custom.intervals.filter((n) => n.id !== node.id);
                renderCustomList();
              },
            },
            listEl,
            (order) => resortArray(timer.custom.intervals, order)
          )
    );
    listEl.replaceChildren(...cards);
    listEl.querySelectorAll(".set-name-input").forEach((el) => autoResizeTextarea(el));

    if (scrollToId) {
      const target = listEl.querySelector(`[data-id="${scrollToId}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }

  function autoResizeTextarea(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function createIntervalCardEl(interval, { onEdit, onDuplicate, onRemove }, listEl, onReorder) {
    const frag = document.getElementById("tpl-interval-card").content.cloneNode(true);
    const card = frag.querySelector(".interval-card");
    const handle = frag.querySelector(".drag-handle");
    card.dataset.id = interval.id;
    frag.querySelector(".card-title").textContent = interval.name;
    frag.querySelector(".card-meta").textContent = intervalMeta(interval);
    frag.querySelector(".duplicate-btn").addEventListener("click", onDuplicate);
    frag.querySelector(".edit-btn").addEventListener("click", onEdit);
    frag.querySelector(".remove-btn").addEventListener("click", onRemove);
    enableDragReorder(card, handle, listEl, onReorder);
    return card;
  }

  function createSetCardEl(setNode, listEl, onReorder) {
    const frag = document.getElementById("tpl-set-card").content.cloneNode(true);
    const card = frag.querySelector(".set-card");
    const handle = frag.querySelector(".drag-handle");
    card.dataset.id = setNode.id;
    frag.querySelector(".card-meta").textContent = setMeta(setNode);
    frag.querySelector(".rounds-value").textContent = setNode.rounds;

    const nameInput = frag.querySelector(".set-name-input");
    nameInput.value = setNode.name || "";
    nameInput.addEventListener("input", () => {
      setNode.name = nameInput.value;
      autoResizeTextarea(nameInput);
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameInput.blur();
      }
    });

    frag.querySelector(".rounds-dec").addEventListener("click", () => {
      setNode.rounds = Math.max(1, setNode.rounds - 1);
      renderCustomList();
    });
    frag.querySelector(".rounds-inc").addEventListener("click", () => {
      setNode.rounds = Math.min(50, setNode.rounds + 1);
      renderCustomList();
    });
    frag.querySelector(".duplicate-btn").addEventListener("click", () => {
      const idx = timer.custom.intervals.indexOf(setNode);
      const copy = { ...setNode, id: uid(), intervals: setNode.intervals.map((i) => ({ ...i, id: uid() })) };
      timer.custom.intervals.splice(idx + 1, 0, copy);
      renderCustomList();
    });
    frag.querySelector(".remove-btn").addEventListener("click", () => {
      timer.custom.intervals = timer.custom.intervals.filter((n) => n.id !== setNode.id);
      renderCustomList();
    });

    const nestedListEl = frag.querySelector(".set-intervals");
    if (setNode.intervals.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No intervals in this set yet.";
      nestedListEl.appendChild(empty);
    } else {
      const nestedCards = setNode.intervals.map((interval) =>
        createIntervalCardEl(
          interval,
          {
            onEdit: () => openIntervalForm({ mode: "edit", interval }),
            onDuplicate: () => {
              const idx = setNode.intervals.indexOf(interval);
              setNode.intervals.splice(idx + 1, 0, { ...interval, id: uid() });
              renderCustomList();
            },
            onRemove: () => {
              setNode.intervals = setNode.intervals.filter((i) => i.id !== interval.id);
              renderCustomList();
            },
          },
          nestedListEl,
          (order) => resortArray(setNode.intervals, order)
        )
      );
      nestedListEl.replaceChildren(...nestedCards);
    }

    frag.querySelector(".add-to-set-btn").addEventListener("click", () => openIntervalForm({ mode: "create", targetArray: setNode.intervals }));
    enableDragReorder(card, handle, listEl, onReorder);

    return card;
  }

  function openAddChoice(targetArray) {
    const sheet = openSheet("tpl-add-choice");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector("#choice-interval").addEventListener("click", () => {
      sheet.close();
      openIntervalForm({ mode: "create", targetArray });
    });
    sheet.el.querySelector("#choice-set").addEventListener("click", () => {
      sheet.close();
      const newSet = makeSetContainer();
      targetArray.push(newSet);
      renderCustomList(newSet.id);
    });
  }

  function openIntervalForm({ mode, interval = null, targetArray = null }) {
    const sheet = openSheet("tpl-interval-form");
    const form = sheet.el.querySelector("#interval-form");
    const titleEl = sheet.el.querySelector(".form-title");

    titleEl.textContent = mode === "edit" ? "Edit interval" : "New interval";
    form.name.value = interval ? interval.name : "";
    if (interval) {
      form["amount-min"].value = Math.floor(interval.amount / 60);
      form["amount-sec"].value = interval.amount % 60;
    }

    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const amount = (Number(form["amount-min"].value) || 0) * 60 + (Number(form["amount-sec"].value) || 0);
      if (!name || amount <= 0) return;

      if (mode === "edit") {
        interval.name = name;
        interval.amount = amount;
        renderCustomList();
      } else {
        const instance = makeIntervalInstance({ name, amount });
        targetArray.push(instance);
        renderCustomList(instance.id);
      }
      sheet.close();
    });

    form.name.focus();
  }

  // ---- Activity picker ----

  function openActivityPicker() {
    const sheet = openSheet("tpl-activity-picker");
    sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
    renderGrid();

    function renderGrid() {
      const gridEl = sheet.el.querySelector("#activity-grid");
      const activities = getActivities();
      const tileTpl = document.getElementById("tpl-activity-tile");

      const noneTile = tileTpl.content.cloneNode(true);
      const noneBtn = noneTile.querySelector(".activity-tile");
      noneBtn.classList.toggle("active", !timer.activityId);
      noneBtn.querySelector(".activity-tile-label").textContent = "None";
      noneBtn.addEventListener("click", () => {
        timer.activityId = null;
        refreshActivityFields();
        sheet.close();
      });

      const tiles = activities.map((activity) => {
        const node = tileTpl.content.cloneNode(true);
        const btn = node.querySelector(".activity-tile");
        btn.classList.toggle("active", timer.activityId === activity.id);
        btn.querySelector(".card-icon").innerHTML = activityIconSvg(activity.iconKey);
        btn.querySelector(".activity-tile-label").textContent = activity.name;
        btn.addEventListener("click", () => {
          timer.activityId = activity.id;
          refreshActivityFields();
          sheet.close();
        });
        return node;
      });

      const addTile = tileTpl.content.cloneNode(true);
      const addBtn = addTile.querySelector(".activity-tile");
      addBtn.classList.add("activity-tile-new");
      addBtn.querySelector(".card-icon").innerHTML =
        '<svg class="icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false"><path d="M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z"/></svg>';
      addBtn.querySelector(".activity-tile-label").textContent = "Add +";
      addBtn.addEventListener("click", () => {
        sheet.close();
        openActivityForm({
          mode: "create",
          onSaved: (newActivity) => {
            timer.activityId = newActivity.id;
            refreshActivityFields();
          },
        });
      });

      gridEl.replaceChildren(noneTile, ...tiles, addTile);
    }
  }
}

// ---- Preview (also used from the Home Screen) ----

export function openFocusPreview(timerId, nav, { onDeleted } = {}) {
  const timer = getFocusTimer(timerId);
  if (!timer) return;

  const sheet = openSheet("tpl-focus-preview");
  sheet.el.querySelector(".preview-title").textContent = timer.name || "Untitled focus timer";
  const typeLabel = timer.type === "pomodoro" ? "Pomodoro" : "Custom";
  sheet.el.querySelector(".preview-meta").textContent = `${typeLabel} · ${focusTimerMeta(timer)}`;

  const listEl = sheet.el.querySelector("#preview-list");
  listEl.replaceChildren(...buildPreviewNodes(timer));

  sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  sheet.el.querySelector(".edit-preview-btn").addEventListener("click", () => {
    sheet.close();
    nav.toFocusEditor(timer.id);
  });
  sheet.el.querySelector(".delete-preview-btn").addEventListener("click", () => {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${timer.name || "Untitled focus timer"}"? This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteFocusTimer(timer.id);
      confirmSheet.close();
      sheet.close();
      onDeleted?.();
    });
  });
  const play = () => {
    unlockAudio();
    sheet.close();
    nav.toFocusPlayer(timer.id);
  };
  sheet.el.querySelector(".play-preview-header-btn").addEventListener("click", play);
  sheet.el.querySelector(".play-preview-btn").addEventListener("click", play);
}

function buildPreviewNodes(timer) {
  if (timer.type === "pomodoro") {
    const nodes = [];
    const setCard = document.createElement("div");
    setCard.className = "card set-card preview-card";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = "Focus cycle";
    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `× ${timer.pomodoro.rounds} rounds`;
    const nested = document.createElement("div");
    nested.className = "set-intervals";
    nested.append(...timer.pomodoro.blocks.map(renderPreviewInterval));
    setCard.append(title, meta, nested);
    nodes.push(setCard);
    if (timer.pomodoro.longBreak.enabled) nodes.push(renderPreviewInterval(timer.pomodoro.longBreak));
    return nodes;
  }
  if (timer.custom.intervals.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No intervals yet.";
    return [empty];
  }
  return timer.custom.intervals.map(renderPreviewNode);
}

function renderPreviewNode(node) {
  if (isSet(node)) {
    const card = document.createElement("div");
    card.className = "card set-card preview-card";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = node.name || "Set";
    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `× ${node.rounds} rounds · ${setMeta(node)}`;
    card.append(title, meta);
    const nested = document.createElement("div");
    nested.className = "set-intervals";
    nested.append(...node.intervals.map(renderPreviewInterval));
    card.appendChild(nested);
    return card;
  }
  return renderPreviewInterval(node);
}

function renderPreviewInterval(interval) {
  const card = document.createElement("div");
  card.className = "card interval-card preview-card";
  const main = document.createElement("div");
  main.className = "card-main";
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = interval.name;
  const meta = document.createElement("p");
  meta.className = "card-meta";
  meta.textContent = formatClock(interval.amount);
  main.append(title, meta);
  card.appendChild(main);
  return card;
}
