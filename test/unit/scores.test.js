import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/scores.js";
const S = globalThis.WRI_SCORES;

const run = (date, o = {}) => Object.assign({ id: date + Math.random(), date, type: "easy", distance: 6, duration: 2400, rpe: 3 }, o);
const ci = (date, o = {}) => Object.assign({ date, sleep: 4, soreness: 2, fatigue: 2, energy: 4, motivation: 4, pain: 1 }, o);

test("session load: RPE × minutes halved onto 1–5; HR zones win when HRmax is measured; type default otherwise", () => {
  assert.equal(S.runLoad(run("2027-01-01", { duration: 3600, rpe: 4 })).load, 60 * 2);
  assert.equal(S.runLoad(run("2027-01-01", { duration: 3600, hrAvg: 160, rpe: 4 }), 190).load, 60 * 4);   // 84 %HRmax → zone 4
  const t = S.runLoad({ date: "2027-01-01", type: "long", distance: 10 });
  assert.equal(t.est, true); assert.ok(Math.abs(t.load - 10 * 390 / 60 * 2) < 1e-9);
});

test("Beban: logarithmic 0–100, rest day 0, an easy run sits around the middle, a race-like day is high but rare", () => {
  assert.equal(S.effort(0), 0);
  const easy = S.effort(40 * 1.5), long = S.effort(100 * 2), race = S.effort(140 * 4.5);
  assert.ok(easy > 45 && easy < 60, `easy ${easy}`);
  assert.ok(long > easy && race > long && race < 90, `long ${long} race ${race}`);
  assert.equal(S.effort(480 * 5), 100);
});

test("Banister load state: a sudden big week pushes the acute:chronic ratio above the sweet spot", () => {
  const steady = Array.from({ length: 42 }, (_, i) => ({ load: i % 2 ? 0 : 90 }));
  const s1 = S.loadState(steady);
  assert.equal(S.ratioZone(s1.acwr), "sweet");
  const spike = steady.concat(Array.from({ length: 7 }, () => ({ load: 220 })));
  assert.ok(["high", "danger"].includes(S.ratioZone(S.loadState(spike).acwr)));
});

test("baseline: calibrating → provisional → trusted, and a single wild value cannot drag the centre", () => {
  assert.equal(S.baseline([4, 4, 4]).status, "calibrating");
  assert.equal(S.baseline(Array(6).fill(4)).status, "provisional");
  const b = S.baseline(Array(20).fill(4).concat([1]));
  assert.equal(b.status, "trusted"); assert.ok(b.mean > 3.7, `centre held at ${b.mean}`);
});

test("Siap: better-than-usual wellness → green, worse → red, pain caps it; nothing to go on → null + calibrating", () => {
  const hist = Array.from({ length: 20 }, (_, i) => ci(S.addDays("2027-01-21", -20 + i)));
  const good = S.charge({ date: "2027-01-21", checkins: hist.concat([ci("2027-01-21", { sleep: 5, energy: 5, motivation: 5, soreness: 1, fatigue: 1 })]), logs: [] });
  const bad = S.charge({ date: "2027-01-21", checkins: hist.concat([ci("2027-01-21", { sleep: 2, energy: 2, motivation: 2, soreness: 4, fatigue: 4 })]), logs: [] });
  assert.equal(good.band, "green"); assert.equal(bad.band, "red"); assert.equal(good.tier, "solid");
  const pain = S.charge({ date: "2027-01-21", checkins: hist.concat([ci("2027-01-21", { sleep: 5, energy: 5, pain: 4 })]), logs: [] });
  assert.ok(pain.score <= 30 && pain.drivers.pain);
  const none = S.charge({ date: "2027-01-21", checkins: [], logs: [] });
  assert.equal(none.score, null); assert.equal(none.tier, "calibrating");
});

test("Siap without today's check-in falls back to freshness only and says so (building)", () => {
  const logs = Array.from({ length: 21 }, (_, i) => run(S.addDays("2027-01-20", -i)));
  const c = S.charge({ date: "2027-01-21", checkins: [], logs });
  assert.notEqual(c.score, null); assert.equal(c.tier, "building"); assert.ok("freshness" in c.drivers);
});

test("Tidur: from reported sleep, consistency counts a little; no check-in → nothing", () => {
  const steady = [1, 2, 3, 4, 5, 6].map(i => ci(S.addDays("2027-01-21", -i), { sleep: 4 })).concat([ci("2027-01-21", { sleep: 4 })]);
  const r = S.rest({ date: "2027-01-21", checkins: steady });
  assert.equal(r.score, Math.round(0.85 * 75 + 0.15 * 100)); assert.equal(r.tier, "solid");
  assert.equal(S.rest({ date: "2027-01-21", checkins: [] }).score, null);
});

test("target Beban follows Siap bands", () => {
  assert.deepEqual(S.targetEffort(80), [60, 80]); assert.deepEqual(S.targetEffort(50), [45, 65]); assert.deepEqual(S.targetEffort(20), [0, 40]);
  assert.equal(S.targetEffort(null), null);
});
