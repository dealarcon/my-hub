// Cache version — increment this to force cache refresh
const CACHE = 'hub-v3';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first — always try network, fall back to cache
self.addEventListener('fetch', e => {
  // Never intercept Notion API or food search calls
  if (e.request.url.includes('api.notion.com') ||
      e.request.url.includes('openfoodfacts') ||
      e.request.url.includes('.netlify/functions')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
