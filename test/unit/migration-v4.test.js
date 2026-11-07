import { test } from "node:test";
import assert from "node:assert/strict";
import { H, defaults, run, ci } from "./helpers.js";

const v4State = () => H.sanitizeState(Object.assign(defaults(), {
  logs: [run("r1", { shoeId: "sh1", extId: "hc:w1", src: "Health Connect" }), run("r2", { date: "2026-11-12", distance: 10 })],
  strength: [{ id: "st1", date: "2026-11-11", kind: "A", sets: 2 }], checkins: [ci("2026-11-10")],
  shoes: [{ id: "sh1", name: "Harian", limit: 600, brand: "M", use: "daily", initialKm: 250, since: "2026-10-01" }],
  reviews: { 0: { best: "rutin", hard: "", rec: "", fix: "" } },
  events: { "ev-1": { id: "ev-1", name: "Race X", eventDate: "2027-03-07", distanceKm: 10, targetFinish: "0:55:00" } },
  shareWith: { friendUid123: { weekly: true, completion: false, pbs: false, activities: ["r1"], plan: false, hr: false } }
}), defaults);

test("v4 state survives records → state → records unchanged (every field, every collection)", () => {
  const S = v4State(), recs = H.stateToRecords(S);
  const back = H.recordsToState(recs, defaults(), defaults), recs2 = H.stateToRecords(back);
  assert.deepEqual(recs2, recs);
  assert.equal(back.shoes[0].initialKm, 250); assert.equal(back.logs[0].extId, "hc:w1");
  assert.deepEqual(back.shareWith.friendUid123.activities, ["r1"]); assert.equal(back.events["ev-1"].distanceKm, 10);
});

test("upgrading v3 data never drops runs, strength, check-ins, reviews or shoe mileage, and is idempotent", () => {
  const v3 = Object.assign(defaults(), { logs: [run("a"), run("b", { shoeId: "s1" })], strength: [{ id: "x", date: "2026-11-11", kind: "B", sets: 1 }], checkins: [ci("2026-11-10")], shoes: [{ id: "s1", name: "Lama", limit: 700, retired: false }], reviews: { 1: { best: "a", hard: "b", rec: "c", fix: "d" } } });
  const once = H.sanitizeState(JSON.parse(JSON.stringify(v3)), defaults), twice = H.sanitizeState(JSON.parse(JSON.stringify(once)), defaults);
  assert.deepEqual(H.stateToRecords(twice), H.stateToRecords(once));
  const c = H.countState(once);
  assert.deepEqual([c.logs, c.strength, c.checkins, c.shoes], [2, 1, 1, 1]);
  assert.deepEqual(once.reviews[1], v3.reviews[1]);
  assert.deepEqual(once.shoes[0], v3.shoes[0], "v3 shoe unchanged (mileage comes from its runs)");
});

test("merging a v4 device into a v3 account keeps both sides' records", () => {
  const a = v4State(), b = H.sanitizeState(Object.assign(defaults(), { logs: [run("z", { date: "2026-11-20" })], shoes: [{ id: "sh9", name: "Lain", limit: 500 }] }), defaults);
  const { state } = H.mergeStates(a, b, defaults);
  assert.deepEqual(state.logs.map(l => l.id).sort(), ["r1", "r2", "z"]);
  assert.deepEqual(state.shoes.map(s => s.id).sort(), ["sh1", "sh9"]);
  assert.equal(state.shoes.find(s => s.id === "sh1").initialKm, 250);
});
