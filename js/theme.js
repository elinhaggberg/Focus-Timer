import { getThemePref, setThemePref } from "./storage.js";

export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "playful", label: "Playful" },
];

// The Playful theme's accent is user-selectable rather than fixed. Dark and
// Light each have one fixed accent, defined in CSS instead.
export const PLAYFUL_SWATCHES = [
  { id: "lipstick", label: "Lipstick", accent: "#ee4c9b", accentText: "#ffffff" },
  { id: "grapefruit", label: "Grapefruit", accent: "#f2542d", accentText: "#ffffff" },
  { id: "sunshine", label: "Sunshine", accent: "#f5b942", accentText: "#241c1c" },
  { id: "lilac", label: "Lilac", accent: "#b9a6ff", accentText: "#241c1c" },
  { id: "midnight", label: "Midnight", accent: "#3b2352", accentText: "#ffffff" },
];

const THEME_BG = { dark: "#0b0d0f", light: "#f6f7f9", playful: "#f5eedc" };

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// No stored preference yet means "follow the system", not "default to
// light" — unlike a fixed default this has to be resolved at call time since
// the OS setting can change while the app is open. Once the user has picked
// a theme explicitly (including Playful) that choice always wins.
export function getTheme() {
  const pref = getThemePref();
  const mode = pref.mode === "dark" || pref.mode === "light" || pref.mode === "playful"
    ? pref.mode
    : systemPrefersDark() ? "dark" : "light";
  return { mode, playfulAccent: pref.playfulAccent || "lipstick" };
}

export function setTheme(pref) {
  setThemePref(pref);
  applyTheme();
}

export function applyTheme() {
  const pref = getTheme();
  const root = document.documentElement;
  root.dataset.theme = pref.mode;

  if (pref.mode === "playful") {
    const swatch = PLAYFUL_SWATCHES.find((s) => s.id === pref.playfulAccent) || PLAYFUL_SWATCHES[0];
    root.style.setProperty("--accent", swatch.accent);
    root.style.setProperty("--accent-text", swatch.accentText);
  } else {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-text");
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", THEME_BG[pref.mode] || THEME_BG.light);
}

if (window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!getThemePref().mode) applyTheme();
  });
}
