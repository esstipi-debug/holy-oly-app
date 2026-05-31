/* Holy Oly · service worker (mockup PWA) — cache-first app shell */
const CACHE = 'holy-oly-v1';
const ASSETS = [
  './', './app.html', './index.html', './atleta.html', './coach.html', './equipo.html',
  './wl-themes.css', './app-mode.css', './pwa.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match('./app.html'))
    )
  );
});
