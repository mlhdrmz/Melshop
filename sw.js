// Mel Shop — çevrimdışı çalışma için önbellek
const VERSION = "melshop-v5";
const SHELL = [
  "./", "index.html", "css/styles.css", "js/app.js", "js/data.js", "js/store.js", "js/cloud.js",
  "data/seed.json", "fonts/SourceSans3-VF.woff2", "manifest.webmanifest",
  "icons/favicon.svg", "icons/icon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Önce ağ, olmazsa önbellek: güncellemeler hemen gelir, internet yokken site yine açılır.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html")))
  );
});
