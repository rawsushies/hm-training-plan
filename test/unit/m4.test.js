import { test } from "node:test";
import assert from "node:assert/strict";
import { H, defaults } from "./helpers.js";
import "../../public/js/shoes.js";
import "../../public/js/integrations.js";
const SH = globalThis.WRI_SHOES, IN = globalThis.WRI_INTEG;
const log = (id, date, km, shoeId, x = {}) => Object.assign({ id, date, distance: km, duration: km * 400, type: "easy", shoeId }, x);

test("shoe record: v4 fields optional, v3 shoes unchanged (no sync churn), invalid values dropped", () => {
  const v3 = { id: "sh1", name: "Biru", limit: 700, retired: false };
  const S = H.sanitizeState(Object.assign(defaults(), { shoes: [v3] }), defaults);
  assert.deepEqual(S.shoes[0], v3);
  const S2 = H.sanitizeState(Object.assign(defaults(), { shoes: [{ id: "sh2", name: "X", limit: 600, brand: "Merk", model: "M1", use: "tempo", initialKm: "120.44", since: "2026-01-02", junk: 1 }, { id: "sh3", name: "Y", limit: 600, use: "rocket", initialKm: -5 }] }), defaults);
  assert.deepEqual(S2.shoes[0], { id: "sh2", name: "X", limit: 600, retired: false, brand: "Merk", model: "M1", use: "tempo", initialKm: 120.4, since: "2026-01-02" });
  assert.deepEqual(Object.keys(S2.shoes[1]).sort(), ["id", "limit", "name", "retired"]);
});

test("mileage = initial + tracked real runs; rotation suggestion fits the session and prefers less wear", () => {
  const shoes = [{ id: "a", name: "Daily A", limit: 600, use: "daily", initialKm: 300 }, { id: "b", name: "Daily B", limit: 600, use: "daily" }, { id: "r", name: "Racer", limit: 400, use: "race" }, { id: "old", name: "Old", limit: 600, retired: true }];
  const logs = [log("1", "2026-11-02", 10, "a"), log("2", "2026-11-03", 5, "b"), log("s", "2026-11-04", 50, "b", { sample: true })];
  assert.deepEqual(SH.stats(shoes[0], logs), { tracked: 10, initial: 300, total: 310, runs: 1, pct: 52, lastUsed: "2026-11-02" });
  assert.equal(SH.stats(shoes[1], logs).total, 5, "sample runs never count");
  const e = SH.suggest(shoes, logs, "easy");
  assert.equal(e.shoe.id, "b"); assert.match(e.reason, /1% dari batas/);
  assert.equal(SH.suggest(shoes, logs, "race").shoe.id, "r");
  assert.notEqual(SH.suggest(shoes, logs, "long").shoe.id, "r", "race shoe not suggested for long runs");
  assert.equal(SH.suggest([shoes[3]], logs, "easy"), null, "retired shoes never suggested");
  const rot = SH.rotation(shoes, logs.concat(log("3", "2026-11-05", 4, null)), "2026-11-07");
  assert.equal(rot.unassignedKm, 4); assert.deepEqual(rot.share.map(x => [x.id, x.pct]), [["a", 67], ["b", 33]]);
});

test("discovery is search links only (no catalogue, no scraping)", () => {
  const L = SH.searchLinks({ use: "tempo", brand: "Merk" });
  assert.deepEqual(L.map(x => x.id), ["google", "reviews", "youtube"]);
  assert.ok(L.every(x => /^https:\/\/www\.(google|youtube)\.com\//.test(x.url)));
  assert.match(decodeURIComponent(L[0].url), /Merk sepatu lari tempo/);
});

test("integrations: Health Connect workout → activity; dedupe by id, start time or date+distance+duration", () => {
  const a = IN.fromHealthWorkout({ workoutType: "running", duration: 1800.4, totalDistance: 5012, startDate: "2026-11-05T22:30:00.000Z", endDate: "2026-11-05T23:00:00.000Z", sourceName: "Jam X", platformId: "abc" });
  assert.equal(a.extId, "hc:abc"); assert.equal(a.distance, 5.01); assert.equal(a.duration, 1800); assert.equal(a.isRun, true);
  assert.equal(a.hrAvg, null, "HR not invented when the source has none");
  assert.equal(IN.fromHealthWorkout({ workoutType: "cycling", startDate: "2026-11-05T10:00:00Z", duration: 60 }).isRun, false);
  assert.equal(IN.fromHealthWorkout({ workoutType: "running", startDate: "nope" }), null);
  const logs = [{ date: a.date, distance: 5.1, duration: 1820, extId: "t:x" }];
  assert.equal(IN.isDup(a, logs), true, "same day, ~same distance & duration");
  assert.equal(IN.isDup(Object.assign({}, a, { duration: 2400 }), logs), false, "different duration → different run");
  assert.equal(IN.isDup(Object.assign({}, a, { distance: 10 }), logs), false);
  assert.equal(IN.isDup(a, [{ date: "2000-01-01", distance: 1, extId: "hc:abc" }]), true);
  assert.equal(IN.dedupeBatch([a, Object.assign({}, a)]).length, 1);
});

test("provider status is honest: only file import (and Health Connect in a capable APK) is available", () => {
  const st = env => Object.fromEntries(IN.PROVIDERS.map(p => [p.id, p.status(env).state]));
  assert.deepEqual(st({ native: false, plugins: {} }), { file: "available", healthconnect: "unsupported", strava: "needs-server", huawei: "needs-credentials", garmin: "partner-only", coros: "partner-only", suunto: "partner-only" });
  assert.equal(st({ native: true, plugins: { Health: false } }).healthconnect, "needs-app-update");
  assert.equal(st({ native: true, plugins: { Health: true } }).healthconnect, "available");
});

test("shoe catalogue: every model has brand, model, valid release date, source link + retrieval date, and our plus/minus", async () => {
  await import("../../public/js/shoe-catalog.js");
  const C = globalThis.WRI_SHOE_CATALOG;
  assert.match(C.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(C.models.length >= 12);
  const ids = new Set();
  for (const m of C.models) {
    assert.ok(!ids.has(m.id), "unique id " + m.id); ids.add(m.id);
    assert.ok(m.brand && m.model, m.id);
    assert.match(m.released, /^\d{4}-\d{2}-\d{2}$/); assert.ok(!isNaN(Date.parse(m.released)) && m.released <= C.retrieved, m.id + " not in the future");
    assert.ok(["daily", "tempo", "long", "race", "trail"].includes(m.use), m.id);
    assert.match(m.source.url, /^https:\/\//); assert.ok(m.source.label, m.id);
    assert.ok(m.plus.length >= 1 && m.minus.length >= 1, m.id);
  }
});
