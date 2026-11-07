import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/schedule.js";
const W = globalThis.WRI_SCHED;
const kinds = { wd: "quality", sat: "long", sun: "recovery" };

test("legacy arrangement reproduced exactly for every weekday choice (existing users keep their days)", () => {
  for (const wd of [0, 1, 3, 4]) {
    const a = W.assignWeek(W.fromLegacy(wd), { kinds });
    assert.deepEqual(a.days, { sat: 5, sun: 6, wd }, `weekday ${wd}`);
    const want = Object.fromEntries(W.LEGACY_STR[wd].map(([d, k]) => [k, d]));
    // strength never on a run day; A never the day before the long run
    assert.ok(![wd, 5, 6].includes(a.strength.A) && a.strength.A !== 4, `A ${a.strength.A}`);
    assert.deepEqual(new Set(Object.values(a.strength)).size, 2);
    assert.deepEqual(a.strength, want, `strength for weekday ${wd}`);
  }
});

test("custom availability: long on preferred day, recovery after it, quality ≥2 days away", () => {
  const s = W.cleanSchedule({ avail: [true, false, true, true, false, false, true], long: 6, quality: 2, recovery: null, strength: [], freq: 3 });
  const a = W.assignWeek(s, { kinds });
  assert.equal(a.days.sat, 6, "long run on Sunday as preferred");
  assert.equal(a.days.wd, 2, "quality Wednesday (4 days from long)");
  assert.ok([0, 3].includes(a.days.sun), "recovery on a remaining available day");
  assert.equal(new Set(Object.values(a.days)).size, 3, "no two runs on one day");
});

test("preferred long-run day unavailable → latest available day; quality kept away from it", () => {
  const s = W.cleanSchedule({ avail: [true, true, false, true, true, false, false], long: 5, quality: 3, strength: [], freq: 3 });
  const a = W.assignWeek(s, { kinds });
  assert.equal(a.days.sat, 4, "long run moves to Friday");
  assert.ok(Math.abs(a.days.wd - 4) >= 2, "quality not next to the long run");
});

test("too few available days: nothing is invented, the user is told what didn't fit", () => {
  const s = W.cleanSchedule({ avail: [false, false, true, false, false, true, false], long: 5, quality: 2, strength: [], freq: 3 });
  const a = W.assignWeek(s, { kinds });
  assert.deepEqual(Object.keys(a.days).sort(), ["sat", "wd"]);
  assert.deepEqual(a.unplaced, ["sun"]);
  assert.match(a.notes.join(" "), /recovery run nggak dapat hari/);
});

test("frequency is explicit: more free days do not add runs; freq 4 adds one easy run, freq 2 drops recovery", () => {
  const all = { avail: Array(7).fill(true), long: 5, quality: 1, strength: [], freq: 3 };
  assert.equal(Object.keys(W.assignWeek(W.cleanSchedule(all), { kinds, includeExtra: true }).days).length, 3);
  const f4 = W.assignWeek(W.cleanSchedule(Object.assign({}, all, { freq: 4 })), { kinds, includeExtra: true });
  assert.equal(Object.keys(f4.days).length, 4);
  assert.ok(Math.abs(f4.days.ex - f4.days.wd) >= 1 && f4.days.ex !== f4.days.sat);
  const f2 = W.assignWeek(W.cleanSchedule(Object.assign({}, all, { freq: 2 })), { kinds });
  assert.deepEqual(Object.keys(f2.days).sort(), ["sat", "wd"]);
});

test("race week: race pinned to its day, shakeout earlier", () => {
  const a = W.assignWeek(W.fromLegacy(1), { kinds: { wd: "easy", sat: "easy", sun: "race" }, raceWeek: true });
  assert.equal(a.days.sun, 6); assert.ok(a.days.sat < 6);
});

test("events: default JAKIM target kept; validation rejects hostile/invalid fields", () => {
  const d = W.defaultEvent({ raceDate: "2027-06-13", goalTime: "3:30:00" });
  assert.equal(d.eventDate, "2027-06-13"); assert.equal(d.distanceKm, 21.0975); assert.equal(d.eventStatus, "planned");
  assert.equal(W.cleanEvent({ id: "x", eventDate: "nope", distanceKm: 10 }), null);
  const e = W.cleanEvent({ id: "bali-10k", name: "<b>Bali</b>", eventDate: "2027-03-01", distanceKm: 10, eventStatus: "hacked", sourceUrl: "javascript:alert(1)", aidStations: [{ km: 5, label: "Pos 1" }, { km: 99 }] });
  assert.equal(e.eventStatus, "planned"); assert.equal(e.sourceUrl, ""); assert.equal(e.aidStations.length, 1);
  assert.equal(e.aidStations[0].verified, false, "stations are unverified unless marked");
  assert.equal(W.distanceFactor(42.195).unsupported, true, "no fabricated marathon plan");
});

test("replan: postponement repeats the current block, no volume jump; past weeks untouched", () => {
  const weeks = Array.from({ length: 31 }, (_, i) => i + 1), totals = [13,14,15,13,16,18,19,15,19,21,22,17,22,23,25,18,24,26,27,21,27,28,23,27,30,24,27,22,19,13,24.1];
  const r = W.replan(weeks, 9, 21 + 4, totals);       // currently in calendar week 10, race 4 weeks later than planned
  assert.deepEqual(r.weeks.slice(0, 10), weeks.slice(0, 10));
  assert.equal(r.weeks.length, 35); assert.equal(r.weeks[34], 31);
  assert.deepEqual(r.weeks.slice(10, 12), [11, 12], "finish the current block first");
  assert.deepEqual(r.weeks.slice(12, 16), [9, 10, 11, 12], "then repeat it");
  const fut = r.weeks.slice(9, -1);   // race week excluded (it contains the race itself)
  fut.forEach((t, i) => { if (i >= 2) assert.ok(totals[t - 1] <= Math.max(totals[fut[i - 1] - 1], totals[fut[i - 2] - 1]) * 1.35, `jump at ${t}`); });
});

test("replan: earlier race skips build weeks with ≤10% volume jumps, keeps taper; too soon is flagged honestly", () => {
  const weeks = Array.from({ length: 31 }, (_, i) => i + 1), totals = [13,14,15,13,16,18,19,15,19,21,22,17,22,23,25,18,24,26,27,21,27,28,23,27,30,24,27,22,19,13,24.1];
  const r = W.replan(weeks, 9, 14, totals);
  assert.equal(r.weeks.length, 24); assert.deepEqual(r.weeks.slice(-4), [28, 29, 30, 31]);
  const fut = r.weeks.slice(8);
  for (let i = 2; i < fut.length - 4; i++) assert.ok(totals[fut[i] - 1] <= Math.max(totals[fut[i - 1] - 1], totals[fut[i - 2] - 1]) * 1.1 + 1e-9, `jump at ${fut[i]}`);
  const soon = W.replan(weeks, 9, 2, totals);
  assert.equal(soon.readiness, "insufficient"); assert.deepEqual(soon.weeks.slice(10), [30, 31]);
  assert.match(soon.changes[0], /kurang dari taper/);
});
