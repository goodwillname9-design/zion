const CACHE = "zion-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/zion-192.png", "/icons/zion-512.png"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;
  if (event.request.mode === "navigate") { event.respondWith(fetch(event.request).then((response) => { const copy=response.clone(); caches.open(CACHE).then((cache)=>cache.put(event.request,copy)); return response; }).catch(()=>caches.match(event.request).then((cached)=>cached||caches.match("/")))); return; }
  event.respondWith(caches.match(event.request).then((cached)=>cached||fetch(event.request).then((response)=>{ if(response.ok&&["style","script","image","font"].includes(event.request.destination)){const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(event.request,copy));}return response;})));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});
