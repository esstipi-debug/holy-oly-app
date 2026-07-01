// Minimal service worker: no offline caching, just a real fetch() handler.
// Chrome's install-prompt algorithm has historically required a registered SW with a
// fetch() handler before it fires `beforeinstallprompt` — this is that requirement, nothing more.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
