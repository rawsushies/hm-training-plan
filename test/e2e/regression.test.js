// Regression tests for the original v2 training modules. Runs without Firebase (local mode).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

const LEGACY = readFileSync("legacy/hm-training-plan.claude.html", "utf8");
before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });

const local = () => H.appUrl().replace("?emulator=1", "");
async function fresh(viewport) {
  const d = await H.device({ cloud: false, viewport });
  await d.page.goto(local());
  await H.ready(d.page);
  await H.finishOnboarding(d.page);
  await d.page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  return d;
}

// The same sample state is fed to the original file and the new build; their calculations must match.
const SAMPLE = {
  settings: { weekday: 1, unit: "km", startDate: "2026-11-09", raceDate: "2027-06-13", goalTime: "3:30:00", benchKm: 3, lockedRpe: "6–7", theme: "dark", wdTime: "19:30", wkTime: "06:00" },
  logs: [
    { id: "a1", date: "2026-11-10", type: "easy", sessionId: "w1-wd", distance: 4, duration: 1880, rpe: 4, elev: 10 },
    { id: "a2", date: "2026-11-14", type: "long", sessionId: "w1-sat", distance: 6, duration: 3010, elev: 25 },
    { id: "a3", date: "2026-11-15", type: "recovery", sessionId: "w1-sun", distance: 3, duration: 1620 },
    { id: "a4", date: "2026-11-17", type: "locked", sessionId: "w2-wd", distance: 4, duration: 1810, rpe: 6 },
    { id: "a5", date: "2026-11-21", type: "long", sessionId: "w2-sat", distance: 6.5, duration: 3240 },
    { id: "a6", date: "2026-12-05", type: "elevation", sessionId: "w4-sat", distance: 5, duration: 2900, elev: 140 }
  ],
  strength: [{ id: "s1", date: "2026-11-12", kind: "A", sets: 2, done: ["lunge", "bridge"], sessionId: "w1-sA" }],
  checkins: [{ date: "2026-11-14", sleep: 4, soreness: 2, fatigue: 2, energy: 4, motivation: 4, pain: 1 }, { date: "2026-11-15", sleep: 2, soreness: 4, fatigue: 4, energy: 2, motivation: 3, pain: 3 }],
  overrides: { "w3-sat": { dist: 7.5 }, "w5-wd": { date: "2026-12-11" } }, status: { "w3-sun": "skip" },
  locked: { "w2-wd": { targetPace: 450 } }, elev: {}, shoes: [], reviews: {}, ui: { tourDone: true, tourV: 2 }
};
const PROBE = () => {
  PLANW = buildPlan();
  return JSON.stringify({
    plan: PLANW.map(w => [w.n, w.start, w.end, w.total, w.planned, w.kind, w.block, w.sessions.map(s => [s.id, s.date, s.dist, s.type, s.title, s.time]), w.strength.map(s => [s.id, s.date])]),
    states: allSessions().slice(0, 15).map(s => sState(s)),
    reviews: [0, 1].map(b => { const r = reviewOf(b); return { imp: r.imp, con: r.con, need: r.need, decision: r.decision, focus: r.focus }; }),
    badges: badgeStats(), goals: S.goals.items.map(g => goalValue(g.id)),
    ready: S.checkins.map(c => readiness(c)), pain: persistentPain(),
    pc: pcOut("5", "35:00").replace(/\s*<p[\s\S]*?<\/p>/g, "").trim(),   // numbers only; the caveat line was cut in 4.0
    pp: ppOut("7:30", "15"), rp: rpOut("3:20:00", "pelan"), rp2: rpOut("2:59:59", "rata"),
    csv: csvOf().split("\n").slice(0, 4)
  });
};

