import { renderHome } from "./views/home.js";
import { renderFocusEditor } from "./views/focusEditor.js";
import { renderFocusPlayer } from "./views/focusPlayer.js";
import { renderFinish } from "./views/finish.js";
import { applyTheme } from "./theme.js";

applyTheme();

const root = document.getElementById("app");
let pendingFinishSummary = null;

const nav = {
  toHome: () => {
    location.hash = "#/home";
  },
  toFocusEditor: (id) => {
    location.hash = id ? `#/focus/edit/${id}` : "#/focus/edit/new";
  },
  toFocusPlayer: (id) => {
    location.hash = `#/focus/play/${id}`;
  },
  toFinish: (summary) => {
    pendingFinishSummary = summary;
    location.hash = "#/finish";
  },
};

function route() {
  const hash = location.hash || "#/home";
  const match = hash.match(/^#\/(.+)$/);
  const path = match ? match[1] : "home";
  const parts = path.split("/");

  if (parts[0] === "focus" && parts[1] === "edit") {
    renderFocusEditor(root, nav, parts[2] === "new" ? null : parts[2]);
    return;
  }
  if (parts[0] === "focus" && parts[1] === "play") {
    renderFocusPlayer(root, nav, parts[2]);
    return;
  }
  if (parts[0] === "finish") {
    if (!pendingFinishSummary) {
      nav.toHome();
      return;
    }
    renderFinish(root, nav, pendingFinishSummary);
    return;
  }
  renderHome(root, nav);
}

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
