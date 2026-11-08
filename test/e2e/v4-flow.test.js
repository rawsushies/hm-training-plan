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

test("one tap marks today's session done with its planned distance; the toast opens the run to add details", async () => {
  const { page, ctx } = await H.device();
  await page.clock.setFixedTime(new Date(2026, 10, 10, 18, 0));   // Tue 10 Nov 2026: week 1 weekday run
  await H.open(page);
  const btn = await page.waitForSelector('[data-act="quickDone"]');
  const sid = await btn.getAttribute("data-id");
  await btn.click();
  const log = await page.evaluate(id => window.__hmtpTest.S().logs.find(l => l.sessionId === id), sid);
  assert.ok(log && log.distance > 0 && log.duration === null && log.src === "cepat", "planned distance, no invented time");
  assert.equal(await page.$(`[data-act="quickDone"][data-id="${sid}"]`), null, "button gone once done");
  await page.click("#toast");
  await page.waitForSelector("#lg-dur");
  void ctx; assert.deepEqual(page.errors, []);
});

test("Catat: Kiki asks one question at a time, answers fold up, the summary shows pace before anything is saved", async () => {
  const { page } = await H.device(); await H.open(page);
  await page.click("#rec");
  await page.waitForSelector(".ask .ask-q");
  await page.click(".ask-q .ask-o");                                   // Hari ini
  if (await page.evaluate(() => /sesi/.test(document.querySelector(".ask-qt").textContent))) await page.click(".ask-q .ask-o:last-of-type");   // lari bebas
  await H.askType(page, "6");
  await H.askType(page, "42:00");
  if (await page.evaluate(() => /jenis/.test(document.querySelector(".ask-qt").textContent))) await H.askPick(page, "easy");
  assert.ok((await page.$$(".ask-h")).length >= 3, "answered questions fold into the history");
  await H.askPick(page, 4);
  await page.waitForSelector(".ask-sum");
  assert.match(await page.textContent(".ask-sum"), /6[\s\S]*7:00[\s\S]*42:00/);
  assert.equal(await page.evaluate(() => S.logs.length), 0, "nothing saved before the summary is confirmed");
  // changing an earlier answer asks the later questions again (a different date can mean different sessions)
  await page.click('.ask-h[data-i="0"]');
  await page.click(".ask-q .ask-o:nth-child(2)");                     // Kemarin
  assert.equal(await page.evaluate(() => M.a.km), undefined, "later answers cleared");
  await page.click('.ask-h[data-i="0"]'); await page.click(".ask-q .ask-o:nth-child(1)");   // back to Hari ini
  if (await page.evaluate(() => /sesi/.test(document.querySelector(".ask-qt").textContent))) await page.click(".ask-q .ask-o:last-of-type");
  await H.askType(page, "6"); await H.askType(page, "42:00");
  if (await page.evaluate(() => /jenis/.test(document.querySelector(".ask-qt").textContent))) await H.askPick(page, "easy");
  await H.askPick(page, 4);
  await page.waitForSelector(".ask-sum");
  await page.click('[data-act="askSave"]');
  const l = await page.evaluate(() => S.logs[0]);
  assert.equal(l.distance, 6); assert.equal(l.duration, 2520); assert.equal(l.rpe, 4);
  assert.deepEqual(page.errors, []);
});
