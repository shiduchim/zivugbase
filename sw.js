/* ZivugBase service worker.

   Unlike PeerMatch's sw.js, this one does NOT inject script tags into the
   HTML. index.html loads one ES module and the module graph does the rest, so
   there is no ordered SCRIPTS list to keep in sync and no load-order coupling.
   Bump VERSION on every runtime change. */

const VERSION = '1';
const CACHE = 'zivugbase-v' + VERSION;

const ASSETS = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './css/app.css',
  './js/main.js',
  './js/core/bus.js', './js/core/format.js', './js/core/store.js',
  './js/core/blobs.js', './js/core/model.js',
  './js/data/backup.js',
  './js/list/engine.js', './js/list/views.js',
  './js/ui/app.js', './js/ui/today.js', './js/ui/listscreen.js', './js/ui/detail.js',
  './js/ui/forms.js', './js/ui/settings.js', './js/ui/sheet.js',
  './js/ui/contact.js', './js/ui/activity.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('zivugbase-v') && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Network first, falling back to cache, so a deployed update is picked up on
   the next load while the app still works fully offline. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request, { cache: 'no-store' });
      if (fresh.ok) (await caches.open(CACHE)).put(e.request, fresh.clone());
      return fresh;
    } catch (_) {
      const hit = await caches.match(e.request) || await caches.match('./index.html');
      return hit || new Response('ZivugBase is unavailable offline.', { status: 503 });
    }
  })());
});
