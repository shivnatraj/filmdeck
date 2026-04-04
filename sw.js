// FilmDeck Service Worker v4
const CACHE_NAME = 'filmdeck-v4';
const STATIC_ASSETS = ['/', '/index.html', '/app.html', '/offline-init.js', '/patches.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url      = new URL(event.request.url);
  const isAPI    = url.pathname.startsWith('/api/');
  const isExt    = url.origin !== self.location.origin;

  // API + external: pass through to network, throw on failure so
  // offline-init.js fetch interceptor can handle the fallback
  if (isAPI || isExt) {
    event.respondWith(fetch(event.request));
    return;
  }

  // App shell: network first, single clone, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(hit => {
          if (hit) return hit;
          if (event.request.mode === 'navigate') return caches.match('/app.html');
          return new Response('Offline', { status: 503 });
        })
      )
  );
});
