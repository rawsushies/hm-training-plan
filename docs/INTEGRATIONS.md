# Integrations and shoes (v4 M4)

## Status (honest)

| Source | State | Notes |
|---|---|---|
| GPX / TCX / Strava CSV file | **Working** | Parsed on the device; shared review step (`reviewImport`) with dedupe. |
| Health Connect (Android) | **Working in code, needs a device test** | `@capgo/capacitor-health` 8.11.14. Read-only `READ_EXERCISE` + `READ_DISTANCE`; every other permission the plugin declares is removed from the merged manifest. Reads runs from the last 30 days (Health Connect's default window without history permission). The user reviews before saving. HR is not read, and it stays empty rather than being estimated. Requires `minSdk 26` (Android 8.0+), raised from 24. Tested through Capacitor's real Android bridge with a fake plugin, not on a phone. |
| Strava auto-sync | **Scaffold, not deployed** | `functions/index.js`: OAuth start/callback (state HMAC-bound to the Firebase user), webhook, token refresh. The client secret lives in Secret Manager only. Tokens are in `serverOnly/**`, which the rules deny to every client. Activities land in `users/{uid}/inbox/*`; the owner can read and delete, clients cannot write (rules-tested). Needs the Blaze plan, a Strava API app, secrets, and `"functions"` in `firebase.json`. In-app inbox review is not built. |
| Huawei Health | Not available | Needs a Huawei developer account + Health Kit approval. Use GPX/TCX export. |
| Garmin / COROS / Suunto | Not available | Official APIs are partner programs (application + agreement). Practical routes today: the watch app → Health Connect or Strava, or file export. |

Activity model, dedupe and provider statuses: `public/js/integrations.js` (unit-tested). Duplicates are detected by the same
external id, the same start minute, or the same date with distance within 3% (and duration within 5% when both are known).

## Shoes

- Optional fields `brand`, `model`, `use` (daily/tempo/long/race/trail), `initialKm` (km before using the app), `since`.
  v3 shoe records stay byte-identical (no sync churn).
- Mileage = `initialKm` + km from real (non-sample) runs; the card shows both parts.
- Rotation: a suggestion for the next session from use fit + wear, with the reason. Race shoes are only suggested for fast sessions and the race. There's also a 28-day share per shoe.
- Catalogue (`public/js/shoe-catalog.js`): 16 current models with brand, model name and release date, each linked to the public source it came from and the retrieval date ("sekitar" = first retail listing, not an official launch). Below the facts, a Plus/Minus tab holds WeRunIt's own short notes, labelled as opinion. No prices or lab specs. One tap adds a model to "Sepatuku".
