/* Service worker: offline start + background download of new releases.
 * VERSION is stamped by scripts/release.mjs on every release, so each release installs a new worker.
 * A new worker waits until the app tells it to take over (in-app "Perbarui" or auto-update when the
 * app is in the background), so a running page never mixes files from two releases.
 * Only this app's own files are cached; Firebase/Google API traffic is never intercepted. */
const VERSION = "hmtp-5.1.0+2026-11-18T08:53:09Z";
const SHELL = ["./", "vendor/capacitor/8.5.3/capacitor.js", "css/werunit.css", "css/runlab.css", "css/ds.css", "js/v5/ds.js", "js/v5/app5.js", "js/v5/pages5.js", "js/coach/model.js", "js/coach/engine.js", "js/coach/plan.js", "js/coach/views-coach.js", "js/brand.js", "js/motion.js", "js/schedule.js", "js/race.js", "js/views-v4.js", "js/ui-glass.js", "js/views-social.js", "js/views-notify.js", "js/views-weather.js", "js/weather.js", "js/shoes.js", "js/shoe-catalog.js", "js/integrations.js", "js/views-m4.js", "js/lab/lab.js", "js/lab/analysis.js", "js/lab/charts.js", "js/lab/research.js", "js/lab/consult.js", "js/lab/views-lab.js", "js/views-flow.js", "js/scores.js", "js/vessel.js", "js/app4.js", "js/companion.js", "js/ask.js", "js/social.js", "icon-maskable-512.png", "index.html", "firebase-config.js", "version.json", "manifest.webmanifest", "icon.svg", "icon-192.png",
  "js/version.js", "js/logic.js", "js/sync.js", "js/tutorial.js", "js/notify.js", "js/updater.js", "js/cloud-firebase.js",
  "vendor/firebase/12.19.0/firebase-app.js", "vendor/firebase/12.19.0/firebase-auth.js", "vendor/firebase/12.19.0/firebase-firestore.js"];
self.addEventListener("install", e => {
  // cache:"reload" bypasses the HTTP cache so the new release's files are really fetched fresh
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
});
self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("hmtp-") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.endsWith("/version.json")) return;                 // always network: that's how updates are found
  // The page and every asset come from this release's cache, so one release is always self-consistent.
  e.respondWith(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: u.pathname.endsWith("/") || u.pathname.endsWith(".html") }).then(r =>
    r || fetch(e.request).then(res => { if (res.ok && res.type === "basic") c.put(e.request, res.clone()); return res; })
      .catch(() => u.pathname.endsWith("/") || u.pathname.endsWith(".html") ? c.match("index.html") : Response.error()))));
});
