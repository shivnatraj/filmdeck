// FilmDeck Service Worker v2
// Fixed: no double-consuming responses, no caching API GETs (prevents live polling errors)

const CACHE_NAME = 'filmdeck-v2';
const STATIC_ASSETS = ['/', '/index.html', '/app.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(e => console.warn('SW cache fail', e)))
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
  const url = new URL(event.request.url);
  const isAPI = url.pathname.startsWith('/api/');
  const isExternal = url.origin !== self.location.origin;

  // API GETs — network only, never clone, never cache
  // This prevents "Response body already used" with live polling
  if (isAPI && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503, headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // API writes — queue when offline
  if (isAPI) {
    event.respondWith(handleAPIWrite(event.request));
    return;
  }

  // External (fonts, etc.) — network only
  if (isExternal) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // App shell — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok && res.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/app.html') || caches.match('/');
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

const offlineQueue = [];

async function handleAPIWrite(request) {
  try {
    const res = await fetch(request.clone());
    if (offlineQueue.length > 0) flushQueue();
    return res;
  } catch {
    const body = await request.text().catch(() => '');
    offlineQueue.push({ url: request.url, method: request.method, body, headers: Object.fromEntries(request.headers) });
    self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ type: 'QUEUED_WRITE', count: offlineQueue.length })));
    return new Response(JSON.stringify({ ok: true, offline: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function flushQueue() {
  while (offlineQueue.length > 0) {
    const r = offlineQueue[0];
    try { await fetch(r.url, { method: r.method, headers: r.headers, body: r.body }); offlineQueue.shift(); }
    catch { break; }
  }
  if (!offlineQueue.length) {
    self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ type: 'SYNC_COMPLETE' })));
  }
}

self.addEventListener('sync', e => { if (e.tag === 'filmdeck-sync') e.waitUntil(flushQueue()); });

self.addEventListener('push', event => {
  if (!event.data) return;
  const d = event.data.json();
  event.waitUntil(self.registration.showNotification(d.title || 'FilmDeck', { body: d.body || '' }));
});
