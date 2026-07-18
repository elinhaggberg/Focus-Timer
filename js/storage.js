const ACTIVITIES_KEY = "ft_activities_v1";
const FOCUS_TIMERS_KEY = "ft_focus_timers_v1";
const SOUND_KEY = "ft_sound_enabled_v1";
const THEME_KEY = "ft_theme_v1";

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Activities (icon-labeled tags shown on focus timers and the player) ----

const BUILTIN_ACTIVITIES = [
  { name: "Read", iconKey: "bookOpen" },
  { name: "Study", iconKey: "graduationCap" },
  { name: "Write", iconKey: "penNib" },
  { name: "Chores", iconKey: "broom" },
  { name: "Clean", iconKey: "sprayCanSparkles" },
];

function seedActivitiesIfEmpty() {
  if (localStorage.getItem(ACTIVITIES_KEY) != null) return;
  const seeded = BUILTIN_ACTIVITIES.map((a) => ({ id: uid(), builtin: true, createdAt: Date.now(), ...a }));
  writeJSON(ACTIVITIES_KEY, seeded);
}

export function getActivities() {
  seedActivitiesIfEmpty();
  return readJSON(ACTIVITIES_KEY, []);
}

export function getActivity(id) {
  return getActivities().find((a) => a.id === id) || null;
}

export function addActivity({ name, iconKey }) {
  const activities = getActivities();
  const entry = { id: uid(), name: name.trim(), iconKey, builtin: false, createdAt: Date.now() };
  activities.push(entry);
  writeJSON(ACTIVITIES_KEY, activities);
  return entry;
}

export function updateActivity(id, patch) {
  const activities = getActivities();
  const idx = activities.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  activities[idx] = { ...activities[idx], ...patch };
  writeJSON(ACTIVITIES_KEY, activities);
  return activities[idx];
}

export function deleteActivity(id) {
  writeJSON(ACTIVITIES_KEY, getActivities().filter((a) => a.id !== id));
}

// ---- Focus timers (saved Pomodoro or Custom templates) ----

export function getFocusTimers() {
  return readJSON(FOCUS_TIMERS_KEY, []);
}

export function getFocusTimer(id) {
  return getFocusTimers().find((t) => t.id === id) || null;
}

export function saveFocusTimer(timer) {
  const timers = getFocusTimers();
  const idx = timers.findIndex((t) => t.id === timer.id);
  if (idx >= 0) timers[idx] = timer;
  else timers.push(timer);
  writeJSON(FOCUS_TIMERS_KEY, timers);
  return timer;
}

export function deleteFocusTimer(id) {
  writeJSON(FOCUS_TIMERS_KEY, getFocusTimers().filter((t) => t.id !== id));
}

// Both the pomodoro and custom sub-objects always exist (regardless of which
// tab is active) so switching tabs in the editor never loses what was
// already entered on the other one. `type` just tracks which tab's data gets
// used when the timer is saved and played.
export function createEmptyFocusTimer() {
  return {
    id: uid(),
    name: "",
    createdAt: Date.now(),
    type: "pomodoro",
    activityId: null,
    lastCompletedSeconds: null,
    pomodoro: {
      rounds: 4,
      blocks: [
        { id: uid(), name: "Focus", kind: "focus", amount: 1500 },
        { id: uid(), name: "Short Break", kind: "break", amount: 300 },
      ],
      longBreak: { id: uid(), name: "Long Break", kind: "longBreak", amount: 900, enabled: true },
    },
    custom: { intervals: [] },
  };
}

export function makeIntervalInstance({ name, amount }) {
  return { id: uid(), name: name.trim(), amount };
}

export function makeSetContainer({ rounds = 2 } = {}) {
  return { id: uid(), kind: "set", rounds, name: "", intervals: [] };
}

// ---- Preferences ----

export function getSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) === "true";
}

export function setSoundEnabled(value) {
  localStorage.setItem(SOUND_KEY, value ? "true" : "false");
}

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
}

export { uid };
