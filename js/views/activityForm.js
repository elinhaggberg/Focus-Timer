import { addActivity, updateActivity } from "../storage.js";
import { openSheet } from "../sheet.js";
import { activityIconSvg, ACTIVITY_ICONS } from "../activityIcons.js";

// Shared create/edit form for activities — used by the focus timer editor's
// "Add +" tile and by the Activities Library's add/edit actions.
export function openActivityForm({ mode, activity = null, onSaved }) {
  const sheet = openSheet("tpl-new-activity-form");
  const nameInput = sheet.el.querySelector("#new-activity-name");
  const searchInput = sheet.el.querySelector("#icon-picker-search");
  const gridEl = sheet.el.querySelector("#icon-picker-grid");
  const saveBtn = sheet.el.querySelector("#save-new-activity-btn");
  let selectedIcon = activity ? activity.iconKey : null;

  sheet.el.querySelector("h2").textContent = mode === "edit" ? "Edit activity" : "New activity";
  saveBtn.textContent = mode === "edit" ? "Save changes" : "Save activity";
  if (activity) nameInput.value = activity.name;

  sheet.el.querySelector(".close-btn").addEventListener("click", () => sheet.close());

  function renderIconGrid(filterText) {
    const query = filterText.trim().toLowerCase();
    const matches = query ? ACTIVITY_ICONS.filter((i) => i.label.toLowerCase().includes(query)) : ACTIVITY_ICONS;
    const nodes = matches.map((icon) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-picker-item";
      btn.classList.toggle("active", selectedIcon === icon.key);
      btn.setAttribute("aria-label", icon.label);
      btn.title = icon.label;
      btn.innerHTML = activityIconSvg(icon.key);
      btn.addEventListener("click", () => {
        selectedIcon = icon.key;
        renderIconGrid(searchInput.value);
      });
      return btn;
    });
    gridEl.replaceChildren(...nodes);
  }

  renderIconGrid("");
  searchInput.addEventListener("input", () => renderIconGrid(searchInput.value));

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name || !selectedIcon) return;
    const saved = mode === "edit" ? updateActivity(activity.id, { name, iconKey: selectedIcon }) : addActivity({ name, iconKey: selectedIcon });
    sheet.close();
    onSaved(saved);
  });

  nameInput.focus();
}
