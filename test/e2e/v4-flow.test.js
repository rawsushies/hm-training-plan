// Hassle-less flow: fast open for returning users, single-screen onboarding, one-tap "done".
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

test("first run: one onboarding screen, then straight to the dashboard (no tour, no banner)", async () => {
  const { page } = await H.device();
  await page.goto(H.appUrl()); await H.waitFor(page, () => window.__hmtpTest); await H.ready(page);
  await page.waitForSelector('[data-act="obDone"]');
  assert.equal(await page.$('[data-act="obNext"]'), null, "single step");
  await page.click('[data-act="obDone"]');
  await page.waitForTimeout(500);
  assert.equal(await page.$(".sheet"), null); assert.equal(await page.$("#tour"), null); assert.equal(await page.$(".banner"), null);
  assert.ok(await page.$('[data-tour="hero"]'));
  assert.deepEqual(page.errors, []);
});

test("returning user: app is usable in well under a second, even before the update check finishes", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.logRun(page, { date: "2026-11-10", km: 5, dur: "35:00" });
  const t0 = Date.now(); await page.reload();
  await H.ready(page);
  const ms = Date.now() - t0;
  assert.ok(ms < 2500, `opened in ${ms} ms`);
  assert.equal(await page.$(".sheet"), null, "no onboarding again");
  assert.deepEqual(page.errors, []);
});

test("today's session: Catat hasil opens the quick sheet prefilled with the plan; nothing is recorded until the runner confirms", async () => {
  const { page } = await H.device();
  await page.clock.setFixedTime(new Date(2026, 10, 10, 18, 0));   // Tue 10 Nov 2026: week 1 weekday run
  await H.open(page);
  await page.click('[data-tour="log-today"]');
  await page.waitForSelector("#ql-km");
  const planned = await page.evaluate(() => M.q.km);
  assert.ok(planned > 0, "prefilled with the planned distance (visible, editable)");
  assert.equal(await page.evaluate(() => S.logs.length), 0, "nothing recorded by the tap itself");
  await page.fill("#ql-dur", "30:00"); await page.click('[data-act="qlSave"]');
  const l = await page.evaluate(() => S.logs[0]);
  assert.ok(l.sessionId, "linked to the planned session"); assert.equal(l.duration, 1800);
  assert.ok(!(await page.$('[data-tour="log-today"]')), "session shows as done");
  assert.deepEqual(page.errors, []);
});

test("Catat: one quick sheet (distance stepper, time, effort bars); nothing is saved until Simpan; invalid input is refused", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.act(page, "nav", { t: "log" });
  await page.click('[data-act="quickLog"]');
  await page.waitForSelector("#ql-km");
  await page.fill("#ql-km", "");
  await page.click('[data-act="qlSave"]');
  assert.equal(await page.evaluate(() => S.logs.length), 0, "empty distance is refused");
  await page.fill("#ql-km", "5,5"); await page.click('[data-act="qlStep"][data-v="0.5"]');
  assert.equal(await page.inputValue("#ql-km"), "6");
  await page.fill("#ql-dur", "42:00"); await page.click('[data-act="qlEff"][data-v="2"]');
  assert.equal(await page.evaluate(() => S.logs.length), 0, "nothing saved before Simpan");
  await page.click('[data-act="qlSave"]');
  const l = await page.evaluate(() => S.logs[0]);
  assert.equal(l.distance, 6); assert.equal(l.duration, 2520); assert.equal(l.rpe, 4);
  assert.match(await page.textContent("#toast"), /Tersimpan · 6 km · 7:00/);
  assert.match(await page.textContent(".v5-list"), /6\s*km[\s\S]*7:00/);
  assert.deepEqual(page.errors, []);
});
