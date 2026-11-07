// WeRunIt v4 milestone 2: onboarding, flexible schedule, race events + replanning, race workspace.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
const local = () => H.appUrl().replace("?emulator=1", "");
async function fresh(seed) {
  const d = await H.device({ cloud: false, seed });
  await d.page.goto(local()); await H.ready(d.page);
  return d;
}

test("onboarding: one screen (availability + folded optional profile), then the dashboard without a tour", async () => {
  const { page } = await fresh();
  assert.equal(await page.evaluate(() => M && M.kind), "onboard");
  assert.equal(await page.$("#tour"), null, "tutorial waits for onboarding");
  await page.click('[data-act="schDay"][data-d="2"]');      // add Wednesday
  await page.click('[data-act="obDone"]');
  await page.waitForSelector('[data-tour="hero"]');
  assert.equal(await page.$("#tour"), null);
  const st = await page.evaluate(() => ({ onb: S.profile.onboarded, avail: S.schedule.avail }));
  assert.equal(st.onb, true); assert.deepEqual(st.avail, [false, true, true, false, false, true, true]);
  assert.deepEqual(page.errors, []);
});

test("existing users are not onboarded and keep their exact v3 days", async () => {
  const v3 = { "hmtp:v1": { v: 2, settings: { weekday: 3 }, logs: [{ id: "a", date: "2026-11-12", type: "easy", sessionId: "w1-wd", distance: 4, duration: 1800 }], ui: { tourDone: true, tourV: 2 } } };
  const { page } = await fresh(v3);
  assert.notEqual(await page.evaluate(() => M && M.kind), "onboard");
  const d = await page.evaluate(() => PLANW[0].sessions.map(s => s.id + "@" + s.date));
  assert.deepEqual(d, ["w1-wd@2026-11-12", "w1-sat@2026-11-14", "w1-sun@2026-11-15"]);
  assert.equal(await page.evaluate(() => S.schedule), null);
});

test("schedule change moves sessions to available days; ids, prescriptions and run links are preserved", async () => {
  const v3 = { "hmtp:v1": { v: 2, settings: { weekday: 1 }, logs: [{ id: "a", date: "2026-11-10", type: "easy", sessionId: "w1-wd", distance: 4, duration: 1800 }], ui: { tourDone: true, tourV: 2 } } };
  const { page } = await fresh(v3);
  const before = await page.evaluate(() => PLANW.slice(0, 31).map(w => w.sessions.map(s => [s.id, s.type, s.pdist ?? s.dist, s.title])));
  await H.act(page, "nav", { t: "jadwal" });
  for (const d of ["1", "6"]) await page.click(`[data-act="schDay"][data-d="${d}"]`);       // remove Tue, Sun
  for (const d of ["0", "3"]) await page.click(`[data-act="schDay"][data-d="${d}"]`);       // add Mon, Thu
  await page.selectOption("#sch-long", "5"); await page.selectOption("#sch-q", "3");
  await page.click('[data-act="schSave"]');
  const after = await page.evaluate(() => PLANW.slice(0, 31).map(w => w.sessions.map(s => [s.id, s.type, s.pdist ?? s.dist, s.title])));
  assert.deepEqual(after, before, "same sessions, same prescriptions");
  const w2 = await page.evaluate(() => PLANW[1].sessions.map(s => [s.slot, (parseYmd(s.date).getDay() + 6) % 7]));
  assert.deepEqual(Object.fromEntries(w2), { wd: 3, sat: 5, sun: 0 }, "quality Thu, long Sat, recovery on the remaining day");
  assert.equal(await page.evaluate(() => sState(sessById("w1-wd"))), "done", "old run still completes its session");
  await page.click('[data-act="schLegacy"]');
  assert.deepEqual(await page.evaluate(() => PLANW[1].sessions.map(s => s.date)), ["2026-11-17", "2026-11-21", "2026-11-22"]);
});

