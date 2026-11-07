# Weather (v4)

Source: **Open-Meteo** (`api.open-meteo.com`, `geocoding-api.open-meteo.com`). Free, no API key, CC BY 4.0. Attribution is
shown on the card. No paid service, no key in JavaScript.

## Location (privacy)

- Nothing is requested until the user picks a location: *Pakai lokasi saya* (browser/WebView geolocation, asked only on that tap)
  or a city search.
- Coordinates are rounded to 2 decimals (~1 km) before any request.
- Stored in `localStorage` on that device only (`hmtp:weather:loc`). Not synced, exported, or shared with friends.
- Android declares coarse + fine location (Capacitor's WebView asks for both; Android 12+ users can choose "approximate").

## Data handling

- `public/js/weather.js` (pure, unit-tested): URLs, response parsing, freshness, session window, tips.
- Every value keeps source, retrieval time and unit, and is labelled **"Prakiraan model (bukan pengukuran)"**. A missing field stays
  `null` and is shown as "—", never invented.
- Cache `hmtp:weather:cache:v1`: refreshed at most hourly. If a fetch fails, the next try waits 5 minutes. Older than 3 h →
  "data lama"; older than 12 h → shown as expired and **not used for tips**. Offline → the last data with its age.
- API errors, including the free tier's rate limit (`{"error":true,"reason":"Daily API request limit exceeded…"}`), are shown
  verbatim with a retry button.

## Tips (rule-based, each with "Kenapa:")

For the next planned run inside the 3-day forecast, using the worst hour of the session window:

| Rule | Tip |
|---|---|
| WMO code ≥ 95 | storm: move the run or use a treadmill |
| feels ≥ 32 °C, or temp ≥ 28 °C with dew point ≥ 24 °C | heat/humidity: run by RPE, carry water on long runs |
| feels 26–32 °C | warm: start easy, drink before |
| feels ≤ 26 °C and rain chance < 30 % | good conditions |
| rain chance ≥ 60 % or ≥ 1 mm | rain: cap, avoid slippery surfaces |
| UV ≥ 8 | sunscreen/hat or run earlier |
| wind ≥ 30 km/h | start into the wind |

When there is heat, the card also names the coolest dry hour between 05:00 and 20:00 that day.

## Verification status

Tests use mocked responses in the exact Open-Meteo format (`test/fixtures/openmeteo.js`, `page.route` in
`test/e2e/v4-weather.test.js`). From the build sandbox, the live geocoding API answered, but the forecast API either reset the
connection or returned the shared-IP rate-limit error. So a live forecast was **not** verified end-to-end from here. It should be
checked once on a real device or browser.
