# WeRunIt (Half Marathon Training Plan)

Mobile-first web app for a 31-week half marathon plan (Bahasa Indonesia): schedule, run log,
GPX/TCX/Strava import, workout timer, locked-in and elevation sessions, strength, daily check-in,
monthly reviews, goals and badges, race plan, shoes, pace calculator. With Kiki as the guide.

**v3 adds:** Google sign-in (Firebase Auth), per-account offline-first storage, record-level Firestore
sync with conflict handling, safe migration from v2, private-by-default training groups with one-time
invite links, a layered tutorial (quick start, 18 feature tours, `?` help on every page) and
notification-ready preferences.

**v4 (WeRunIt) adds:** new brand and glass motion system, flexible schedule, race events with replanning, race-day
intelligence, friends with per-friend private sharing, Android notifications, Open-Meteo weather tips, shoe rotation, and
integrations (file import, Health Connect). Status and what still needs credentials or a device: [docs/V4.md](docs/V4.md).

**4.0 (quick app):** four tabs (Hari ini, Lari, Race, Kamu) and an orange record button. Today's workout is drawn as a
shape with one-tap done/start, check-in is one tap, runs are a feed of cards, records are medals. Data, sync and every
older feature are unchanged. Design rules: [DESIGN.md](DESIGN.md).

**Live:** https://we-run-it.web.app · **Android:** see [docs/ANDROID.md](docs/ANDROID.md) ·
**Shipping changes:** see [docs/UPDATES.md](docs/UPDATES.md) (installed apps update themselves).

## Run it

```bash
npm install
```

```bash
npm run serve        # http://localhost:5173 (local-only mode until Firebase is configured)
```

Turn on sync: see [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Test it

```bash
npm test             # unit tests (merge, sync engine, validation, reminders)
```

```bash
npm run test:rules   # Firestore security rules on the emulator (needs Java 11+)
```

```bash
npm run test:e2e     # Chromium end-to-end on Auth + Firestore emulators
```

## Docs

[Codebase audit](docs/CODEBASE_AUDIT.md) · [Architecture](docs/ARCHITECTURE.md) ·
[Firebase setup](docs/FIREBASE_SETUP.md) · [Data migration](docs/DATA_MIGRATION.md) ·
[Tutorial system](docs/TUTORIAL_SYSTEM.md) · [Notifications](docs/NOTIFICATIONS.md) · [Friends](docs/FRIENDS.md) · [Weather](docs/WEATHER.md) ·
[Integrations & shoes](docs/INTEGRATIONS.md) · [v4 status](docs/V4.md) · [Test report](docs/TEST_REPORT.md)

`legacy/hm-training-plan.claude.html` is the untouched v2 that keeps working on claude.ai.