test("race target change: preview, confirm, completed history intact, race strategy follows the new race", async () => {
  const { page, ctx } = await H.device({ cloud: false });
  await page.clock.install({ time: new Date("2027-01-20T09:00:00") });
  await page.goto(local()); await H.ready(page);
  await page.evaluate(() => { M = null; S.profile.onboarded = true; S.logs = [{ id: "x", date: "2027-01-12", type: "easy", sessionId: "w10-wd", distance: 5, duration: 2000, elev: null, hrAvg: null, hrMax: null, rpe: 4, weather: "", notes: "" }]; persist(); render(false); });
  await H.act(page, "nav", { t: "race" });
  await H.act(page, "evNew");
  await page.fill("#ev-name", "Bandung 10K"); await page.fill("#ev-date", "2027-05-02"); await page.selectOption("#ev-dist", "10"); await page.fill("#ev-target", "1:02:00");
  await H.act(page, "evSave");
  const id = await page.evaluate(() => Object.keys(S.events).find(k => k.startsWith("bandung")));
  await H.act(page, "evPick", { id });
  assert.match(await page.textContent(".sheet"), /Susun ulang sisa jadwal/);
  assert.equal(await page.evaluate(() => S.settings.activeEvent), undefined, "nothing changes before confirmation");
  await page.click('[data-act="replanOk"]');
  const r = await page.evaluate(() => ({ n: PLANW.length, race: allSessions().find(s => s.type === "race"), w10: PLANW[9].sessions[0].id, done: sState(sessById("w10-wd")), goal: S.settings.goalTime }));
  assert.equal(r.race.date, "2027-05-02"); assert.equal(r.race.dist, 10); assert.match(r.race.title, /Bandung 10K/);
  assert.equal(r.done, "done", "completed session still linked to its run");
  assert.equal(r.goal, "1:02:00");
  const P = await page.evaluate(() => { const p = racePlanData(); return { D: p.D, T: p.T, last: p.rows[p.rows.length - 1].cum, n: p.rows.length }; });
  assert.equal(P.D, 10); assert.equal(P.n, 10); assert.ok(Math.abs(P.last - 3720) < 1e-6, "splits add up to the new target");
  // cancelling the active race keeps history and asks for another race
  await H.act(page, "evEdit", { id }); await page.selectOption("#ev-status", "cancelled"); await H.act(page, "evSave");
  await H.act(page, "closeM");
  assert.match(await page.textContent(".hero-card"), /Pilih race lain/);
  assert.equal(await page.evaluate(() => S.logs.length), 1);
  assert.deepEqual(page.errors, []);
});

test("race workspace: every tab renders, split edit keeps the total, data-free inputs say what is missing", async () => {
  const { page } = await fresh();
  await page.evaluate(() => { M = null; S.profile.onboarded = true; persist(); });
  await H.act(page, "nav", { t: "race" });
  for (const t of ["overview", "pace", "splits", "elev", "hydration", "fuel", "hr", "stations", "checklist"]) {
    await H.act(page, "raceTab", { t });
    assert.ok(await page.$('[data-tour="race-body"] .card, [data-tour="race-body"] .sec'), t);
  }
  await H.act(page, "raceTab", { t: "hydration" });
  assert.match(await page.textContent('[data-tour="race-body"]'), /Belum ada sweat rate/);
  await H.act(page, "raceTab", { t: "hr" });
  assert.match(await page.textContent('[data-tour="race-body"]'), /HR maksimal yang benar-benar pernah kamu ukur/);
  await H.act(page, "raceTab", { t: "splits" });
  await page.fill('.pace-in[data-i="0"]', "11:30"); await page.dispatchEvent('.pace-in[data-i="0"]', "change");
  await page.waitForTimeout(900);
  const tot = await page.evaluate(() => { const p = racePlanData(); return [p.rows[p.rows.length - 1].cum, p.T, p.rp.locked]; });
  assert.ok(Math.abs(tot[0] - tot[1]) < 1e-6); assert.deepEqual(tot[2], [0]);
  await H.act(page, "raceTabsCfg"); await page.click('[data-act="rtHide"][data-t="hr"]');
  await H.act(page, "closeM");
  assert.equal(await page.$('#rtabs [data-t="hr"]'), null, "hidden tab not shown");
  await H.act(page, "raceSheet");
  assert.match(await page.textContent("#race-sheet"), /Target 3:30:00/);
  assert.deepEqual(page.errors, []);
});
