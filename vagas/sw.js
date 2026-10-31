/* Service worker PWA e OneSignal quando configurado */
const CACHE_NAME = "chacara-vagas-v3";
const ASSETS = ["/vagas/","/vagas/index.html","/vagas/app.js","/vagas/config.js","/vagas/manifest.webmanifest","/vagas/icon.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const url=new URL(e.request.url);if(e.request.method!=="GET"||url.origin!==self.location.origin)return;
 if(url.pathname==="/vagas/config.js"){e.respondWith(fetch(e.request,{cache:"no-store"}));return}
 if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).catch(()=>caches.match("/vagas/index.html")));return}
 e.respondWith(fetch(e.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,copy))}return res}).catch(()=>caches.match(e.request)))});
try{importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")}catch(e){}
