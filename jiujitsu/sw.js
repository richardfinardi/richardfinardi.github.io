const CACHE="jj-v2";
const ASSETS=["./","./index.html","./styles.css?v=2","./app.js?v=2","./config.js?v=2","./manifest.json?v=2"];

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  e.respondWith(
    fetch(e.request,{cache:"no-store"})
      .then(r=>{
        const c=r.clone();
        caches.open(CACHE).then(x=>x.put(e.request,c));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});