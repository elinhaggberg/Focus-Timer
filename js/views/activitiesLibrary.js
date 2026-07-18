import { getActivities, deleteActivity } from "../storage.js";
import { activityIconSvg } from "../activityIcons.js";
import { openSheet } from "../sheet.js";
import { openActivityForm } from "./activityForm.js";

export function openActivitiesLibrary() {
  const sheet = openSheet("tpl-activities-library");
  sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());
  sheet.el.querySelector(".new-activity-btn").addEventListener("click", () => {
    openActivityForm({ mode: "create", onSaved: renderList });
  });

  renderList();

  function renderList() {
    const listEl = sheet.el.querySelector("#activities-library-list");
    const activities = getActivities();

    if (activities.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No activities yet.";
      listEl.replaceChildren(empty);
      return;
    }

    const rowTpl = document.getElementById("tpl-activity-row");
    listEl.replaceChildren(
      ...activities.map((activity) => {
        const node = rowTpl.content.cloneNode(true);
        node.querySelector(".card-icon").innerHTML = activityIconSvg(activity.iconKey);
        node.querySelector(".card-title").textContent = activity.name;
        node.querySelector(".card-meta").textContent = activity.builtin ? "Built-in" : "Custom";
        node.querySelector(".edit-btn").addEventListener("click", () => {
          openActivityForm({ mode: "edit", activity, onSaved: renderList });
        });
        node.querySelector(".delete-btn").addEventListener("click", () => confirmDelete(activity));
        return node;
      })
    );
  }

  function confirmDelete(activity) {
    const confirmSheet = openSheet("tpl-confirm-delete");
    confirmSheet.el.querySelector(".confirm-title").textContent = "Delete activity?";
    confirmSheet.el.querySelector(".confirm-message").textContent = `Delete "${activity.name}"? Timers that use it will just show no icon. This can't be undone.`;
    confirmSheet.el.querySelector(".cancel-btn").addEventListener("click", () => confirmSheet.close());
    confirmSheet.el.querySelector(".confirm-btn").addEventListener("click", () => {
      deleteActivity(activity.id);
      confirmSheet.close();
      renderList();
    });
  }
}
