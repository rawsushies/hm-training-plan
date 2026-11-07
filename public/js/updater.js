/* In-app updates (classic script). Exposes globalThis.HMTPUpdate.
 *
 * One release = `npm run release -- <version> "note" ...` then `npm run deploy`.
 * The release script writes js/version.js (the running build), version.json (the latest build +
 * file hashes) and stamps sw.js, so every release changes the service worker.
 *
 * Web / PWA ("sw" mode)
 *   The service worker downloads the new build in the background. When it is installed and waiting,
 *   the app shows "Versi baru siap" and applies it on tap, or automatically when the app goes to the
 *   background / on the next start (if auto-update is on and nothing is in progress).
 *
 * Android APK ("native" mode, Capacitor)
 *   Live update without reinstalling: version.json lists every file with its SHA-256. Files are
 *   downloaded from the hosting origin into the app's private storage, each hash is verified, then the
 *   WebView is pointed at that folder (WebView.setServerBasePath). The new build only becomes permanent
 *   (persistServerBasePath) after it has started successfully and called confirmBoot(); if it fails to
 *   start, the next launch falls back to the previous build automatically.
 *   Changes to native code/plugins need a new APK: version.json "minNative" > this APK's native level
 *   shows "Install APK baru" with a download link instead.
 */
(function (G) {
  "use strict";
  const CUR = G.HMTP_BUILD || { version: "0.0.0", build: "" };
  const NATIVE_RE = /HMTPNative\/(\d+)/;
  const nativeLevel = () => { const m = (navigator.userAgent || "").match(NATIVE_RE); return m ? +m[1] : 0; };
  const isNative = () => !!(G.Capacitor && G.Capacitor.isNativePlatform && G.Capacitor.isNativePlatform());
  const LS_KEY = "hmtp:update:v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} };

  /** Compare dotted versions: returns >0 if a is newer than b. */
  function cmpVer(a, b) {
    const pa = String(a || "0").split(/[.+-]/).map(n => parseInt(n, 10) || 0), pb = String(b || "0").split(/[.+-]/).map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
    return 0;
  }
  const isNewer = (latest, cur) => cmpVer(latest.version, cur.version) > 0 || (cmpVer(latest.version, cur.version) === 0 && latest.build && cur.build && latest.build > cur.build);

  async function sha256Hex(buf) {
    const d = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  function b64(buf) {
    const u = new Uint8Array(buf); let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }

  const U = {
    current: CUR, latest: null, state: "idle", err: "", progress: 0, lastCheck: load().lastCheck || null,
    mode: "none", reg: null, nativeLevel: nativeLevel(), mustUpdate: false, listeners: [],
    cmpVer, isNewer,
    get auto() { const o = load(); return o.auto !== false; },
    set auto(v) { const o = load(); o.auto = !!v; save(o); },
    onChange(fn) { this.listeners.push(fn); },
    set(patch) { Object.assign(this, patch); this.listeners.forEach(f => { try { f(this); } catch (e) {} }); },

    /** Where version.json and release files live. Web: this origin. Native: the hosting origin. */
    baseUrl() {
      if (!isNative()) return new URL("./", location.href).href;
      if (G.HMTP_UPDATE_URL) return String(G.HMTP_UPDATE_URL).replace(/\/?$/, "/");
      const c = G.HMTP_FIREBASE_CONFIG; return c && c.projectId ? `https://${c.projectId}.web.app/` : null;
    },

    /** opts.canApplyNow(): true when nothing is in progress (no timer, no open form). */
    async init(opts = {}) {
      this.canApplyNow = opts.canApplyNow || (() => true);
      if (isNative()) { this.mode = "native"; await this.nativeBoot(); }
      else if ("serviceWorker" in navigator && opts.sw !== false && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) { this.mode = "sw"; await this.swBoot(); }
      else this.mode = "none";
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") { if (this.state === "ready" && this.auto && this.canApplyNow()) this.apply(true); }
        else if (Date.now() - (this.lastCheckMs || 0) > 30 * 60e3) this.check();
      });
      window.addEventListener("online", () => this.check());
      setInterval(() => { if (document.visibilityState === "visible") this.check(); }, 60 * 60e3);
      this.check();
    },

    async fetchLatest() {
      const base = this.baseUrl(); if (!base) throw new Error("no-update-url");
      const r = await fetch(base + "version.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) throw new Error("http-" + r.status);
      const j = await r.json();
      if (!j || typeof j.version !== "string") throw new Error("bad-manifest");
      return j;
    },

    async check(manual) {
      if (this.state === "checking" || this.state === "downloading") return;
      if (navigator.onLine === false) { if (manual) this.set({ state: "error", err: "offline" }); return; }
      if (this.state !== "ready") this.set({ state: "checking", err: "" });
      try {
        const j = await this.fetchLatest();
        this.lastCheckMs = Date.now(); const o = load(); o.lastCheck = new Date().toISOString(); save(o);
        const must = !!(j.minApp && cmpVer(j.minApp, CUR.version) > 0);
        this.set({ latest: j, lastCheck: o.lastCheck, mustUpdate: must });
        if (this.state === "ready") return;
        if (!isNewer(j, CUR)) { this.set({ state: "uptodate" }); return; }
        if (this.mode === "native") {
          if ((j.minNative || 1) > this.nativeLevel) { this.set({ state: "native-required" }); return; }
          if (load().failed === j.version + "+" + j.build) { this.set({ state: "error", err: "failed-build" }); return; }
          await this.nativeDownload(j);
        } else if (this.mode === "sw" && this.reg) {
          await this.reg.update();
          if (this.reg.waiting) this.set({ state: "ready" });
          else this.set({ state: "downloading" });     // updatefound → installed will flip it to ready
        } else this.set({ state: "available" });       // no SW (dev): a reload fetches the new files
      } catch (e) {
        this.set({ state: manual ? "error" : (this.state === "checking" ? "idle" : this.state), err: (e && e.message) || "error" });
      }
    },

    /** Switch to the new build. silent=true when called automatically (app in background). */
    async apply(silent) {
      if (this.mode === "sw") {
        const w = this.reg && this.reg.waiting;
        if (!w) { if (this.state === "available") location.reload(); return; }
        this.applying = true;
        w.postMessage({ type: "SKIP_WAITING" });
        return;                                         // controllerchange → reload
      }
      if (this.mode === "native") {
        const st = load(); if (!st.ready) return;
        st.pending = st.ready; delete st.ready; save(st);
        await G.Capacitor.Plugins.WebView.setServerBasePath({ path: st.pending.path });
        return;
      }
      location.reload();
    },

    /* ---------- service worker ---------- */
    async swBoot() {
      try {
        const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
        this.reg = reg;
        const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) this.set({ state: "ready" }); });
        if (reg.installing) watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => { if (this.applying && !reloaded) { reloaded = true; location.reload(); } });
        // A build that was downloaded during the last session: apply right away at startup.
        if (reg.waiting && navigator.serviceWorker.controller) {
          this.set({ state: "ready" });
          if (this.auto && this.canApplyNow()) this.apply(true);
        }
      } catch (e) { this.mode = "none"; }
    },

    /* ---------- native live update ---------- */
    plugins() { const C = G.Capacitor; return { FS: C.Plugins.Filesystem || C.registerPlugin("Filesystem"), WV: C.Plugins.WebView }; },
    async nativeBoot() {
      const st = load();
      // The build we just switched to started fine → make it permanent, drop older bundles.
      if (st.pending && st.pending.version === CUR.version && st.pending.build === CUR.build) {
        try { await this.plugins().WV.persistServerBasePath(); } catch (e) {}
        const prev = st.active; st.prevActive = prev || null; st.active = st.pending; delete st.pending; save(st);
        this.cleanup(st).catch(() => {});
        this.justUpdated = st.active.version;
      } else if (st.pending) { st.failed = st.pending.version + "+" + st.pending.build; delete st.pending; save(st); } // didn't come up: stay on the persisted build, never retry that build
      if (st.ready && cmpVer(st.ready.version, CUR.version) <= 0 && st.ready.build <= CUR.build) { delete st.ready; save(st); }
      if (st.ready) { this.set({ state: "ready", latest: st.ready.manifest || this.latest }); if (this.auto && this.canApplyNow()) this.apply(true); }
    },
    async nativeDownload(j) {
      const { FS } = this.plugins(), base = this.baseUrl(), dir = `bundles/${j.version}-${(j.build || "").replace(/[^0-9A-Za-z]/g, "")}`;
      const files = (j.files || []).filter(f => f && typeof f.p === "string" && /^[A-Za-z0-9._\/-]+$/.test(f.p) && !f.p.includes("..") && /^[0-9a-f]{64}$/.test(f.h));
      if (!files.length || !files.some(f => f.p === "index.html")) throw new Error("bad-manifest");
      this.set({ state: "downloading", progress: 0 });
      let done = 0;
      for (const f of files) {
        const r = await fetch(base + f.p + "?v=" + encodeURIComponent(j.build || j.version), { cache: "no-store" });
        if (!r.ok) throw new Error("http-" + r.status + " " + f.p);
        const buf = await r.arrayBuffer();
        if ((await sha256Hex(buf)) !== f.h) throw new Error("hash " + f.p);
        await FS.writeFile({ path: `${dir}/${f.p}`, data: b64(buf), directory: "DATA", recursive: true });
        done++; this.set({ progress: Math.round(done / files.length * 100) });
      }
      const { uri } = await FS.getUri({ path: dir, directory: "DATA" });
      const st = load(); st.ready = { version: j.version, build: j.build, dir, path: uri.replace(/^file:\/\//, ""), manifest: { version: j.version, build: j.build, notes: j.notes || [] } }; save(st);
      this.set({ state: "ready" });
    },
    async cleanup(st) {
      const { FS } = this.plugins();
      const keep = new Set([st.active && st.active.dir, st.prevActive && st.prevActive.dir].filter(Boolean));
      const list = await FS.readdir({ path: "bundles", directory: "DATA" }).catch(() => ({ files: [] }));
      for (const f of list.files || []) { const name = typeof f === "string" ? f : f.name; if (!keep.has("bundles/" + name)) await FS.rmdir({ path: "bundles/" + name, directory: "DATA", recursive: true }).catch(() => {}); }
    }
  };
  G.HMTPUpdate = U;
})(typeof globalThis !== "undefined" ? globalThis : this);
