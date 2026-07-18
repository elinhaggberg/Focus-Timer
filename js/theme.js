import { getThemePref, setThemePref } from "./storage.js";

const THEME_BG = { dark: "#0b0d0f", light: "#f6f7f9" };

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// No stored preference yet means "follow the system", not "default to light" —
// unlike a fixed default this has to be resolved at call time since the OS
// setting can change while the app is open.
export function getTheme() {
  const pref = getThemePref();
  if (pref.mode === "dark" || pref.mode === "light") return pref;
  return { mode: systemPrefersDark() ? "dark" : "light" };
}

export function setTheme(pref) {
  setThemePref(pref);
  applyTheme();
}

export function applyTheme() {
  const pref = getTheme();
  document.documentElement.dataset.theme = pref.mode;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", THEME_BG[pref.mode] || THEME_BG.light);
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!getThemePref().mode) applyTheme();
  });
}
