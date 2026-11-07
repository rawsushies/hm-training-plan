import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/weather.js";
import { forecast, geocode } from "../fixtures/openmeteo.js";
const W = globalThis.WRI_WEATHER;

test("request URLs: no key, coordinates rounded to ~1 km, local timezone", () => {
  const u = W.forecastUrl(-6.214621, 106.845131);
  assert.match(u, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=-6\.21&longitude=106\.85&/);
  assert.match(u, /timezone=auto/); assert.ok(!/key|token/i.test(u));
  assert.match(W.geocodeUrl("Bandung barat"), /name=Bandung%20barat/);
});

test("parse keeps source, retrieval time, units and labels it a forecast; API errors are readable", () => {
  const d = W.parseForecast(forecast("2026-11-09"), 1000);
  assert.equal(d.source, "Open-Meteo"); assert.equal(d.kind, "forecast"); assert.equal(d.retrievedAt, 1000);
  assert.equal(d.units.temp, "°C"); assert.equal(d.units.wind, "km/h"); assert.equal(d.hours.length, 72);
  assert.equal(d.hours[6].time, "2026-11-09T06:00"); assert.equal(d.tz, "Asia/Jakarta");
  assert.throws(() => W.parseForecast({ error: true, reason: "Daily API request limit exceeded. Please try again tomorrow." }), /limit exceeded/);
  assert.throws(() => W.parseForecast({}), /per jam/);
  const missing = forecast("2026-11-09"); delete missing.hourly.uv_index;
  assert.equal(W.parseForecast(missing).hours[12].uv, null, "missing field → null, never invented");
  assert.deepEqual(W.parseGeocode(geocode)[0], { name: "Jakarta", admin: "Jakarta", country: "Indonesia", lat: -6.21, lon: 106.85 });
});

test("freshness: fresh < 3 h, stale < 12 h, expired after", () => {
  const d = { retrievedAt: 0 };
  assert.equal(W.freshness(d, 2 * 3600e3), "fresh"); assert.equal(W.freshness(d, 5 * 3600e3), "stale"); assert.equal(W.freshness(d, 13 * 3600e3), "expired");
  assert.equal(W.needsRefresh(d, 30 * 60e3), false); assert.equal(W.needsRefresh(d, 2 * 3600e3), true); assert.equal(W.needsRefresh(null), true);
});

test("session window + tips name the numbers they are based on", () => {
  const cool = W.parseForecast(forecast("2026-11-09"));
  const win = W.windowFor(cool, "2026-11-09", "06:00", 50);
  assert.deepEqual(win.map(h => h.time), ["2026-11-09T06:00"]);
  assert.deepEqual(W.windowFor(cool, "2026-11-09", "05:30", 90).map(h => h.time.slice(11)), ["05:00", "06:00"]);
  const t1 = W.tips(W.summarize(win), { type: "easy", durationMin: 50 });
  assert.equal(t1[0].id, "nice"); assert.match(t1[0].why, /Terasa \d+(,\d)?°C/);
  const hot = W.parseForecast(forecast("2026-11-09", { hot: true }));
  const t2 = W.tips(W.summarize(W.windowFor(hot, "2026-11-09", "11:00", 90)), { type: "long", durationMin: 90 });
  assert.deepEqual(t2.map(t => t.id), ["heat", "uv"]); assert.match(t2[0].text, /Bawa minum/); assert.match(t2[0].why, /titik embun 25,2°C/);
  const storm = W.parseForecast(forecast("2026-11-09", { stormHour: 18 }));
  const t3 = W.tips(W.summarize(W.windowFor(storm, "2026-11-09", "18:00", 45)));
  assert.equal(t3[0].id, "storm"); assert.ok(!t3.some(t => t.id === "rain" || t.id === "nice"));
  const rain = W.parseForecast(forecast("2026-11-09", { rainHour: 18 }));
  assert.ok(W.tips(W.summarize(W.windowFor(rain, "2026-11-09", "18:00", 45))).some(t => t.id === "rain"));
  assert.deepEqual(W.tips(W.summarize([])), []);
  assert.equal(W.tips(W.summarize(W.windowFor(cool, "2026-11-09", "19:00", 45)))[0].id, "warm");
  assert.equal(W.coolestHour(cool, "2026-11-09").time, "2026-11-09T05:00");
  assert.equal(W.coolestHour(cool, "2030-01-01"), null);
});