test("the new build computes the same plan, states, reviews, badges, goals and pace numbers as the original", async () => {
  const ctx = await (await import("playwright")).chromium.launch().then(b => b.newContext());
  await ctx.addInitScript(() => { window.HMTP_FIREBASE_CONFIG = null; });
  const page = await ctx.newPage();
  await page.route("**/__legacy.html", r => r.fulfill({ body: LEGACY, contentType: "text/html" }));
  const run = async (url, key) => {
    await page.goto(url.replace(/\/\?.*$/, "/") + "__blank__");
    await page.goto(url);
    await page.evaluate(([key, s]) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(s)); }, [key, SAMPLE]);
    await page.goto(url);
    await page.waitForFunction(() => typeof buildPlan === "function");
    return page.evaluate(PROBE);
  };
  await page.clock.setFixedTime(new Date("2026-12-20T10:00:00"));
  const base = local().replace(/\?.*$/, "");
  const old = await run(base + "__legacy.html", "hmtp:v1");
  const now = await run(base, "hmtp:anon:v3");
  const a = JSON.parse(old), b = JSON.parse(now);
  for (const k of Object.keys(a)) assert.deepEqual(b[k], a[k], `mismatch in ${k}`);
  await ctx.browser().close();
});

test("timer: start, pause, resume, next step, finish opens the log form with the time filled", async () => {
  const { page } = await fresh();
  await page.clock.install({ time: new Date("2026-11-17T19:00:00") });
  await page.reload(); await H.ready(page); await page.evaluate(() => document.querySelector('[data-act="tutClose"]')?.click());
  await H.act(page, "runStart", { id: "w2-wd" });             // locked-in interval week 2
  await page.waitForSelector(".runmode");
  assert.match(await page.textContent(".runmode"), /Bagian 1 dari 9[\s\S]*Warm-up/);
  await page.clock.runFor(5000);
  await page.click('[data-act="runPause"]'); assert.match(await page.textContent(".runmode"), /dijeda/);
  await page.clock.runFor(60000);
  await page.click('[data-act="runPause"]');
  await page.click('[data-act="runNext"]');
  assert.match(await page.textContent(".runmode"), /Lari 1 dari 4/);
  await page.clock.runFor(30000);
  await page.click('[data-act="runFinish"]');
  await page.waitForSelector("#lg-dur");
  assert.match(await page.inputValue("#lg-dur"), /^0:3[4-6]$/, "35 s of active time (the 60 s pause is excluded)");
  assert.equal(await page.inputValue("#lg-sess"), "w2-wd");
  await page.click('[data-act="saveLog"]');
  assert.equal(await page.evaluate(() => S.logs[0].sessionId), "w2-wd");
  // cancel path
  await H.act(page, "runStart", { id: "w2-sat" }); await page.click('[data-act="runCancel"]');
  assert.equal(await page.evaluate(() => S.ui.run), null);
  assert.deepEqual(page.errors, []);
});

test("calendar: skip/unskip, edit session, reschedule blocks Wednesday, reset to plan", async () => {
  const { page } = await fresh();
  await H.act(page, "skip", { id: "w1-sun" });
  assert.equal(await page.evaluate(() => S.status["w1-sun"]), "skip");
  await H.act(page, "unskip", { id: "w1-sun" });
  assert.equal(await page.evaluate(() => S.status["w1-sun"]), undefined);
  await H.act(page, "editSess", { id: "w1-sat" });
  await page.fill("#ed-dist", "6,5"); await page.fill("#ed-title", "Long run pelan"); await page.click('[data-act="saveEdit"]');
  assert.deepEqual(await page.evaluate(() => [sessById("w1-sat").dist, sessById("w1-sat").title, PLANW[0].total]), [6.5, "Long run pelan", 13]);
  await H.act(page, "resched", { id: "w1-sat" });
  await page.fill("#rs-date", "2026-11-11"); await page.dispatchEvent("#rs-date", "change");
  assert.match(await page.textContent("#rs-msg"), /Rabu/);
  await page.click('[data-act="saveResched"]');
  assert.equal(await page.evaluate(() => sessById("w1-sat").date), "2026-11-14", "Wednesday refused");
  await page.fill("#rs-date", "2026-11-13"); await page.click('[data-act="saveResched"]');
  assert.equal(await page.evaluate(() => sessById("w1-sat").date), "2026-11-13");
  await H.act(page, "editSess", { id: "w1-sat" }); await page.click('[data-act="resetEdit"]');
  assert.equal(await page.evaluate(() => sessById("w1-sat").dist), 6);
});

