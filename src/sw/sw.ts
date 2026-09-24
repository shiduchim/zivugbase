/// <reference lib="webworker" />
/* ZivugBase service worker.
   1. Offline: precaches the built app; navigation is network-first with a short timeout, so a
      slow or filtered connection falls back to the cached app instead of hanging.
   2. Share target: every Android "Share → ZivugBase" is stored as its OWN queue entry in a small
      separate database. The app moves them into the Inbox on start. (PeerMatch stored every
      share under one key, so a second share erased the first.) */
export {};
declare const self: ServiceWorkerGlobalScope;

const VERSION = '__BUILD_VERSION__';
const PRECACHE = '__PRECACHE__' as unknown as string[];
const CACHE = 'zivugbase-' + VERSION;
const INCOMING_DB = 'zivugbase-incoming';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* One file at a time: a single failed download must not block the whole update. */
      await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('zivugbase-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

function openIncoming(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(INCOMING_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveShare(request: Request): Promise<void> {
  const form = await request.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  const entry = {
    receivedAt: Date.now(),
    title: String(form.get('title') ?? ''),
    text: String(form.get('text') ?? ''),
    url: String(form.get('url') ?? ''),
    files: files.map((f) => ({ name: f.name, type: f.type, blob: f as Blob }))
  };
  const db = await openIncoming();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function fromCache(request: Request | string): Promise<Response | undefined> {
  return (await caches.match(request, { ignoreSearch: true })) ?? undefined;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          await saveShare(event.request);
          return Response.redirect('./#/inbox?shared=1', 303);
        } catch {
          return Response.redirect('./#/inbox?shared=failed', 303);
        }
      })()
    );
    return;
  }
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await Promise.race([
            fetch(event.request),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('slow')), 4000))
          ]);
          if (network.ok) (await caches.open(CACHE)).put('./', network.clone());
          return network;
        } catch {
          return (await fromCache('./')) ?? (await fromCache('./index.html')) ?? new Response('ZivugBase is offline and not cached yet.', { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await fromCache(event.request);
      if (cached) return cached;
      const network = await fetch(event.request);
      if (network.ok) (await caches.open(CACHE)).put(event.request, network.clone());
      return network;
    })()
  );
});
