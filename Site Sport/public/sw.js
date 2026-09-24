const CACHE = "__CACHE_VERSION__";
const SHELL = "__PRECACHE__";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("momentum-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (event.request.mode === "navigate") {
    // Callback URLs and their parameters are never stored in Cache Storage.
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }
  if (!/\.(js|css|webp|png|svg|webmanifest)$/.test(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
    }
    return response;
  })));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => windows[0]?.focus() || clients.openWindow("./")));
});
