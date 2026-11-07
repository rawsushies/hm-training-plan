import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/race.js";
const R = globalThis.WRI_RACE;
const now = new Date("2027-03-01T08:00:00");
const L = (id, date, km, sec, type = "easy", x = {}) => Object.assign({ id, date, distance: km, duration: sec, type }, x);
const HM = 21.0975, tot = (p, D) => R.segments(D).reduce((a, s, i) => a + p[i] * s, 0);

test("data selection excludes sample, no-time, short, old, duplicate and outlier runs (and says why)", () => {
  const logs = [L("s", "2027-02-20", 5, 1500, "easy", { sample: true }), L("nt", "2027-02-20", 5, null), L("sh", "2027-02-20", 2, 700), L("old", "2026-06-01", 10, 3600),
    L("a", "2027-02-10", 8, 3600), L("a2", "2027-02-10", 8, 3610), L("b", "2027-02-12", 6, 2700), L("c", "2027-02-14", 7, 3150), L("d", "2027-02-16", 10, 4500), L("bike", "2027-02-18", 30, 3600)];
  const r = R.selectData(logs, { now });
  assert.deepEqual(r.used.map(l => l.id).sort(), ["a", "b", "c", "d"]);
  const why = Object.fromEntries(r.excluded.map(e => [e.log.id, e.reason]));
  assert.match(why.s, /contoh/); assert.match(why.nt, /waktu/); assert.match(why.sh, /3 km/); assert.match(why.old, /hari/); assert.match(why.a2, /duplikat/); assert.match(why.bike, /outlier/);
});

test("prediction: transparent, weighted, with confidence; one fast short run is not proof of HM ability", () => {
  const one = R.predict([L("x", "2027-02-25", 3, 840, "benchmark")], HM, { now });
  assert.equal(one.confidence, "low", "a single 3K + no long runs = low confidence");
  assert.ok(one.limitations.some(t => /Lari terjauh/.test(t)));
  const good = R.predict([L("b1", "2027-02-20", 10, 3300, "benchmark"), L("r1", "2027-02-01", 15, 5200, "race"), L("lr", "2027-02-26", 16, 6200, "long")], HM, { now });
  assert.ok(good.seconds > 7000 && good.seconds < 8000, String(good.seconds));
  assert.ok(["medium", "high"].includes(good.confidence));
  assert.ok(good.used.length === 2 && good.used.every(u => u.estimate > 0 && u.weight > 0), "easy/long runs not used as effort");
  assert.ok(good.sensitivity.low < good.seconds && good.sensitivity.high > good.seconds);
  assert.match(good.method, /Riegel/);
  const none = R.predict([L("e", "2027-02-20", 8, 3600, "easy")], HM, { now, targetSec: 12600 });
  assert.equal(none.source, "target"); assert.equal(none.confidence, "none"); assert.equal(none.seconds, 12600);
  assert.equal(R.predict([L("s", "2027-02-20", 10, 3000, "benchmark", { sample: true })], HM, { now }).source, "none", "sample data never used");
});

test("every strategy sums exactly to the target time", () => {
  for (const kind of ["even", "conservative", "negative", "positive", "elevation", "custom"]) {
    for (const [T, D] of [[12600, HM], [3000, 10], [1500, 5], [16000, 21.0975]]) {
      const n = R.segments(D).length;
      const p = R.strategy(kind, T, D, { elev: Array.from({ length: n }, (_, i) => i % 3 ? 5 : -8), custom: Array.from({ length: n }, (_, i) => 300 + i) });
      assert.ok(Math.abs(tot(p, D) - T) < 1e-6, `${kind} ${D}`);
    }
  }
  const c = R.strategy("conservative", 12600, HM);
  assert.ok(Math.abs(c[0] - 12600 / HM - 15) < 1e-9 && c[10] < 12600 / HM, "first 5 km exactly 15 s/km slower than average (same as v3 race plan), rest solved");
  const ng = R.strategy("negative", 12600, HM); assert.ok(ng[0] > ng[20]);
  const e = R.strategy("elevation", 12600, HM, { elev: Array.from({ length: 22 }, (_, i) => i === 3 ? 40 : 0) });
  assert.ok(e[3] > e[2] + 20, "uphill km gets more time");
});

test("editing a split rebalances later unlocked splits; total time preserved", () => {
  const p = R.strategy("even", 12600, HM);
  const r = R.editSplit(p, HM, 2, p[2] + 30, [4]);
  assert.ok(r.balanced); assert.ok(Math.abs(tot(r.paces, HM) - 12600) < 1e-6);
  assert.equal(r.paces[0], p[0], "earlier splits untouched"); assert.equal(r.paces[4], p[4], "locked split untouched");
  assert.ok(r.paces[10] < p[10], "later splits got faster to compensate");
  const huge = R.editSplit(p, HM, 20, p[20] + 2000);
  assert.equal(huge.balanced, false);
  const rows = R.splitRows(p, HM);
  assert.equal(rows.length, 22); assert.ok(Math.abs(rows[21].cum - 12600) < 1e-6); assert.equal(rows[4].five, true); assert.equal(rows[21].remaining, 0);
});

test("hydration: no litre numbers without a measured sweat rate; capped at 0.8 L/h; unverified stations flagged", () => {
  const p = R.strategy("even", 9000, HM), st = [{ km: 5, verified: false }, { km: 10, verified: true, label: "Resmi" }];
  const a = R.hydration({ durationSec: 9000, paces: p, D: HM, stations: st, tempC: 31, humidity: 80 });
  assert.equal(a.perHour, null); assert.ok(a.notes.some(n => /sweat rate/.test(n))); assert.ok(a.notes.some(n => /panas/.test(n)));
  assert.equal(a.checkpoints.length, 2); assert.equal(a.checkpoints[0].verified, false);
  assert.ok(Math.abs(a.checkpoints[0].at - 9000 * 5 / HM) < 1);
  const b = R.hydration({ durationSec: 9000, sweatRateLph: 2.0 });
  assert.ok(b.perHour[1] <= 0.8 && b.perHour[0] <= b.perHour[1]);
});

test("fuel: guidance by duration, servings from the product's own grams, energy only with body mass", () => {
  assert.deepEqual(R.fuel({ durationSec: 3000 }).gph, [0, 0]);
  const f = R.fuel({ durationSec: 9000, carbsPerServing: 25, massKg: 60, D: HM });
  assert.deepEqual(f.gph, [30, 60]); assert.equal(f.servings, 2); assert.ok(f.schedule.every(x => x.min >= 30 && x.min <= 150));
  assert.deepEqual(f.energy, [Math.round(0.9 * 60 * HM), Math.round(1.1 * 60 * HM)]);
  const noLabel = R.fuel({ durationSec: 9000 }); assert.equal(noLabel.servings, 0); assert.ok(noLabel.notes.some(n => /label produk/.test(n)));
  assert.equal(R.fuel({ durationSec: 9000, carbsPerServing: 25 }).energy, null);
});

test("HR guidance requires a measured HRmax; never invents continuous HR", () => {
  assert.equal(R.hrGuidance({ D: HM }).configured, false);
  const h = R.hrGuidance({ hrMax: 190, D: HM, tempC: 30, history: [{ date: "2027-02-01", hrAvg: 150, distance: 10, duration: 3600 }, { date: "2027-02-03", distance: 5 }] });
  assert.equal(h.zones.length, 5); assert.deepEqual(h.raceRange, [158, 171]); assert.equal(h.history.length, 1);
  assert.ok(h.notes.some(n => /drift/.test(n)));
});
