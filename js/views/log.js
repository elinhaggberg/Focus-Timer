import { getLogEntries, deleteLogEntry, clearLog } from "../storage.js";
import { formatClock, formatDate } from "../util.js";
import { openSheet } from "../sheet.js";

const KIND_ICON = {
  focus: '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><circle cx="256" cy="256" r="216" fill="none" stroke="currentColor" stroke-width="40"/><rect x="236" y="120" width="40" height="170" rx="20"/><rect x="256" y="226" width="140" height="40" rx="20"/></svg>',
  todo: '<svg class="icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><rect x="32" y="48" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="60" width="352" height="32" rx="16"/><rect x="32" y="228" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="240" width="352" height="32" rx="16"/><rect x="32" y="408" width="56" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="32"/><rect x="128" y="420" width="352" height="32" rx="16"/></svg>',
};

function metaFor(entry) {
  const date = `${formatDate(entry.completedAt)}`;
  if (entry.kind === "focus") return `${date} · ${formatClock(entry.totalSeconds)}`;
  return `${date} · ${entry.itemsCompleted}/${entry.totalItems} items`;
}

export function renderLog(root, nav) {
  const tpl = document.getElementById("tpl-log");
  root.replaceChildren(tpl.content.cloneNode(true));

  root.querySelector(".back-btn").addEventListener("click", () => nav.toHome());
  root.querySelector("#clear-log-btn").addEventListener("click", () => {
    const sheet = openSheet("tpl-confirm-delete");
    sheet.el.querySelector(".confirm-title").textContent = "Delete log?";
    sheet.el.querySelector(".confirm-message").textContent = "This clears every recorded session and to-do completion. This can't be undone.";
    sheet.el.querySelector(".cancel-btn").addEventListener("click", () => sheet.close());
    sheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      clearLog();
      sheet.close();
      renderList();
    });
  });

  renderList();

  function renderList() {
    const listEl = root.querySelector("#log-list");
    const entries = getLogEntries().sort((a, b) => b.completedAt - a.completedAt);

    if (entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nothing logged yet. Complete a focus session to see it here.";
      listEl.replaceChildren(empty);
      return;
    }

    const rowTpl = document.getElementById("tpl-log-row");
    listEl.replaceChildren(
      ...entries.map((entry) => {
        const node = rowTpl.content.cloneNode(true);
        node.querySelector(".card-icon").innerHTML = KIND_ICON[entry.kind] || KIND_ICON.focus;
        node.querySelector(".card-title").textContent = entry.name || "Untitled";
        node.querySelector(".card-meta").textContent = metaFor(entry);
        node.querySelector(".delete-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          deleteLogEntry(entry.id);
          renderList();
        });
        return node;
      })
    );
  }
}
