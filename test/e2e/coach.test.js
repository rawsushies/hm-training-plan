// Product reset: Coach end to end. Runs are SYNTHETIC and created inside the test; never shown as real history.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

const AI_CLAIM = /AI menemukan|kecerdasan buatan menyimpulkan|diagnos(is|a) kamu|kemungkinan cedera \d|aman untuk lari/i;
/** SYNTHETIC: 20 runs every 2 days up to today; mostly hard RPE; one Strava-origin row that must be ignored. */
const openLocal = async page => { await page.goto(H.appUrl().replace("?emulator=1", "")); await H.ready(page); await H.finishOnboarding(page); };
const seedRuns = page => page.evaluate(() => {
  const d = new Date(); const ymd = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  for (let i = 0; i < 20; i++) { const x = new Date(d); x.setDate(d.getDate() - (19 - i) * 2); S.logs.push({ id: "syn" + i, date: ymd(x), type: "easy", sessionId: null, distance: 6, duration: Math.round(6 * (420 - i * 3)), elev: null, hrAvg: null, hrMax: null, rpe: i % 3 === 0 ? 3 : 7, weather: "", notes: "" }); }
  S.logs.push({ id: "strava1", date: ymd(d), type: "easy", sessionId: null, distance: 30, duration: 9000, src: "Strava", extId: "strava:1", elev: null, hrAvg: null, hrMax: null, rpe: 9, weather: "", notes: "" });
  persist(); render(false);
});

test("Coach with no history: every dimension says what is missing; Today shows no invented insight", async () => {
  const { page } = await H.device({ cloud: false }); await openLocal(page);
  assert.match(await page.textContent('[data-tour="insight"]'), /Belum cukup data/);
  await H.act(page, "nav", { t: "log" });
  const obs = await page.textContent('[data-tour="observations"]');
  assert.match(obs, /Belum cukup data[\s\S]*butuh minimal/i);
  assert.ok(!/Kekuatan\b(?! ·)/.test(await page.$eval('[data-tour="observations"]', e => [...e.querySelectorAll(".c-gh")].map(h => h.textContent).join("|"))), "no strengths without data");
  await page.click('[data-act="coachQ"]');
  assert.match(await page.textContent(".c-ans"), /Belum cukup data/);
  assert.deepEqual(page.errors, []);
});

test("Coach with data: observations show fact → meaning → change → monitor with window, n, coverage; ask answers from evidence; pain gets a safety answer; Strava rows ignored", async () => {
  const { page } = await H.device({ cloud: false }); await openLocal(page);
  await seedRuns(page);
  // Hari ini: one key insight linking to its evidence
  const key = await page.textContent('[data-tour="insight"]');
  assert.match(key, /Perlu diperbaiki|Peluang|Kekuatan/);
  await page.click('[data-tour="insight"] [data-act="coachObs"]');
  assert.equal(await page.evaluate(() => S.ui.tab), "log");
  const open = await page.$("details.c-obs[open]");
  assert.ok(open, "the linked observation is opened");
  const body = await open.textContent();
  assert.match(body, /Artinya[\s\S]*Coba ubah[\s\S]*Pantau/); assert.match(body, /n \d+[\s\S]*keyakinan (tinggi|sedang|rendah)[\s\S]*coach-1/);
  // intensity: 20 runs with RPE, 7 easy → limitation; Strava row (RPE 9, 30 km) never counted
  const intensity = await page.textContent('details[data-obs="intensity"]');
  assert.match(intensity, /Dari 20 lari dengan RPE: santai \(1–4\) 7/);
  assert.ok(!/30 km|21 lari/.test(await page.textContent('[data-tour="observations"]')), "Strava-origin data excluded");
  // ask
  await page.fill("#coach-q", "Apakah lari santaiku terlalu keras?"); await page.keyboard.press("Enter");
  const ans = await page.textContent(".c-ans");
  assert.match(ans, /Distribusi intensitas/); assert.match(ans, /n = 20/); assert.match(ans, /bukan bukti sebab-akibat/);
  assert.ok((await page.$$(".c-ans-act li")).length <= 2, "one or two actions, not a wall");
  await page.click('.c-ans [data-act="coachObs"]');
  assert.ok(await page.$('details[data-obs="intensity"][open]'));
  await page.fill("#coach-q", "Lututku nyeri setelah long run"); await page.click('[data-act="coachAsk"]');
  assert.match(await page.textContent(".c-ans.safety"), /dokter atau fisioterapis/);
  // coverage + what cannot be answered
  const cov = await page.textContent('[data-tour="coverage"]');
  assert.match(cov, /Effort \(RPE\)[\s\S]*20\/20/); assert.match(cov, /Hubungan pace dan detak jantung[\s\S]*HR maks/);
  assert.match(await page.textContent(".c-coach"), /bukan AI/);
  assert.ok(!AI_CLAIM.test(await page.textContent("body")));
  // evidence drill-down opens the underlying run
  await page.click('[data-tour="log-list"] .v5-run');
  await page.waitForSelector("#lg-dur");
  assert.deepEqual(page.errors, []);
});

test("removed Lab UI keeps its data: investigations stay stored, exported and synced; old routes land in Coach; Strava is shown as blocked", async () => {
  const lab = { lab1: { id: "lab1", schema: 1, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", question: "Apakah aku lebih cepat pagi?", type: "environment", typeSource: "auto", matched: [], answers: {}, status: "draft", notes: "catatan" } };
  const { page } = await H.device({ cloud: false, seed: { "hmtp:anon:v3": { v: 3, settings: {}, logs: [], lab, profile: { onboarded: true }, ui: { tab: "lab" } } } });
  await page.goto(H.appUrl().replace("?emulator=1", "")); await H.ready(page);
  assert.equal(await page.evaluate(() => S.ui.tab), "log", "old Lab tab lands in Coach");
  assert.equal(await page.evaluate(() => S.lab.lab1 && S.lab.lab1.notes), "catatan");
  await H.act(page, "nav", { t: "lab" }); assert.equal(await page.evaluate(() => S.ui.tab), "log");
  assert.equal(await page.$("#lab-q"), null, "no investigation UI");
  const recs = await page.evaluate(() => Object.keys(HMTP.stateToRecords(S)).filter(k => k.startsWith("lab/")));
  assert.deepEqual(recs, ["lab/lab1"], "still a synced record");
  await H.act(page, "nav", { t: "more" });
  const src = await page.textContent('[data-tour="sources"]');
  assert.match(src, /Catatan manual[\s\S]*Tersambung/); assert.match(src, /Health Connect[\s\S]*Tidak tersedia di sini/); assert.match(src, /Strava[\s\S]*Diblokir[\s\S]*Kebijakan API Strava/);
  assert.match(await page.textContent(".c-cnt"), /Investigasi Lab \(arsip\)\s*1/);
  assert.deepEqual(page.errors, []);
});
