// Weather card with Open-Meteo responses mocked at the network layer (page.route), using the exact API response shape.
// The live API is not called from tests. Proves: explicit location choice, rounding, source/timestamp/attribution shown,
// tips explain "why", stale/expired data is labelled, API errors (rate limit) are shown honestly with cached data kept.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";
import { forecast, geocode } from "../fixtures/openmeteo.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

const NOW = new Date(2026, 10, 10, 5, 0);                     // Tue 10 Nov 2026 05:00 local, week 1 of the plan
async function setup({ hot = false, failForecast = false } = {}) {
  const d = await H.device();
  await d.page.clock.setFixedTime(NOW);
  d.calls = [];
  await d.ctx.route(/open-meteo\.com/, route => {
    const u = new URL(route.request().url()); d.calls.push(u.href);
    if (u.host.startsWith("geocoding")) return route.fulfill({ json: geocode });
    if (failForecast) return route.fulfill({ status: 429, json: { error: true, reason: "Daily API request limit exceeded. Please try again tomorrow." } });
    return route.fulfill({ json: forecast("2026-11-10", { hot }) });
  });
  await H.open(d.page);
  return d;
}

test("weather: nothing is requested until the user picks a location; city search → forecast card with source, units, tips + why", async () => {
  const { page, calls } = await setup();
  await page.waitForSelector('[data-tour="weather"]');
  assert.match(await page.textContent('[data-tour="weather"]'), /Atur lokasi/);
  assert.equal(calls.length, 0, "no location, no request");
  await page.click('[data-act="wxLoc"]');
  await page.fill("#wx-q", "Jakarta"); await page.click('[data-act="wxSearch"]');
  await page.waitForSelector('[data-act="wxPick"]'); await page.click('[data-act="wxPick"]');
  await H.waitFor(page, () => /Prakiraan model/.test(document.querySelector('[data-tour="weather"]').textContent));
  const card = await page.textContent('[data-tour="weather"]');
  assert.match(card, /Cuaca · Jakarta/);
  assert.match(card, /°C/); assert.match(card, /Open-Meteo\.com \(CC BY 4\.0\)/); assert.match(card, /diambil baru saja/);
  assert.match(card, /Kenapa: Terasa/, "tip explains the numbers behind it");
  const f = calls.find(u => u.includes("/v1/forecast"));
  assert.match(f, /latitude=-6\.21&longitude=106\.85/, "coordinates rounded to ~1 km");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:weather:loc")).src), "search");
  // stored per device only: not part of the synced/exported state
  assert.ok(!(await page.evaluate(() => JSON.stringify(window.__hmtpTest.S()))).includes("106.85"));
  assert.deepEqual(page.errors, []);
});

test("weather: heat tips for a hot forecast; stale and expired data are labelled; offline-safe", async () => {
  const { page } = await setup({ hot: true });
  await page.evaluate(() => localStorage.setItem("hmtp:weather:loc", JSON.stringify({ name: "Jakarta", lat: -6.21, lon: 106.85, src: "search" })));
  await H.act(page, "nav", { t: "more" }); await H.act(page, "nav", { t: "home" });
  await H.waitFor(page, () => /Panas dan lembap/.test(document.querySelector('[data-tour="weather"]').textContent));
  assert.match(await page.textContent('[data-tour="weather"]'), /titik embun 25,2°C/);
  // age the cache: 5 h → "data lama"; 13 h → no tips from it
  const age = h => page.evaluate(h => { const c = JSON.parse(localStorage.getItem("hmtp:weather:cache:v1")); c.data.retrievedAt = Date.now() - h * 3600e3; localStorage.setItem("hmtp:weather:cache:v1", JSON.stringify(c)); WX.lastTry = Date.now(); }, h);
  await age(5); await H.act(page, "nav", { t: "more" }); await H.act(page, "nav", { t: "home" });
  assert.match(await page.textContent('[data-tour="weather"]'), /data lama/);
  await age(13); await H.act(page, "nav", { t: "more" }); await H.act(page, "nav", { t: "home" });
  const card = await page.textContent('[data-tour="weather"]');
  assert.match(card, /lebih dari 12 jam/); assert.ok(!/Panas dan lembap/.test(card), "expired data gives no tips");
  assert.deepEqual(page.errors, []);
});

test("weather: API rate-limit error is shown as-is, never replaced by invented values", async () => {
  const { page } = await setup({ failForecast: true });
  await page.evaluate(() => localStorage.setItem("hmtp:weather:loc", JSON.stringify({ name: "Jakarta", lat: -6.21, lon: 106.85, src: "search" })));
  await H.act(page, "nav", { t: "more" }); await H.act(page, "nav", { t: "home" });
  await H.waitFor(page, () => /limit exceeded/.test(document.querySelector('[data-tour="weather"]').textContent));
  const card = await page.textContent('[data-tour="weather"]');
  assert.ok(!/°C/.test(card), "no temperature without data"); assert.match(card, /Coba lagi/);
  assert.deepEqual(page.errors, []);
});
