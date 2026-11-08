// Shared helpers for browser end-to-end tests against the Firebase Auth + Firestore emulators.
// Run via: npm run test:e2e  (wraps `firebase emulators:exec`).
import { chromium } from "playwright";
import { createServer } from "http-server";

export const PROJECT = "demo-hmtp";
const FS = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
export const CONFIG = { apiKey: "demo-api-key", authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: "1:1:web:1" };

let server, port;
export async function startServer(root = "public") {
  server = createServer({ root, cache: -1, silent: true });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  port = server.server.address().port;
  return port;
}
export function stopServer() { server && server.close(); }
export const appUrl = (extra = "") => `http://127.0.0.1:${port}/?emulator=1${extra}`;

export async function resetEmulators() {
  await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
}

let browser;
export async function launch() { browser = await chromium.launch(); return browser; }
export async function closeBrowser() { await browser?.close(); }

/** A "device": its own browser context (separate localStorage / IndexedDB), with Firebase config injected. */
export async function device({ viewport = { width: 390, height: 844 }, seed = null, cloud = true, gate = false } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(cfg => { window.HMTP_FIREBASE_CONFIG = cfg; }, cloud ? CONFIG : null);
  // v4 shows a Google sign-in gate to signed-out users; tests that exercise anonymous use opt out of it
  // the same way a user does ("Lanjut tanpa akun"). Gate tests pass gate:true.
  if (!gate) await ctx.addInitScript(() => { if (!localStorage.getItem("hmtp:gate:v4")) localStorage.setItem("hmtp:gate:v4", '"local"'); });
  if (seed) await ctx.addInitScript(s => { if (!localStorage.getItem("__seeded")) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); localStorage.setItem("__seeded", "1"); } }, seed);
  // Hermetic by default: the live weekly shoe catalogue is not fetched in tests (tests that need it route it themselves).
  await ctx.route(/raw\.githubusercontent\.com\/rawsushies\/hm-training-plan\/data-shoes\//, r => r.fulfill({ status: 404, body: "" }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR|WebChannelConnection|Could not reach Cloud Firestore|GrpcConnection/.test(m.text())) page.errors.push(m.text()); });
  return { ctx, page };
}
export async function open(page, extra = "") {
  await page.goto(appUrl(extra));
  await page.waitForFunction(() => window.__hmtpTest || (window.HMTP && document.querySelector("main")), null, { timeout: 15000 });
  await page.waitForFunction(() => window.__hmtpTest, null, { timeout: 15000 });
  await ready(page);
  await finishOnboarding(page);
  await page.evaluate(() => { if (document.querySelector("#tour")) document.querySelector('[data-act="tutClose"]').click(); });
}
/** Wait until the v4 boot screen has finished and is gone (it covers the app while it runs). */
export async function ready(page) {
  await page.waitForFunction(() => window.__bootDone && !document.getElementById("boot"), null, { timeout: 15000 });
}
/** Complete the v4 onboarding sheet the way a user would (skip optional profile, keep default days). */
export async function finishOnboarding(page) {
  if (await page.evaluate(() => typeof M !== "undefined" && !!M && M.kind === "onboard")) {
    if (await page.$('[data-act="obNext"][data-skip="1"]')) await page.click('[data-act="obNext"][data-skip="1"]');
    await page.click('[data-act="obDone"]');
  }
}
export const user = (n) => ({ sub: `sub-${n}`, email: `${n}@example.com`, email_verified: true, name: n[0].toUpperCase() + n.slice(1), picture: "https://example.com/" + n + ".png" });
export async function signIn(page, n) {
  await page.evaluate(tok => window.__hmtpTest.signIn(tok), JSON.stringify(user(n)));
}
export const state = page => page.evaluate(() => { const c = window.__hmtpTest.cloud(); const s = window.__hmtpTest.sync(); return { cloud: c.state, uid: window.__hmtpTest.uid(), pending: s ? s.pendingCount() : null, logs: window.__hmtpTest.S().logs.map(l => l.id), conflicts: s ? s.meta.conflicts.length : 0, migVerified: !!(s && s.meta.migration && s.meta.migration.verified) }; });
export async function waitFor(page, fn, arg, timeout = 15000) { return page.waitForFunction(fn, arg, { timeout, polling: 100 }); }
export const waitSynced = page => waitFor(page, () => { const s = window.__hmtpTest.sync(); return s && s.status.state === "synced" && s.pendingCount() === 0; });
export async function act(page, name, data = {}) {
  await page.evaluate(([name, data]) => { const el = document.createElement("button"); el.dataset.act = name; Object.assign(el.dataset, data); document.body.appendChild(el); el.click(); el.remove(); }, [name, data]);
}
/** "Tanya Kiki" question flows: pick a choice by its value, type a custom answer, or skip. */
export const askPick = (page, v) => page.click(`.ask-q [data-act="askAns"][data-v='${JSON.stringify(v)}']`);
export async function askType(page, text) { await page.fill("#ask-in", String(text)); await page.click('.ask-q [data-act="askCustom"]'); }
export const askSkip = page => page.click('.ask-q [data-act="askSkip"]');
/** Add a run through the real UI form. */
export async function logRun(page, { date, km, dur }) {
  await act(page, "newLog");
  await page.fill("#lg-date", date); await page.dispatchEvent("#lg-date", "change");
  await page.fill("#lg-dist", String(km)); await page.fill("#lg-dur", dur);
  await page.click('[data-act="saveLog"]');
}
/** Read a user's documents straight from the emulator, bypassing rules (admin view). */
export async function adminDocs(path) {
  const r = await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}?pageSize=300`, { headers: { Authorization: "Bearer owner" } });
  const j = await r.json(); return j.documents || [];
}
