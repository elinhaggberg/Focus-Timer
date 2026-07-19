const ACTIVITIES_KEY = "ft_activities_v1";
const FOCUS_TIMERS_KEY = "ft_focus_timers_v1";
const SOUND_KEY = "ft_sound_enabled_v1";
const ALARM_SOUND_KEY = "ft_alarm_sound_v1";
const THEME_KEY = "ft_theme_v1";
const HOME_TITLE_KEY = "ft_home_title_v1";
const LOG_KEY = "ft_log_v1";
const GOALS_KEY = "ft_goals_v1";
const TODO_LISTS_KEY = "ft_todo_lists_v1";
const TODO_TEMPLATES_KEY = "ft_todo_templates_v1";
const LAST_SEEN_VERSION_KEY = "ft_last_seen_version_v1";

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

// Ensures an activity entry exists for this name; creates one if not found —
// used when merging an imported backup so re-importing the same file doesn't
// pile up duplicate activities.
export function upsertActivityByName({ name, iconKey }) {
  const activities = getActivities();
  const norm = name.trim().toLowerCase();
  const existing = activities.find((a) => a.name.trim().toLowerCase() === norm);
  if (existing) return existing;
  return addActivity({ name, iconKey });
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

// ---- To-do lists ----

export function getTodoLists() {
  return readJSON(TODO_LISTS_KEY, []);
}

export function getTodoList(id) {
  return getTodoLists().find((l) => l.id === id) || null;
}

export function saveTodoList(list) {
  const lists = getTodoLists();
  const idx = lists.findIndex((l) => l.id === list.id);
  if (idx >= 0) lists[idx] = list;
  else lists.push(list);
  writeJSON(TODO_LISTS_KEY, lists);
  return list;
}

export function deleteTodoList(id) {
  writeJSON(TODO_LISTS_KEY, getTodoLists().filter((l) => l.id !== id));
}

export function createEmptyTodoList() {
  return { id: uid(), name: "", createdAt: Date.now(), items: [] };
}

// A child item can't have its own children — nesting is a single level deep.
export function makeTodoItem({ text = "" } = {}) {
  return { id: uid(), text, checked: false, children: [] };
}

// ---- Saved to-do templates (structure only — no checked state) ----

export function getTodoTemplates() {
  return readJSON(TODO_TEMPLATES_KEY, []);
}

function stripChecked(items) {
  return items.map((item) => ({ ...item, id: uid(), checked: false, children: stripChecked(item.children || []) }));
}

export function saveAsTemplate(list) {
  const templates = getTodoTemplates();
  const template = { id: uid(), name: list.name, createdAt: Date.now(), items: stripChecked(list.items) };
  templates.push(template);
  writeJSON(TODO_TEMPLATES_KEY, templates);
  return template;
}

export function deleteTodoTemplate(id) {
  writeJSON(TODO_TEMPLATES_KEY, getTodoTemplates().filter((t) => t.id !== id));
}

// Clones a template into a brand-new, independent to-do list ready to use —
// editing or checking off the new list never touches the template it came from.
export function instantiateFromTemplate(template) {
  const list = { id: uid(), name: template.name, createdAt: Date.now(), items: stripChecked(template.items) };
  return saveTodoList(list);
}

// ---- Preferences ----

export function getSoundEnabled() {
  return localStorage.getItem(SOUND_KEY) === "true";
}

export function setSoundEnabled(value) {
  localStorage.setItem(SOUND_KEY, value ? "true" : "false");
}

export function getAlarmSound() {
  return localStorage.getItem(ALARM_SOUND_KEY) || "classic";
}

export function setAlarmSound(value) {
  localStorage.setItem(ALARM_SOUND_KEY, value);
}

export function getThemePref() {
  return readJSON(THEME_KEY, {});
}

export function setThemePref(pref) {
  writeJSON(THEME_KEY, pref);
}

export function getHomeTitle() {
  return localStorage.getItem(HOME_TITLE_KEY) || "Focus";
}

export function setHomeTitle(value) {
  const trimmed = (value || "").trim();
  if (trimmed) localStorage.setItem(HOME_TITLE_KEY, trimmed);
  else localStorage.removeItem(HOME_TITLE_KEY);
}

// ---- Log (auto-recorded completions: focus sessions, later to-do lists) ----

export function getLogEntries() {
  return readJSON(LOG_KEY, []);
}

export function addLogEntry(entry) {
  const entries = getLogEntries();
  const full = { id: uid(), createdAt: Date.now(), ...entry };
  entries.push(full);
  writeJSON(LOG_KEY, entries);
  return full;
}

export function deleteLogEntry(id) {
  writeJSON(LOG_KEY, getLogEntries().filter((e) => e.id !== id));
}

export function clearLog() {
  writeJSON(LOG_KEY, []);
}

// ---- Goals ----

export function getGoals() {
  return readJSON(GOALS_KEY, []);
}

export function getGoal(id) {
  return getGoals().find((g) => g.id === id) || null;
}

export function addGoal(goal) {
  const goals = getGoals();
  const full = { id: uid(), createdAt: Date.now(), showOnHome: false, ...goal };
  goals.push(full);
  writeJSON(GOALS_KEY, goals);
  return full;
}

export function updateGoal(id, patch) {
  const goals = getGoals();
  const idx = goals.findIndex((g) => g.id === id);
  if (idx < 0) return null;
  goals[idx] = { ...goals[idx], ...patch };
  writeJSON(GOALS_KEY, goals);
  return goals[idx];
}

export function deleteGoal(id) {
  writeJSON(GOALS_KEY, getGoals().filter((g) => g.id !== id));
}

// ---- Export / import ----

export function exportBackupData() {
  return {
    type: "backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    activities: getActivities(),
    focusTimers: getFocusTimers(),
    log: getLogEntries(),
    goals: getGoals(),
    todoLists: getTodoLists(),
    todoTemplates: getTodoTemplates(),
    theme: getThemePref(),
    homeTitle: getHomeTitle(),
    soundEnabled: getSoundEnabled(),
    alarmSound: getAlarmSound(),
  };
}

// Always merges (adds new entries) rather than replacing anything, so a bad
// or repeated import can't destroy existing data — activities merge by name
// (same rule as the rest of the app), everything else is always added as new.
export function importData(data) {
  if (!data || data.type !== "backup") {
    throw new Error("That doesn't look like a Focus Timer backup file.");
  }

  const importedActivities = Array.isArray(data.activities) ? data.activities : [];
  const oldIdToLocalId = new Map();
  for (const activity of importedActivities) {
    const local = upsertActivityByName({ name: activity.name, iconKey: activity.iconKey });
    oldIdToLocalId.set(activity.id, local.id);
  }

  const importedTimers = Array.isArray(data.focusTimers) ? data.focusTimers : [];
  const newTimers = importedTimers.map((t) => ({
    ...t,
    id: uid(),
    createdAt: Date.now(),
    activityId: t.activityId ? oldIdToLocalId.get(t.activityId) || null : null,
  }));
  writeJSON(FOCUS_TIMERS_KEY, [...getFocusTimers(), ...newTimers]);

  const importedLog = Array.isArray(data.log) ? data.log : [];
  const newLogEntries = importedLog.map((e) => ({ ...e, id: uid() }));
  writeJSON(LOG_KEY, [...getLogEntries(), ...newLogEntries]);

  const importedGoals = Array.isArray(data.goals) ? data.goals : [];
  const newGoals = importedGoals.map((g) => ({ ...g, id: uid() }));
  writeJSON(GOALS_KEY, [...getGoals(), ...newGoals]);

  function remapItems(items) {
    return (items || []).map((item) => ({ ...item, id: uid(), children: remapItems(item.children) }));
  }

  const importedTodoLists = Array.isArray(data.todoLists) ? data.todoLists : [];
  const newTodoLists = importedTodoLists.map((l) => ({ ...l, id: uid(), createdAt: Date.now(), items: remapItems(l.items) }));
  writeJSON(TODO_LISTS_KEY, [...getTodoLists(), ...newTodoLists]);

  const importedTodoTemplates = Array.isArray(data.todoTemplates) ? data.todoTemplates : [];
  const newTodoTemplates = importedTodoTemplates.map((t) => ({ ...t, id: uid(), createdAt: Date.now(), items: remapItems(t.items) }));
  writeJSON(TODO_TEMPLATES_KEY, [...getTodoTemplates(), ...newTodoTemplates]);

  // Theme, home title, and sound settings are single current-state
  // preferences, not lists, so a full backup restore applies them directly
  // rather than merging -- that's what "restore my backup" means for a
  // device's preferences.
  if (data.theme) setThemePref(data.theme);
  if (data.homeTitle) setHomeTitle(data.homeTitle);
  if (typeof data.soundEnabled === "boolean") setSoundEnabled(data.soundEnabled);
  if (data.alarmSound) setAlarmSound(data.alarmSound);
  const preferencesApplied = Boolean(data.theme || data.homeTitle || typeof data.soundEnabled === "boolean" || data.alarmSound);

  return {
    activityCount: importedActivities.length,
    timerCount: newTimers.length,
    logCount: newLogEntries.length,
    goalCount: newGoals.length,
    todoListCount: newTodoLists.length,
    todoTemplateCount: newTodoTemplates.length,
    preferencesApplied,
  };
}

export function getLastSeenVersion() {
  return readJSON(LAST_SEEN_VERSION_KEY, null);
}

export function setLastSeenVersion(version) {
  writeJSON(LAST_SEEN_VERSION_KEY, version);
}

export { uid };
