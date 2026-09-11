const CACHE = 'consultoria-rf-v5.2.3';
const APP_SHELL = ['./app.html','./manifest.json','./rf-icon-192-v4910.png','./rf-icon-512-v4910.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)).catch(console.warn)); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); }
    return r;
  }).catch(async () => (await caches.match(e.request)) || (e.request.mode === 'navigate' ? caches.match('./app.html') : Response.error())));
});