test("strength, check-in, goals, shoes, locked-in target, elevation target, review notes, settings", async () => {
  const { page } = await fresh();
  await H.act(page, "startStr", { id: "w1-sA" });
  await page.click('[data-act="strTick"][data-k="lunge"]'); await page.click('[data-act="strTick"][data-k="squat"]');
  await page.click('[data-act="strSave"]');
  assert.deepEqual(await page.evaluate(() => [S.strength.length, S.strength[0].sessionId, S.strength[0].done.length]), [1, "w1-sA", 2]);
  await H.act(page, "nav", { t: "recovery" });
  await page.click('[data-act="ciRate"][data-k="pain"][data-v="4"]');
  assert.match(await page.textContent('[data-tour="ci-result"]'), /Mending istirahat/);
  await page.click('[data-act="ciSave"]');
  assert.equal(await page.evaluate(() => S.checkins.length), 1);
  await H.act(page, "goalEdit", { id: "longrun" }); await page.fill("#gl-target", "18"); await page.click('[data-act="saveGoal"]');
  assert.equal(await page.evaluate(() => S.goals.items.find(x => x.id === "longrun").target), 18);
  await H.act(page, "shoeNew"); await page.fill("#sh-name", "Biru"); await page.click('[data-act="saveShoe"]');
  const shoeId = await page.evaluate(() => S.shoes[0].id);
  assert.equal(await page.evaluate(() => S.settings.defaultShoe), shoeId);
  await H.act(page, "lockCfg", { id: "w2-wd" }); await page.fill("#lc-pace", "7:30"); await page.click('[data-act="saveLockCfg"]');
  assert.equal(await page.evaluate(() => lockedCfg("w2-wd", 2, "locked").targetPace), 450);
  await H.act(page, "applyPace", { id: "w2-wd" });
  assert.equal(await page.evaluate(() => lockedCfg("w6-wd", 6, "locked").targetPace), 450);
  await H.act(page, "elevCfg", { id: "w3-sat" }); await page.fill("#ev-t", "120"); await page.click('[data-act="saveElevCfg"]');
  assert.equal(await page.evaluate(() => S.elev["w3-sat"].target), 120);
  await H.act(page, "nav", { t: "review" }); await page.fill("#rv-best", "Rutin!"); await page.click('[data-act="saveReview"]');
  assert.equal(await page.evaluate(() => S.reviews[S.ui.revBlock ?? PLANW[curWeekIdx()].block].best), "Rutin!");
  await H.act(page, "nav", { t: "settings" });
  await page.selectOption("#st-wd", "3"); await page.fill("#st-goal", "3:15:00"); await page.click('[data-act="saveSettings"]');
  assert.deepEqual(await page.evaluate(() => [S.settings.weekday, S.settings.goalTime, sessById("w1-wd").date]), [3, "3:15:00", "2026-11-12"]);
  assert.deepEqual(page.errors, []);
});

