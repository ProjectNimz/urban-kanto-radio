const CACHE_PREFIX = 'ukr-shell-';
const CACHE_NAME = CACHE_PREFIX + '20261027-8';
const SHELL = ['/assets/fonts/fonts.css','/assets/ukr-pwa-192.png','/assets/ukr-pwa-512.png','/community.html','/community-chat.js','/performance-utils.js','/notifications.js','/assets/fonts/4ba7d3d09669.woff2','/assets/fonts/698f9960927e.woff2','/assets/fonts/9964608a8493.woff2','/assets/fonts/e1896b13b2b1.woff2','/index.html','/events.html','/station-config.js','/radio-player.js','/player-loader.js','/navigation.js','/pwa.js','/manifest.webmanifest','/dispatch-data.js','/events-data.js','/events.js','/assets/urban-kanto-logo.svg','/assets/urban-kanto-icon.svg'];
const CORE=SHELL.filter(path=>!['/events.html','/community.html','/community-chat.js','/performance-utils.js','/notifications.js','/assets/ukr-pwa-192.png','/assets/ukr-pwa-512.png'].includes(path));
CORE.push('/offline.html');SHELL.push('/assets/ukr-app-180.png','/assets/ukr-app-192.png','/assets/ukr-app-512.png','/assets/ukr-app-maskable-512.png','/offline.html','/vendor/supabase-2.118.0.min.js','/assets/dj-koco-decks.jpg');
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  // Reject partial installations; retain the prior active worker on failure.
  await cache.addAll(CORE);
  // A waiting update activates after old pages close, avoiding mixed versions.
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache streaming media, auth, chat, news APIs, or admin traffic.
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!SHELL.includes(path) || url.search) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        try { await cache.put(path, response.clone()); } catch (_) {}
      }
      return response;
    } catch (error) {
      const cached = await caches.match(path);
      if (cached) return cached;
      if(request.mode==='navigate'){const offline=await caches.match('/offline.html');if(offline)return offline;}
      throw error;
    }
  })());
});

self.addEventListener('push',event=>{
 let data;try{data=event.data?.json()}catch{return}
 if(!data||!Number.isFinite(data.expiresAt)||data.expiresAt<=Date.now())return;
 let target;try{target=new URL(data.url||'/',self.location.origin)}catch{return}
 if(target.origin!==self.location.origin)return;
 event.waitUntil(self.registration.showNotification(String(data.title||'Urban Kanto Radio').slice(0,120),{body:String(data.body||'Tune in.').slice(0,240),icon:'/assets/ukr-app-192.png',badge:'/assets/ukr-app-192.png',tag:'ukr-live',data:{url:target.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 let target;try{target=new URL(event.notification.data?.url||'/',self.location.origin)}catch{return}
 if(target.origin!==self.location.origin)return;
 event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=clients.find(client=>client.url===target.href);if(existing)return existing.focus();return self.clients.openWindow(target.href)})());
});
