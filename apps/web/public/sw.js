// Minimal service worker — registers itself + offline shell fallback.
// Antagna is an internal dashboard, so we don't aggressively cache app data.
const CACHE = 'antagna-v2';
const SHELL = ['/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Bypass non-GET, API, auth flows, and dynamic pages.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/monitoring')
  ) {
    return;
  }
  // Network-first with offline fallback to cached root.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Optimistically cache same-origin GETs.
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/offline'))),
  );
});
