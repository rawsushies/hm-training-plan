// In-app update tests: real service worker update in Chromium, and the APK live-update logic
// with mocked Capacitor plugins (Filesystem + WebView) against real release files.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as H from "./harness.js";

let dir;
const release = (v, ...notes) => execFileSync("node", ["scripts/release.mjs", v, ...notes, `--dir=${dir}`], { encoding: "utf8" });
before(async () => {
  dir = mkdtempSync(join(tmpdir(), "hmtp-rel-"));
  cpSync("public", dir, { recursive: true });
  release("3.1.0", "awal");
  await H.startServer(dir); await H.launch();
});
after(async () => { await H.closeBrowser(); H.stopServer(); rmSync(dir, { recursive: true, force: true }); });

test("web: a new release is downloaded by the service worker, offered, applied; data is kept", async () => {
  const { page } = await H.device({ cloud: false });
  const base = H.appUrl().replace("?emulator=1", "");
  await page.goto(base);
  await H.ready(page);
  await page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  await H.logRun(page, { date: "2026-11-10", km: 5, dur: "35:00" });
  await page.waitForFunction(() => navigator.serviceWorker.controller || false, null, { timeout: 15000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller); });
  assert.equal(await page.evaluate(() => HMTP_BUILD.version), "3.1.0");
  // Developer ships 3.2.0 (a visible UI tweak + new notes)
  const idx = join(dir, "index.html");
  writeFileSync(idx, readFileSync(idx, "utf8").replace("<title>WeRunIt</title>", "<title>WeRunIt v2</title>"));
  release("3.2.0", "Tampilan baru di sidebar");
  await page.evaluate(() => HMTPUpdate.check(true));
  await page.waitForFunction(() => HMTPUpdate.state === "ready", null, { timeout: 20000 });
  assert.ok(await page.isVisible('.upd [data-act="updApply"]'), "update banner shown");
  // never applied in the middle of a timer
  await H.act(page, "runStart", { id: "w1-wd" });
  assert.equal(await page.evaluate(() => canApplyUpdate()), false);
  await H.act(page, "runCancel");
  await Promise.all([page.waitForNavigation(), page.click('.upd [data-act="updApply"]')]);
  await H.ready(page);
  await page.waitForFunction(() => window.HMTP_BUILD && HMTP_BUILD.version === "3.2.0", null, { timeout: 15000 });
  assert.equal(await page.title(), "WeRunIt v2");
  assert.equal(await page.evaluate(() => S.logs.length), 1, "training data survives the update");
  await page.waitForSelector("#toast.on");
  assert.match(await page.textContent("#toast"), /diperbarui ke versi 3\.2\.0/);
  await H.act(page, "nav", { t: "about" });
  assert.match(await page.textContent("main"), /Tampilan baru di sidebar/);
  assert.deepEqual(page.errors, []);
});

// Mocked Capacitor runtime: Filesystem stores into a JS map; WebView records base-path changes.
const NATIVE_MOCK = () => {
  const fs = new Map(), wv = { set: [], persisted: [] };
  window.__fs = fs; window.__wv = wv;
  window.Capacitor = {
    isNativePlatform: () => true,
    registerPlugin: n => window.Capacitor.Plugins[n],
    Plugins: {
      Filesystem: {
        writeFile: async ({ path, data }) => { fs.set(path, data); return { uri: "file:///data/files/" + path }; },
        getUri: async ({ path }) => ({ uri: "file:///data/user/0/com.hmtrainingplan.app/files/" + path }),
        readdir: async ({ path }) => ({ files: [...new Set([...fs.keys()].filter(k => k.startsWith(path + "/")).map(k => k.split("/")[1]))].map(name => ({ name })) }),
        rmdir: async ({ path }) => { for (const k of [...fs.keys()]) if (k.startsWith(path + "/")) fs.delete(k); }
      },
      WebView: { setServerBasePath: async ({ path }) => { wv.set.push(path); }, persistServerBasePath: async () => { wv.persisted.push(wv.set[wv.set.length - 1]); } }
    }
  };
};
async function nativePage(build, nativeLevel = 1) {
  const { page, ctx } = await H.device({ cloud: false });
  await ctx.addInitScript(NATIVE_MOCK);
  await ctx.addInitScript(([b, base]) => { window.HMTP_BUILD = b; window.HMTP_UPDATE_URL = base; }, [build, H.appUrl().replace("/?emulator=1", "/")]);
  await ctx.setExtraHTTPHeaders({});
  await page.route("**/__updater.html", r => r.fulfill({ contentType: "text/html", body: `<!doctype html><script>Object.defineProperty(navigator,"userAgent",{get:()=>"Mozilla/5.0 HMTPNative/${nativeLevel}"});</script><script src="js/updater.js"></script>` }));
  await page.goto(H.appUrl().replace("?emulator=1", "__updater.html"));
  await page.evaluate(() => { HMTPUpdate.mode = "native"; });   // what init() decides on a device
  return page;
}

