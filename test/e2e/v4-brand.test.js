// WeRunIt v4 milestone 1: brand, boot sequence, sign-in gate, dock pill, reduced motion.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });
const booted = page => page.waitForFunction(() => window.__bootDone, null, { timeout: 15000 });

test("brand: WeRunIt everywhere a user sees the name; storage keys unchanged", async () => {
  const { page } = await H.device({ cloud: false });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await booted(page);
  assert.equal(await page.title(), "WeRunIt");
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  assert.equal(m.name, "WeRunIt"); assert.equal(m.short_name, "WeRunIt");
  assert.match(readFileSync("android/app/src/main/res/values/strings.xml", "utf8"), /<string name="app_name">WeRunIt<\/string>[\s\S]*com\.hmtrainingplan\.app/);
  assert.equal(JSON.parse(readFileSync("capacitor.config.json", "utf8")).appId, "com.hmtrainingplan.app", "package id must not change");
  assert.ok(await page.evaluate(() => !document.body.innerText.includes("Half Marathon Training Plan")));
  assert.ok(await page.evaluate(() => !!localStorage.getItem("hmtp:anon:v3")), "storage keys are not renamed");
});

test("boot: real steps complete, then the overlay leaves", async () => {
  const { page } = await H.device({ cloud: false });
  await page.goto(H.appUrl().replace("?emulator=1", ""));
  await booted(page);
  const steps = await page.evaluate(() => [...document.querySelectorAll("#boot-steps li")].map(li => li.className + ":" + li.textContent.trim()));
  assert.equal(steps.length, 4);
  assert.ok(steps.every(s => /^(ok|skip):/.test(s)), steps.join(" | "));
  assert.match(steps[2], /mode lokal/);
  await page.waitForFunction(() => !document.getElementById("boot"), null, { timeout: 5000 });
  assert.deepEqual(page.errors, []);
});

test("gate: a new signed-out user must sign in first; then one onboarding screen and the dashboard (no auto tour)", async () => {
  const { page } = await H.device({ gate: true });
  await page.goto(H.appUrl()); await booted(page);
  assert.ok(await page.isVisible(".gate [data-act='signIn']"));
  assert.equal(await page.$("#tour"), null, "no tutorial before sign-in");
  assert.equal(await page.$(".gate [data-act='gateLocal']"), null, "new online users get no anonymous bypass");
  assert.ok(await page.evaluate(() => document.getElementById("dock").hidden), "no app navigation behind the gate");
  await H.signIn(page, "nina");
  await H.waitFor(page, () => window.__hmtpTest.uid() && typeof M !== "undefined" && M && M.kind === "onboard");   // onboarding first, then the tutorial
  await H.finishOnboarding(page);
  await page.waitForSelector('[data-tour="hero"]');
  assert.equal(await page.$("#tour"), null);
  assert.equal(await page.evaluate(() => document.getElementById("dock").hidden), false);
});

test("gate: offline the user can continue; existing device data no longer bypasses Google", async () => {
  const off = await H.device({ gate: true });
  await off.page.goto(H.appUrl()); await booted(off.page);
  await off.ctx.setOffline(true); await off.page.evaluate(() => render(false));
  await off.page.click(".gate [data-act='gateLocal']");
  await H.finishOnboarding(off.page);
  await off.page.waitForSelector('[data-tour="hero"]');
  assert.equal(await off.page.$(".gate"), null);
  await off.ctx.setOffline(false);
  const legacy = { "hmtp:v1": { v: 2, settings: {}, logs: [{ id: "a", date: "2026-11-10", type: "easy", distance: 5, duration: 1800 }], ui: { tourDone: true, tourV: 2 } } };
  const old = await H.device({ gate: true, seed: legacy });
  await old.page.goto(H.appUrl()); await booted(old.page);
  assert.match(await old.page.textContent(".gate"), /1 lari di perangkat ini/);
  assert.equal(await old.page.$(".gate [data-act='gateLocal']"), null, "Google sign-in is required online");
  assert.ok(await old.page.isVisible(".gate [data-act='signIn']"));
  assert.match(await old.page.textContent(".gate"), /Health Connect[\s\S]*Android/, "Health Connect step shown, Android-only on the web");
  assert.equal(await old.page.evaluate(() => S.logs.length), 1, "existing data intact");
});

test("gate: on the Android app Health Connect is the required second link", async () => {
  const { page } = await H.device({ cloud: false });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await H.ready(page);
  await page.evaluate(() => {
    CLOUD.state = "signedout"; M = null; S.ui.tut = null;
    INTEG.env = () => ({ native: true, plugins: { Health: true } });
    INTEG.plugin = () => ({ isAvailable: async () => ({ available: true }), requestAuthorization: async () => ({ readAuthorized: ["workouts", "distance"] }) });
    render(false);
  });
  assert.ok(await page.isVisible(".gate [data-act='gateHc']"), "Health Connect step blocks the app");
  assert.ok(await page.evaluate(() => document.getElementById("dock").hidden));
  await page.click(".gate [data-act='gateHc']");
  await page.waitForFunction(() => !document.querySelector(".gate"));
  assert.equal(await page.evaluate(() => DEVICE.hc), "ok");
  // a phone without Health Connect (e.g. Huawei) can skip the step
  await page.evaluate(() => { DEVICE.hc = null; M = null; S.ui.tut = null; render(false); });
  await page.click(".gate [data-act='gateHcSkip']");
  await page.waitForFunction(() => !document.querySelector(".gate"));
  assert.equal(await page.evaluate(() => DEVICE.hc), "skip");
});

test("dock: three destinations (Hari ini, Coach, Plan), solid; sub-pages light their parent; settings keeps the bar; old routes redirect", async () => {
  const { page } = await H.device({ cloud: false });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await H.ready(page); await H.finishOnboarding(page);
  assert.deepEqual(await page.$$eval("#dock button span", e => e.map(x => x.textContent)), ["Hari ini", "Coach", "Plan"]);
  assert.equal(await page.$eval("#dock", e => getComputedStyle(e).backdropFilter), "none", "no glass");
  for (const [t, parent] of [["log", "log"], ["race", "race"], ["cal", "race"], ["jadwal", "race"], ["coach", "log"], ["plan", "race"], ["lab", "log"], ["shoes", null], ["integ", null]]) {
    await H.act(page, "nav", { t });
    if (parent) assert.equal(await page.getAttribute(`#dock [data-t="${parent}"]`, "aria-current"), "page", t);
    else assert.equal(await page.evaluate(() => S.ui.tab), "more", t + " → Pengaturan");
  }
  assert.equal(await page.evaluate(() => document.getElementById("dock").hidden), false, "bar stays on Pengaturan");
  assert.deepEqual(page.errors, []);
});

test("reduced motion: pill snaps, content is visible without animation", async () => {
  const { page, ctx } = await H.device({ cloud: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await H.ready(page); await H.finishOnboarding(page);
  await page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  await page.click('#dock [data-t="log"]');
  await page.waitForTimeout(16);
  const g = await page.evaluate(() => { const e = document.querySelector("#dock .glass-pill"); return { w: parseFloat(e.style.width), blur: parseFloat(e.style.getPropertyValue("--blur")) }; });
  assert.ok(g.blur < 1.6, "no in-flight frost under reduced motion");
  await H.act(page, "nav", { t: "home" });
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter(e => getComputedStyle(e).opacity === "0").length);
  assert.equal(hidden, 0);
});
