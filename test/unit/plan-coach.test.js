// Plan coach: prescriptions and missed-session adaptation. SYNTHETIC data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/coach/plan.js";
const P = globalThis.WRI_PLAN;

test("prescriptions have purpose, warm-up, main, cool-down, guide, shorter alternative and why for every type", () => {
  for (const type of ["easy", "recovery", "long", "locked", "elevation", "benchmark", "race", "strength"]) {
    const p = P.prescribe({ type, dist: 10 });
    for (const k of ["purpose", "warm", "main", "cool", "guide", "alt"]) assert.ok(p[k] && p[k].length > 1, `${type}.${k}`);
  }
  assert.match(P.prescribe({ type: "long", dist: 14 }).alt, /10 km/);
});

test("no pace hint without evidence; with ≥4 easy runs (RPE ≤ 4) the hint is the runner's own median, labelled", () => {
  assert.match(P.prescribe({ type: "easy", dist: 6 }).guide, /pakai RPE/);
  assert.ok(!/\d:\d\d \/km/.test(P.prescribe({ type: "easy", dist: 6 }).guide), "no invented pace");
  const S = [1, 2, 3, 4].map(i => ({ date: `2026-11-1${i}`, rpe: 3, paceSecPerKm: 400 + i }));
  const ep = P.easyPace(S, "2026-11-18");
  assert.deepEqual(ep, { pace: 402.5, n: 4 });
  assert.match(P.prescribe({ type: "easy", dist: 6 }, { easyPace: ep }).guide, /6:43 \/km \(median 4 lari santaimu\)/);
  assert.equal(P.easyPace(S.slice(0, 3), "2026-11-18"), null);
  assert.equal(P.easyPace(S.map(s => Object.assign({}, s, { rpe: 6 })), "2026-11-18"), null, "hard runs are not easy pace");
  assert.ok(!/RPE 6–7.*\/km/.test(P.prescribe({ type: "locked", dist: 8 }, { easyPace: ep }).guide), "no invented quality pace");
});

test("missed long run moves to a free day not next to a hard session; otherwise it is let go; never doubles up", () => {
  const week = [
    { id: "a", date: "2026-11-16", type: "easy", dist: 5, state: "done" },
    { id: "b", date: "2026-11-17", type: "long", dist: 12, state: "missed" },
    { id: "c", date: "2026-11-19", type: "locked", dist: 6, state: "up" },
    { id: "d", date: "2026-11-22", type: "easy", dist: 5, state: "up" }
  ];
  const r = P.adapt(week, "2026-11-18");
  assert.equal(r.length, 1); assert.equal(r[0].kind, "move");
  assert.ok(!["2026-11-19", "2026-11-22", "2026-11-18", "2026-11-20"].includes(r[0].to), "not on a session day, not next to the hard Thursday: " + r[0].to);
  assert.match(r[0].reason, /tidak berdempetan/);
  const missedEasy = P.adapt([{ id: "x", date: "2026-11-16", type: "easy", dist: 5, state: "missed" }], "2026-11-18");
  assert.equal(missedEasy[0].kind, "skip"); assert.match(missedEasy[0].reason, /menumpuk beban tidak membantu/);
  const full = ["16", "17", "18", "19", "20", "21", "22"].map((d, i) => ({ id: "f" + i, date: `2026-11-${d}`, type: i === 1 ? "long" : "easy", dist: 5, state: i === 1 ? "missed" : "up" }));
  assert.equal(P.adapt(full, "2026-11-18")[0].kind, "skip", "no free day → let go, never doubled");
  assert.deepEqual(P.adapt(week.map(s => Object.assign({}, s, { state: "done" })), "2026-11-18"), [], "a completed week proposes nothing (no automatic load increase)");
});
