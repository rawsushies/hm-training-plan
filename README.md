# Half Marathon Training Plan

Mobile-first web app for a 31-week half marathon plan (Bahasa Indonesia): schedule, run log,
GPX/TCX/Strava import, workout timer, locked-in and elevation sessions, strength, daily check-in,
monthly reviews, goals and badges, race plan, shoes, pace calculator. With Kiki as the guide.

**v3 adds:** Google sign-in (Firebase Auth), per-account offline-first storage, record-level Firestore
sync with conflict handling, safe migration from v2, private-by-default training groups with one-time
invite links, a layered tutorial (quick start, 18 feature tours, `?` help on every page) and
notification-ready preferences.

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
[Tutorial system](docs/TUTORIAL_SYSTEM.md) · [Notification roadmap](docs/NOTIFICATION_ROADMAP.md) ·
[Test report](docs/TEST_REPORT.md)

`legacy/hm-training-plan.claude.html` is the untouched v2 that keeps working on claude.ai.
