// Android (Capacitor) sign-in chain, without a device: loads Capacitor's real Android bridge script
// (native-bridge.js) and the plugin JS exactly the way com.getcapacitor.JSExport injects it, with a fake
// native side (window.androidBridge) that answers like @capacitor-firebase/authentication would.
// Then checks: tap "Masuk dengan Google" → native signInWithGoogle → ID token → Firebase session (Auth emulator).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

const BRIDGE = readFileSync("node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js", "utf8");
// Same output as JSExport.getPluginJS for the plugins this app registers (+ Capacitor's core WebView plugin).
const PLUGINS = { FirebaseAuthentication: ["signInWithGoogle", "signOut", "getCurrentUser"], Filesystem: ["writeFile", "getUri", "readdir", "rmdir"], WebView: ["setServerBasePath", "getServerBasePath", "persistServerBasePath"] };
const pluginJS = () => Object.entries(PLUGINS).map(([id, ms]) => `(function(w) {
var a = (w.Capacitor = w.Capacitor || {});
var p = (a.Plugins = a.Plugins || {});
var t = (p['${id}'] = {});
t.addListener = function(eventName, callback) { return w.Capacitor.addListener('${id}', eventName, callback); }
${ms.map(m => `t['${m}'] = function(_options) {\nreturn w.Capacitor.nativePromise('${id}', '${m}', _options)\n}`).join("\n")}
})(window);`).join("\n") + `\nwindow.Capacitor.PluginHeaders = ${JSON.stringify(Object.entries(PLUGINS).map(([name, ms]) => ({ name, methods: ms.map(m => ({ name: m, rtype: "promise" })) })))};`;

// Fake native side: records calls; tests answer them through Capacitor.fromNative like the Java bridge does.
const FAKE_NATIVE = () => {
  window.__calls = [];
  window.androidBridge = { postMessage: json => { const c = JSON.parse(json); if (c.pluginId !== "Console") window.__calls.push(c); } };
};

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

async function androidPage() {
  const d = await H.device();                                   // emulator Firebase config injected
  await d.ctx.addInitScript(FAKE_NATIVE);
  await d.ctx.addInitScript({ content: `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };\n${BRIDGE}\n${pluginJS()}` });
  await d.page.goto(H.appUrl());
  await H.waitFor(d.page, () => window.__hmtpTest);
  await d.page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  return d;
}
const answer = (page, method, data, error) => page.evaluate(([method, data, error]) => {
  const c = window.__calls.find(x => x.methodName === method && !x.answered); if (!c) return false; c.answered = true;
  window.Capacitor.fromNative(Object.assign({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: !error }, error ? { error } : { data }));
  return true;
}, [method, data, error]);

test("Android: Capacitor bridge is detected as native and the update/auth plugins are reachable", async () => {
  const { page } = await androidPage();
  const r = await page.evaluate(() => ({ native: Capacitor.isNativePlatform(), reg: typeof Capacitor.registerPlugin, fa: typeof (Capacitor.Plugins.FirebaseAuthentication || {}).signInWithGoogle, wv: typeof (Capacitor.Plugins.WebView || {}).setServerBasePath }));
  assert.deepEqual(r, { native: true, reg: "function", fa: "function", wv: "function" });
  assert.deepEqual(page.errors, []);
});

test("Android: Masuk dengan Google → native picker → ID token → Firebase account active and syncing", async () => {
  const { page } = await androidPage();
  await H.act(page, "nav", { t: "more" });
  await page.click('[data-act="signIn"]');
  await H.waitFor(page, () => window.__calls.some(c => c.methodName === "signInWithGoogle"));
  const call = await page.evaluate(() => window.__calls.find(c => c.methodName === "signInWithGoogle"));
  assert.equal(call.pluginId, "FirebaseAuthentication");
  assert.equal(call.options.skipNativeAuth, true);
  // what the plugin returns on Android with skipNativeAuth: the Google ID token, no Firebase user
  const idToken = JSON.stringify(H.user("andi"));               // the Auth emulator accepts unsigned tokens
  assert.ok(await answer(page, "signInWithGoogle", { user: null, credential: { providerId: "google.com", idToken } }));
  await H.waitFor(page, () => window.__hmtpTest.uid());
  await H.waitSynced(page);
  assert.match(await page.textContent('[data-tour="acct"]'), /Andi[\s\S]*andi@example\.com/);
  assert.deepEqual(page.errors, []);
});

test("Android: if Credential Manager fails, the classic Google Sign-In screen is tried and remembered", async () => {
  const { page } = await androidPage();
  await H.act(page, "nav", { t: "more" });
  await page.click('[data-act="signIn"]');
  await H.waitFor(page, () => window.__calls.some(c => c.methodName === "signInWithGoogle"));
  assert.equal(await page.evaluate(() => window.__calls.find(c => c.methodName === "signInWithGoogle").options.useCredentialManager), true);
  await answer(page, "signInWithGoogle", null, { message: "[28444] Developer console is not set up correctly." });
  await H.waitFor(page, () => window.__calls.filter(c => c.methodName === "signInWithGoogle").length === 2);
  assert.equal(await page.evaluate(() => window.__calls.filter(c => c.methodName === "signInWithGoogle")[1].options.useCredentialManager), false);
  await answer(page, "signInWithGoogle", { user: null, credential: { providerId: "google.com", idToken: JSON.stringify(H.user("budi")) } });
  await H.waitFor(page, () => window.__hmtpTest.uid());
  assert.equal(await page.evaluate(() => localStorage.getItem("hmtp:nativeSignIn")), "legacy");
});

test("Android: when sign-in fails, a readable reason and the exact native error are shown", async () => {
  const { page } = await androidPage();
  await H.act(page, "nav", { t: "more" });
  const tap = async () => { await page.click('[data-act="signIn"]'); };
  // 1) user cancels → no second attempt, short message, no detail box
  await tap();
  await H.waitFor(page, () => window.__calls.some(c => c.methodName === "signInWithGoogle" && !c.answered));
  await answer(page, "signInWithGoogle", null, { message: "activity is cancelled by the user." });
  await page.waitForSelector("#toast.on"); assert.match(await page.textContent("#toast"), /dibatalin/i);
  assert.equal(await page.evaluate(() => window.__calls.filter(c => c.methodName === "signInWithGoogle").length), 1);
  assert.equal(await page.$("#err-detail"), null);
  // 2) both methods fail with a configuration error → explained + both raw messages visible + copyable
  await page.evaluate(() => document.getElementById("toast").classList.remove("on"));
  await tap();
  await H.waitFor(page, () => window.__calls.filter(c => c.methodName === "signInWithGoogle" && !c.answered).length === 1);
  await answer(page, "signInWithGoogle", null, { message: "[28444] Developer console is not set up correctly." });
  await H.waitFor(page, () => window.__calls.filter(c => c.methodName === "signInWithGoogle" && !c.answered).length === 1);
  await answer(page, "signInWithGoogle", null, { message: "10: " });
  await page.waitForSelector("#err-detail");
  assert.match(await page.textContent('[data-tour="acct"]'), /sidik jari SHA/);
  assert.match(await page.textContent("#err-detail"), /CredentialManager: \[28444\][\s\S]*GoogleSignIn: 10:/);
  assert.ok(await page.isEnabled('[data-act="signIn"]'), "user can try again");
  assert.deepEqual(page.errors, []);
});
