const CACHE_NAME = "focus-timer-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/icons.js",
  "./js/activityIcons.js",
  "./js/sheet.js",
  "./js/share.js",
  "./js/theme.js",
  "./js/util.js",
  "./js/wakelock.js",
  "./js/confetti.js",
  "./js/tabs.js",
  "./js/dragReorder.js",
  "./js/goals.js",
  "./js/todoCompletion.js",
  "./js/views/home.js",
  "./js/views/focusEditor.js",
  "./js/views/focusPlayer.js",
  "./js/views/finish.js",
  "./js/views/log.js",
  "./js/views/goals.js",
  "./js/views/activityForm.js",
  "./js/views/activitiesLibrary.js",
  "./js/views/todoEditor.js",
  "./js/views/todoOverview.js",
  "./js/views/todoPlayer.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192-dark.png",
  "./icons/icon-512-dark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Network-first: always try to get the latest app shell when online, only
  // falling back to the cache when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