test("APK live update: downloads every file, verifies SHA-256, switches only after a successful boot", async () => {
  const latest = JSON.parse(readFileSync(join(dir, "version.json"), "utf8"));
  const page = await nativePage({ version: "3.1.0", build: "2026-01-01T00:00:00Z" });
  await page.evaluate(() => HMTPUpdate.init({ canApplyNow: () => false }));
  await page.waitForFunction(() => HMTPUpdate.state === "ready", null, { timeout: 20000 });
  const st = await page.evaluate(() => ({ files: window.__fs.size, mode: HMTPUpdate.mode, ready: JSON.parse(localStorage.getItem("hmtp:update:v1")).ready }));
  assert.equal(st.mode, "native");
  assert.equal(st.files, latest.files.length);
  assert.match(st.ready.path, /^\/data\/user\/0\/com\.hmtrainingplan\.app\/files\/bundles\/3\.2\.0-/);
  // apply → WebView switches, but nothing is persisted yet
  await page.evaluate(() => HMTPUpdate.apply());
  assert.deepEqual(await page.evaluate(() => [window.__wv.set.length, window.__wv.persisted.length]), [1, 0]);
  // the new build starts (same localStorage, new HMTP_BUILD) and confirms itself → persisted
  await page.evaluate(b => { window.HMTP_BUILD = b; }, { version: latest.version, build: latest.build });
  await page.evaluate(() => { const s = document.createElement("script"); s.src = "js/updater.js?2"; document.head.appendChild(s); return new Promise(r => s.onload = r); });
  await page.evaluate(() => { HMTPUpdate.mode = "native"; return HMTPUpdate.nativeBoot(); });
  const after = await page.evaluate(() => ({ persisted: window.__wv.persisted.length, st: JSON.parse(localStorage.getItem("hmtp:update:v1")) }));
  assert.equal(after.persisted, 1);
  assert.equal(after.st.active.version, latest.version);
  assert.equal(after.st.pending, undefined);
});

test("APK live update: a tampered file is rejected; a build that fails to start is never retried", async () => {
  const page = await nativePage({ version: "3.1.0", build: "2026-01-01T00:00:00Z" });
  await page.route("**/js/logic.js?v=*", r => r.fulfill({ contentType: "text/javascript", body: "/* tampered */" }));
  await page.evaluate(() => HMTPUpdate.check(true));
  await page.waitForFunction(() => HMTPUpdate.state === "error", null, { timeout: 20000 });
  assert.match(await page.evaluate(() => HMTPUpdate.err), /hash js\/logic\.js/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:update:v1") || "{}").ready), undefined);
  await page.unroute("**/js/logic.js?v=*");
  // download OK, switch, but the new build never confirms (crash) → next start keeps the old build
  await page.evaluate(() => HMTPUpdate.check(true));
  await page.waitForFunction(() => HMTPUpdate.state === "ready", null, { timeout: 20000 });
  await page.evaluate(() => HMTPUpdate.apply());
  await page.evaluate(() => HMTPUpdate.nativeBoot());      // relaunch on the OLD build (HMTP_BUILD unchanged)
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:update:v1")));
  assert.equal(st.pending, undefined); assert.match(st.failed, /^3\.2\.0\+/);
  assert.equal(await page.evaluate(() => window.__wv.persisted.length), 0, "broken build never made permanent");
  await page.evaluate(() => { HMTPUpdate.state = "idle"; HMTPUpdate.mode = "native"; return HMTPUpdate.check(true); });
  assert.equal(await page.evaluate(() => HMTPUpdate.err), "failed-build", "the failed build is not downloaded again");
});

test("APK live update: a release that needs native changes asks for a new APK instead", async () => {
  const m = JSON.parse(readFileSync(join(dir, "version.json"), "utf8")); m.minNative = 2; writeFileSync(join(dir, "version.json"), JSON.stringify(m));
  const page = await nativePage({ version: "3.1.0", build: "2026-01-01T00:00:00Z" }, 1);
  await page.evaluate(() => HMTPUpdate.check(true));
  await page.waitForFunction(() => HMTPUpdate.state === "native-required", null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => window.__fs.size), 0, "nothing downloaded");
  m.minNative = 1; writeFileSync(join(dir, "version.json"), JSON.stringify(m));
});
