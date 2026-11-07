import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/social.js";
const F = globalThis.WRI_SOCIAL;
const L = (id, date, km, sec, x = {}) => Object.assign({ id, date, distance: km, duration: sec, type: "easy", notes: "lutut nyeri", rpe: 4 }, x);
const week = { start: "2026-11-09", end: "2026-11-15", sessions: [{ done: true }, { done: false }, { done: true }] };
const logs = [L("a", "2026-11-10", 5, 1800, { hrAvg: 150 }), L("b", "2026-11-14", 10.1, 3900, { hrAvg: 158 }), L("c", "2026-10-01", 21.1, 9000), L("s", "2026-11-11", 5, 1200, { sample: true })];

test("private by default: nothing is built unless a permission is on", () => {
  assert.equal(F.buildShare({ logs, week, perms: undefined, name: "A" }), null);
  assert.equal(F.buildShare({ logs, week, perms: F.defaultPerms(), name: "A" }), null);
});

test("only enabled fields are shared; notes/check-ins/routes never; sample data excluded", () => {
  const s = F.buildShare({ logs, week, perms: { weekly: true }, name: "Ana", photo: "javascript:x" });
  assert.deepEqual(Object.keys(s).sort(), ["name", "photo", "totalKm", "weekKm"]);
  assert.equal(s.weekKm, 15.1); assert.equal(s.totalKm, 36.2, "sample run not counted"); assert.equal(s.photo, "");
  const all = F.buildShare({ logs, week, upcoming: [{ date: "2026-11-17", type: "easy", dist: 4, title: "Easy Run" }], perms: { weekly: true, completion: true, pbs: true, activities: ["b"], plan: true, hr: true }, name: "Ana" });
  assert.equal(all.weekDone, 2); assert.equal(all.weekPlanned, 3);
  assert.deepEqual(all.activities, [{ date: "2026-11-14", type: "easy", km: 10.1, sec: 3900 }]);
  assert.equal(all.plan[0].title, "Easy Run");
  assert.equal(all.hrPace.length, 2, "only runs with recorded HR");
  assert.ok(!JSON.stringify(all).includes("nyeri"), "private notes never leave the device");
  assert.ok(all.pbs["5k"] && all.pbs["10k"] && all.pbs.hm);
  assert.equal(all.pbs["5k"].sec, 1800, "sample 5K (faster) is not a PB");
});

test("joint pace check: uses real HR at similar pace; % only with a measured HRmax; honest when unknown", () => {
  const pts = [{ pace: 390, hrAvg: 150, km: 5 }, { pace: 386, hrAvg: 158, km: 10 }];
  const a = F.paceCheck(390, pts, 190, 21.1);
  assert.equal(a.hr, 154); assert.equal(a.pct, 81); assert.equal(a.level, "moderate");
  assert.match(a.text, /baru dipertahankan sampai 10 km/);
  const b = F.paceCheck(390, pts, null);
  assert.equal(b.level, "noHrMax"); assert.equal(b.pct, undefined);
  assert.equal(F.paceCheck(300, pts, 190).level, "hard");
  assert.equal(F.paceCheck(390, [], 190).level, "unknown");
});

test("goal contribution counts real runs since the goal started", () => {
  assert.deepEqual(F.contribution(logs, "2026-11-01"), { km: 15.1, runs: 2 });
  assert.equal(F.pairId("zed", "amy"), "amy_zed");
});
