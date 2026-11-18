// Strava display-only: server helpers + client cache rules. SYNTHETIC activities only.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../../functions/strava-core.js";
import "../../public/js/coach/strava.js";
const SV = globalThis.WRI_STRAVA;
const NOW = Date.parse("2026-11-18T08:00:00Z");

test("OAuth state is bound to the user, signed, expires after 10 minutes, and rejects tampering", () => {
  const st = C.makeState("uidA", "k", NOW);
  assert.equal(C.readState(st, "k", NOW + 60e3), "uidA");
  assert.equal(C.readState(st, "k", NOW + 11 * 60e3), null, "expired");
  assert.equal(C.readState(st, "other", NOW), null, "wrong key");
  assert.equal(C.readState(st.replace("uidA", "uidB"), "k", NOW), null, "tampered uid");
  assert.equal(C.readState("garbage", "k", NOW), null);
  const u = new URL(C.authorizeUrl({ clientId: "123", redirectUri: "https://x.example/cb", state: st }));
  assert.equal(u.searchParams.get("scope"), "activity:read"); assert.equal(u.searchParams.get("state"), st);
});

test("server keeps only display fields from the last 7 days; missing values stay null", () => {
  const acts = [
    { id: 1, name: "Pagi", sport_type: "Run", start_date_local: "2026-11-17T06:10:00Z", distance: 8123, moving_time: 2900, total_elevation_gain: 40, has_heartrate: false, average_heartrate: 150, map: { polyline: "x" } },
    { id: 2, name: "Lama", sport_type: "Run", start_date_local: "2026-11-01T06:00:00Z", distance: 5000, moving_time: 1800 },
    { id: 3, name: "Sepeda", sport_type: "Ride", start_date_local: "2026-11-16T07:00:00Z", distance: 20000 }
  ];
  const r = C.inWindow(acts, NOW);
  assert.deepEqual(r.map(a => a.id), ["1", "3"]);
  assert.deepEqual(r[0], { id: "1", name: "Pagi", sport: "Run", run: true, startLocal: "2026-11-17T06:10:00", date: "2026-11-17", distanceKm: 8.12, movingSec: 2900, elevGainM: 40, hrAvg: null });
  assert.equal(r[1].movingSec, null); assert.equal(r[1].run, false);
  assert.ok(!("map" in r[0]), "no route/polyline kept");
  assert.equal(C.afterEpoch(NOW), Math.floor((NOW - 7 * 864e5) / 1000));
  assert.ok(C.needsRefresh(NOW / 1000 + 30, NOW)); assert.ok(!C.needsRefresh(NOW / 1000 + 3600, NOW));
  assert.ok(C.isDeauth({ object_type: "athlete", aspect_type: "update", updates: { authorized: "false" } }));
  assert.ok(!C.isDeauth({ object_type: "activity", aspect_type: "create" }));
});

test("client cache: dropped after 7 days, old activities filtered, future timestamps rejected; runsOn only shows runs", () => {
  const cache = { fetchedAt: NOW - 2 * 864e5, status: "connected", activities: [{ id: "1", date: "2026-11-17", run: true, distanceKm: 8 }, { id: "2", date: "2026-11-05", run: true }, { id: "3", date: "2026-11-17", run: false }] };
  const f = SV.fresh(cache, NOW);
  assert.deepEqual(f.activities.map(a => a.id), ["1", "3"]);
  assert.equal(SV.fresh(Object.assign({}, cache, { fetchedAt: NOW - 8 * 864e5 }), NOW), null, "expired cache is discarded");
  assert.equal(SV.fresh(Object.assign({}, cache, { fetchedAt: NOW + 3600e3 }), NOW), null);
  assert.equal(SV.fresh(null, NOW), null);
  assert.deepEqual(SV.runsOn(f, "2026-11-17").map(a => a.id), ["1"]);
});

test("client is off (unavailable) until the owner enables the deployed server", () => {
  delete globalThis.HMTP_STRAVA_ENABLED;
  assert.equal(SV.status(), "unavailable");
});