test("activity import: GPX parsed, matched to the plan, duplicate (same file twice) detected", async () => {
  const { page } = await fresh();
  const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Pagi</name><type>running</type><trkseg>
    <trkpt lat="-6.2000" lon="106.8000"><ele>10</ele><time>2026-11-10T12:00:00Z</time></trkpt>
    <trkpt lat="-6.2100" lon="106.8000"><ele>20</ele><time>2026-11-10T12:07:00Z</time></trkpt>
    <trkpt lat="-6.2200" lon="106.8000"><ele>12</ele><time>2026-11-10T12:14:00Z</time></trkpt></trkseg></trk></gpx>`;
  await H.act(page, "nav", { t: "log" });
  await page.setInputFiles("#act-file", { name: "run.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpx) });
  await page.waitForSelector('[data-act="impSave"]');
  assert.match(await page.textContent(".sheet"), /Cocok: W1/);
  await page.click('[data-act="impSave"]');
  const l = await page.evaluate(() => S.logs[0]);
  assert.equal(l.sessionId, "w1-wd"); assert.ok(l.distance > 2.1 && l.distance < 2.3); assert.equal(l.duration, 840); assert.equal(l.elev, 10); assert.match(l.extId, /^t:2026-11-10T12:00/);
  await page.setInputFiles("#act-file", { name: "run.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpx) });
  await page.waitForSelector('[data-act="impSave"]');
  assert.match(await page.textContent(".sheet"), /Udah ada/);
  assert.ok(await page.isDisabled('[data-act="impSave"]'), "duplicate is unselected");
});

test("data: export JSON/CSV, merge-import is safe and idempotent, replace-import backs up first, sample data, reset", async () => {
  const { page } = await fresh();
  await H.logRun(page, { date: "2026-11-10", km: 4, dur: "30:00" });
  await H.act(page, "nav", { t: "data" });
  await page.click('[data-act="exportJson"]');
  await page.waitForSelector("#tx-out");
  const backup = await page.inputValue("#tx-out");
  assert.equal(JSON.parse(backup).logs.length, 1);
  await H.act(page, "closeM");
  await page.click('[data-act="exportCsv"]'); await page.waitForSelector("#tx-out");
  assert.match(await page.inputValue("#tx-out"), /^date,type,session,distance_km/);
  await H.act(page, "closeM");
  // merge the same backup twice: nothing duplicated
  for (let i = 0; i < 2; i++) {
    await page.fill("#imp-text", backup); await page.click('[data-act="importMerge"]');
    await page.waitForSelector(".sheet"); assert.match(await page.textContent(".sheet"), /Lari: 0 ditambah, 1 duplikat/);
    await H.act(page, "closeM");
  }
  assert.equal(await page.evaluate(() => S.logs.length), 1);
  // replace-all with an older (v2) style backup
  const v2 = JSON.stringify({ v: 2, settings: { weekday: 1 }, logs: [{ id: "x1", date: "2026-11-14", type: "long", distance: 6, duration: 3000 }, { id: "x2", date: "2026-11-15", type: "recovery", distance: 3 }] });
  await page.fill("#imp-text", v2); await page.click('[data-act="importText"]'); await page.click('[data-act="doImport"]');
  assert.equal(await page.evaluate(() => S.logs.length), 2);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith("hmtp:backup:"))));
  await page.click('[data-act="loadSample"]');
  assert.ok(await page.evaluate(() => S.logs.some(l => l.sample)));
  await page.click('[data-act="clearSample"]');
  assert.ok(await page.evaluate(() => !S.logs.some(l => l.sample)));
  await page.click('[data-act="askReset"]'); await page.click('[data-act="doReset"]');
  assert.equal(await page.evaluate(() => S.logs.length), 0);
  assert.deepEqual(page.errors, []);
});

test("hostile backup content is neutralised (no script/attribute injection)", async () => {
  const { page } = await fresh();
  const evil = JSON.stringify({ v: 2, settings: {}, logs: [{ id: '"><img src=x onerror=window.__pwned=1>', date: "2026-11-10", type: 'easy" style="x', distance: 3 }], checkins: [{ date: "<b>", sleep: 1, soreness: 1, fatigue: 1, energy: 1, motivation: 1, pain: 1 }] });
  await H.act(page, "nav", { t: "data" });
  await page.fill("#imp-text", evil); await page.click('[data-act="importText"]'); await page.click('[data-act="doImport"]');
  await H.act(page, "nav", { t: "log" }); await H.act(page, "nav", { t: "home" });
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.evaluate(() => document.querySelectorAll("img[src=x]").length), 0);
  assert.equal(await page.evaluate(() => S.checkins.length), 0);
});

test("performance: 700 logged runs still render each main page quickly", async () => {
  const { page } = await fresh();
  const ms = await page.evaluate(() => {
    const types = ["easy", "long", "recovery"];
    for (let i = 0; i < 700; i++) { const d = new Date(2026, 10, 9 + (i % 217)); S.logs.push({ id: "p" + i, date: ymd(d), type: types[i % 3], sessionId: null, distance: 3 + (i % 10), duration: 1500 + i, elev: i % 50, hrAvg: null, hrMax: null, rpe: 4, weather: "", notes: "" }); }
    persist();
    const out = {};
    for (const t of ["home", "cal", "log", "review", "goals", "locked", "elev", "data"]) { const t0 = performance.now(); S.ui.tab = t; render(false); out[t] = Math.round(performance.now() - t0); }
    return out;
  });
  for (const [t, v] of Object.entries(ms)) assert.ok(v < 1500, `${t} took ${v} ms`);
  console.log("render ms with 700 runs:", ms);
});

test("offline startup: after one online visit the app opens with no network (service worker)", async () => {
  const { page, ctx } = await fresh();
  await H.logRun(page, { date: "2026-11-10", km: 5, dur: "35:00" });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector("main");
  assert.equal(await page.evaluate(() => S.logs.length), 1);
  assert.match(await page.textContent("main"), /hari lagi|Race/);
  await ctx.setOffline(false);
});
