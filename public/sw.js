/* Service worker: makes the app start offline. Caches only this app's own files.
 * Firebase API traffic (googleapis.com etc.) is never cached or intercepted. */
const VERSION = "hmtp-v3.0.0";
const SHELL = ["./", "index.html", "firebase-config.js", "manifest.webmanifest", "icon.svg", "icon-192.png",
  "js/logic.js", "js/sync.js", "js/tutorial.js", "js/notify.js", "js/cloud-firebase.js",
  "vendor/firebase/12.19.0/firebase-app.js", "vendor/firebase/12.19.0/firebase-auth.js", "vendor/firebase/12.19.0/firebase-firestore.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // Network first for the page + config (fresh deploys), cache first for versioned assets.
  const fresh = u.pathname.endsWith("/") || u.pathname.endsWith(".html") || u.pathname.endsWith("firebase-config.js") || u.pathname.endsWith("sw.js");
  if (fresh) {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return res; })));
  }
});
