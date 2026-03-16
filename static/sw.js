const CACHE_VERSION = 'v1';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-cache-${CACHE_VERSION}`;

const SHELL_ASSETS = ['/', '/index.html'];
const EXCLUDED_ROUTES = ['/login', '/setup', '/auth'];
const EXCLUDED_API_ROUTES = ['/api/upload', '/api/backup', '/api/logout'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== RUNTIME_CACHE) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (EXCLUDED_ROUTES.some((route) => url.pathname.startsWith(route))) return;
  if (EXCLUDED_API_ROUTES.some((route) => url.pathname.startsWith(route))) return;

  if (request.mode === 'navigate' || isAppShellAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  event.respondWith(networkFirstWithFallback(request, RUNTIME_CACHE));
});

function staleWhileRevalidate(request, cacheName) {
  return caches.match(request).then((cached) => {
    const fetchPromise = fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, clone));
      }
      return response;
    });
    return cached || fetchPromise;
  });
}

function networkFirstWithFallback(request, cacheName) {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() =>
      caches.match(request).then(
        (cached) =>
          cached ||
          new Response('Offline - no cached data available', {
            status: 503,
            statusText: 'Service Unavailable',
          })
      )
    );
}

function isAppShellAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/i.test(pathname);
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
