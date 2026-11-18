// M4: shoes (initial km, rotation, discovery links) and integrations (honest statuses, Health Connect import through
// Capacitor's real Android bridge with a fake native Health plugin). Does NOT prove Health Connect on a real phone.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

const BRIDGE = readFileSync("node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js", "utf8");
const P = { Filesystem: ["writeFile"], WebView: ["setServerBasePath"], Health: ["isAvailable", "requestAuthorization", "checkAuthorization", "queryWorkouts"] };
const pluginJS = () => Object.entries(P).map(([id, ms]) => `(function(w){var a=(w.Capacitor=w.Capacitor||{});var p=(a.Plugins=a.Plugins||{});var t=(p['${id}']={});
t.addListener=function(e,cb){return w.Capacitor.addListener('${id}',e,cb)};${ms.map(m => `t['${m}']=function(o){return w.Capacitor.nativePromise('${id}','${m}',o)};`).join("")}})(window);`).join("\n")
  + `\nwindow.Capacitor.PluginHeaders=${JSON.stringify(Object.entries(P).map(([name, ms]) => ({ name, methods: ms.map(m => ({ name: m, rtype: "promise" })) })))};`;
const FAKE = () => {
  window.__hc = [];
  const W = [
    { workoutType: "running", duration: 2100, totalDistance: 6020, startDate: "2026-11-03T22:40:00.000Z", endDate: "2026-11-03T23:15:00.000Z", sourceName: "Jam", platformId: "w1" },
    { workoutType: "cycling", duration: 3600, totalDistance: 20000, startDate: "2026-11-04T22:00:00.000Z", endDate: "2026-11-04T23:00:00.000Z", platformId: "w2" },
    { workoutType: "running", duration: 1800, totalDistance: 5000, startDate: "2026-11-05T22:40:00.000Z", endDate: "2026-11-05T23:10:00.000Z", platformId: "w3" }];
  const ans = { isAvailable: () => ({ available: true, platform: "android" }), requestAuthorization: o => ({ readAuthorized: o.read, readDenied: [], writeAuthorized: [], writeDenied: [] }), queryWorkouts: () => ({ workouts: W }) };
  window.androidBridge = { postMessage: j => { const c = JSON.parse(j); if (c.pluginId !== "Health") return; window.__hc.push([c.methodName, c.options]);
    setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: true, data: ans[c.methodName](c.options || {}) }), 5); } };
};

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

test("Health Connect (Android bridge): read-only permission, runs only, review before saving, re-sync marks duplicates", async () => {
  const d = await H.device();
  await d.ctx.addInitScript(FAKE);
  await d.ctx.addInitScript({ content: `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };\n${BRIDGE}\n${pluginJS()}` });
  const { page } = d; await H.open(page);
  await page.click(".gate [data-act='gateHc']");               // on the Android app Health Connect is linked at the gate first
  await page.waitForFunction(() => !document.querySelector(".gate"));
  await H.finishOnboarding(page);
  await page.evaluate(() => { if (document.querySelector("#tour")) document.querySelector('[data-act="tutClose"]').click(); });
  await H.act(page, "nav", { t: "more" });
  assert.match(await page.textContent('[data-tour="sources"]'), /Health Connect[\s\S]*Strava[\s\S]*Diblokir/);
  await page.click('[data-act="hcSync"]');
  await page.waitForSelector('[data-act="impSave"]');
  const calls = await page.evaluate(() => window.__hc);
  assert.deepEqual(calls.find(c => c[0] === "requestAuthorization")[1], { read: ["workouts", "distance"] }, "read-only, no write scopes");
  assert.equal(await page.evaluate(() => M.items.length), 2, "cycling workout skipped");
  await H.act(page, "impAll", { v: "1" });             // runs before the plan start are listed but not preselected
  await page.click('[data-act="impSave"]');
  await H.waitFor(page, () => window.__hmtpTest.S().logs.length === 2);
  const logs = await page.evaluate(() => window.__hmtpTest.S().logs.map(l => ({ d: l.distance, src: l.src, ext: l.extId, hr: l.hrAvg })));
  assert.deepEqual(logs.map(l => l.d).sort(), [5, 6.02]); assert.ok(logs.every(l => l.src === "Health Connect" && /^hc:w[13]$/.test(l.ext) && l.hr === null));
  await H.act(page, "nav", { t: "more" }); await page.click('[data-act="hcSync"]');
  await page.waitForSelector('[data-act="impSave"]');
  assert.equal(await page.evaluate(() => M.items.filter(i => i.dup).length), 2, "second sync: both already imported");
  assert.deepEqual(page.errors, []);
});

