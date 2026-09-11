const CACHE = 'consultoria-rf-v4.9.7';
const APP_SHELL = [
  './',
  './app.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => null)
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE)
            .map(k => caches.delete(k))
        )
      )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();

        caches
          .open(CACHE)
          .then(cache => cache.put(event.request, copy))
          .catch(() => null);

        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then(r => r || caches.match('./app.html'))
      )
  );
});
