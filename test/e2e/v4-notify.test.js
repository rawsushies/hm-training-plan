// Notifications without a device: Capacitor's real Android bridge (native-bridge.js) + plugin proxies exactly as
// JSExport injects them, and a fake native LocalNotifications that keeps its own pending list like the plugin does.
// What this proves: permission is requested only after the user turns reminders on and saves; real plan reminders are
// handed to the OS scheduler (inexact, small icon, channel); turning off cancels them; an old APK without the plugin
// is told to update; the web build never requests permission. It does NOT prove delivery on a real phone.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

const BRIDGE = readFileSync("node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js", "utf8");
const BASE = { FirebaseAuthentication: ["signInWithGoogle", "signOut", "getCurrentUser"], Filesystem: ["writeFile", "getUri", "readdir", "rmdir"], WebView: ["setServerBasePath", "getServerBasePath", "persistServerBasePath"] };
const LN = ["schedule", "getPending", "cancel", "createChannel", "listChannels", "checkPermissions", "requestPermissions", "areEnabled"];
const pluginJS = P => Object.entries(P).map(([id, ms]) => `(function(w) {
var a = (w.Capacitor = w.Capacitor || {}); var p = (a.Plugins = a.Plugins || {}); var t = (p['${id}'] = {});
t.addListener = function(e, cb) { return w.Capacitor.addListener('${id}', e, cb); }
${ms.map(m => `t['${m}'] = function(o) { return w.Capacitor.nativePromise('${id}', '${m}', o) }`).join("\n")}
})(window);`).join("\n") + `\nwindow.Capacitor.PluginHeaders = ${JSON.stringify(Object.entries(P).map(([name, ms]) => ({ name, methods: ms.map(m => ({ name: m, rtype: "promise" })) })))};`;

// Fake native LocalNotifications: answers asynchronously through Capacitor.fromNative like the Java bridge.
const FAKE_NATIVE = () => {
  const st = window.__ln = { perm: "prompt", pending: [], channels: [], calls: [] };
  const handle = { checkPermissions: () => ({ display: st.perm }), requestPermissions: () => { st.perm = "granted"; return { display: st.perm }; },
    createChannel: o => { st.channels.push(o.id); return {}; }, listChannels: () => ({ channels: st.channels.map(id => ({ id })) }),
    getPending: () => ({ notifications: st.pending.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: n.schedule, extra: n.extra })) }),
    cancel: o => { const ids = new Set(o.notifications.map(n => n.id)); st.pending = st.pending.filter(n => !ids.has(n.id)); return {}; },
    schedule: o => { st.pending.push(...o.notifications); return { notifications: o.notifications.map(n => ({ id: n.id })) }; },
    areEnabled: () => ({ value: st.perm === "granted" }) };
  window.androidBridge = { postMessage: json => {
    const c = JSON.parse(json); if (c.pluginId !== "LocalNotifications") return;
    st.calls.push(c.methodName);
    setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: true, data: handle[c.methodName](c.options || {}) }), 5);
  } };
};

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

async function androidPage(withPlugin = true) {
  const d = await H.device();
  await d.ctx.addInitScript(FAKE_NATIVE);
  await d.ctx.addInitScript({ content: `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };\n${BRIDGE}\n${pluginJS(withPlugin ? Object.assign({}, BASE, { LocalNotifications: LN }) : BASE)}` });
  await H.open(d.page);
  return d;
}
const lnState = page => page.evaluate(() => ({ perm: window.__ln.perm, calls: window.__ln.calls.slice(), pending: window.__ln.pending.map(n => ({ id: n.id, title: n.title, channelId: n.channelId, smallIcon: n.smallIcon, exact: n.isExactNotification, idle: n.schedule && n.schedule.allowWhileIdle, at: n.schedule && n.schedule.at, app: n.extra && n.extra.app })), channels: window.__ln.channels.slice() }));

test("Android: no permission prompt on launch; enabling asks once, schedules real reminders, disabling cancels them", async () => {
  const { page } = await androidPage();
  await page.waitForTimeout(3500);                       // past the startup re-plan
  let s = await lnState(page);
  assert.ok(!s.calls.includes("requestPermissions"), "never prompts on first launch");
  assert.equal(s.pending.length, 0);
  await H.act(page, "nav", { t: "notif" });
  assert.match(await page.textContent("main"), /Notifikasi mati/);
  await page.check("#nf-enabled"); await page.check("#nf-race");
  await page.click('[data-act="notifSave"]');
  await H.waitFor(page, () => window.__ln.pending.length > 0);
  s = await lnState(page);
  assert.equal(s.calls.filter(c => c === "requestPermissions").length, 1);
  assert.deepEqual(s.channels.sort(), ["hydration", "monthly", "race", "tips", "weekly", "workout"]);
  assert.ok(s.pending.every(n => n.app === "werunit" && n.smallIcon === "ic_stat_werunit" && n.exact === false && n.idle === true));
  assert.ok(s.pending.some(n => n.channelId === "workout" && /Besok ada latihan|Workout jam/.test(n.title)), "built from the real plan");
  const horizon = Date.now() + 15 * 864e5;
  assert.ok(s.pending.every(n => new Date(n.at).getTime() > Date.now() && new Date(n.at).getTime() < horizon), "next 14 days only");
  await page.waitForSelector('[data-act="notifTest"]');
  assert.match(await page.textContent("main"), /Aktif\.[\s\S]*pengingat terjadwal/);
  // Re-render/persist without changes does not reschedule
  const n1 = s.calls.filter(c => c === "schedule").length;
  await H.act(page, "nav", { t: "home" }); await page.waitForTimeout(4500);
  assert.equal((await lnState(page)).calls.filter(c => c === "schedule").length, n1, "unchanged plan → no reschedule");
  // Turning reminders off cancels everything this app scheduled
  await H.act(page, "nav", { t: "notif" });
  await page.uncheck("#nf-enabled"); await page.click('[data-act="notifSave"]');
  await H.waitFor(page, () => window.__ln.pending.length === 0);
  assert.match(await page.textContent("#toast"), /dimatikan/);
  assert.deepEqual(page.errors, []);
});

test("Android: an older APK (no notification plugin) is told to update instead of pretending", async () => {
  const { page } = await androidPage(false);
  await H.act(page, "nav", { t: "notif" });
  assert.match(await page.textContent("main"), /Perlu update aplikasi/);
  await page.check("#nf-enabled"); await page.click('[data-act="notifSave"]');
  assert.equal((await lnState(page)).calls.length, 0);
  assert.deepEqual(page.errors, []);
});

test("Web: notifications are preferences only; the browser permission is never requested", async () => {
  const d = await H.device();
  await d.ctx.addInitScript(() => { window.__asked = 0; if (window.Notification) window.Notification.requestPermission = () => { window.__asked++; return Promise.resolve("default"); }; });
  await H.open(d.page);
  await H.act(d.page, "nav", { t: "more" });
  assert.ok(!(await d.page.textContent("main")).includes("segera hadir"));
  await H.act(d.page, "nav", { t: "notif" });
  assert.match(await d.page.textContent("main"), /Notifikasi hanya di aplikasi Android/);
  await d.page.check("#nf-enabled"); await d.page.click('[data-act="notifSave"]');
  await d.page.waitForSelector("#toast.on");
  assert.match(await d.page.textContent("#toast"), /aplikasi Android/);
  assert.equal(await d.page.evaluate(() => window.__asked), 0);
  assert.equal(await d.page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:anon:v3")).settings.notif.enabled), true);
  assert.deepEqual(d.page.errors, []);
});
