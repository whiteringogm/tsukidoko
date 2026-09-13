const CACHE='tsukidoko-v1';
const ASSETS=['./','./index.html','./style.css','./app.js','./navigation.js','./manifest.json','./vendor/suncalc.js','./vendor/geomagnetism.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
// An update waits until old clients close, avoiding a mixture of app versions.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys()){if(name.startsWith('tsukidoko-')&&name!==CACHE)await caches.delete(name);}await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Cache-first app shell keeps module and HTML versions coherent offline.
    if(event.request.mode==='navigate')return await cache.match('./index.html')||fetch(event.request);
    return await cache.match(event.request,{ignoreSearch:true})||fetch(event.request);
  })());
});
