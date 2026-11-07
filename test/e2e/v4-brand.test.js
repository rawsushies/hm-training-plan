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

test("gate: a new signed-out user must sign in before the tutorial; then the quick start begins", async () => {
  const { page } = await H.device({ gate: true });
  await page.goto(H.appUrl()); await booted(page);
  assert.ok(await page.isVisible(".gate [data-act='signIn']"));
  assert.equal(await page.$("#tour"), null, "no tutorial before sign-in");
  assert.equal(await page.$(".gate [data-act='gateLocal']"), null, "new online users get no anonymous bypass");
  assert.ok(await page.evaluate(() => document.getElementById("dock").hidden), "no app navigation behind the gate");
  await H.signIn(page, "nina");
  await H.waitFor(page, () => window.__hmtpTest.uid() && document.querySelector("#tour"));
  assert.match(await page.textContent("#tour"), /Langkah 1 dari/);
  assert.equal(await page.evaluate(() => document.getElementById("dock").hidden), false);
});

test("gate: offline, or with existing device data, the user can continue without an account", async () => {
  const off = await H.device({ gate: true });
  await off.page.goto(H.appUrl()); await booted(off.page);
  await off.ctx.setOffline(true); await off.page.evaluate(() => render(false));
  await off.page.click(".gate [data-act='gateLocal']");
  await off.page.waitForSelector("#tour");
  assert.equal(await off.page.$(".gate"), null);
  await off.ctx.setOffline(false);
  const legacy = { "hmtp:v1": { v: 2, settings: {}, logs: [{ id: "a", date: "2026-11-10", type: "easy", distance: 5, duration: 1800 }], ui: { tourDone: true, tourV: 2 } } };
  const old = await H.device({ gate: true, seed: legacy });
  await old.page.goto(H.appUrl()); await booted(old.page);
  assert.match(await old.page.textContent(".gate"), /Ada data latihan di perangkat ini/);
  await old.page.click(".gate [data-act='gateLocal']");
  await old.page.waitForSelector(".cockpit");
  assert.equal(await old.page.evaluate(() => S.logs.length), 1, "existing data intact");
});

test("dock: the glass pill moves only on a real tab tap, stretches in flight, settles; every page reachable", async () => {
  const { page } = await H.device({ cloud: false });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await booted(page);
  await page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  const pill = () => page.evaluate(() => { const e = document.querySelector("#dock .glass-pill"); return { t: e.style.transform, w: parseFloat(e.style.width), blur: parseFloat(e.style.getPropertyValue("--blur")) }; });
  const a = await pill(); await page.waitForTimeout(1500);
  assert.deepEqual(await pill(), a, "no automatic movement");
  await page.click('#dock [data-t="race"]');
  await page.waitForTimeout(70);
  const mid = await pill();
  assert.ok(mid.w > a.w + 20, `stretched in flight (${a.w} → ${mid.w})`); assert.ok(mid.blur > 2, "frosted while moving");
  await page.waitForTimeout(1200);
  const rest = await pill();
  assert.ok(Math.abs(rest.w - a.w) < 2 && rest.blur < 1.7, "settled clear at the new tab");
  assert.equal(await page.getAttribute('#dock [data-t="race"]', "aria-current"), "page");
  // sub-pages light their parent tab; every page reachable
  for (const [t, parent] of [["locked", "cal"], ["review", "log"], ["shoes", "log"], ["pace", "race"], ["settings", "more"], ["bareng", "more"]]) {
    await H.act(page, "nav", { t });
    assert.equal(await page.getAttribute(`#dock [data-t="${parent}"]`, "aria-current"), "page", t);
  }
  assert.deepEqual(page.errors, []);
});

test("reduced motion: pill snaps, content is visible without animation", async () => {
  const { page, ctx } = await H.device({ cloud: false });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await booted(page);
  await page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  await page.click('#dock [data-t="log"]');
  await page.waitForTimeout(16);
  const g = await page.evaluate(() => { const e = document.querySelector("#dock .glass-pill"); return { w: parseFloat(e.style.width), blur: parseFloat(e.style.getPropertyValue("--blur")) }; });
  assert.ok(g.blur < 1.6, "no in-flight frost under reduced motion");
  await H.act(page, "nav", { t: "home" });
  const hidden = await page.evaluate(() => [...document.querySelectorAll("[data-reveal]")].filter(e => getComputedStyle(e).opacity === "0").length);
  assert.equal(hidden, 0);
});
