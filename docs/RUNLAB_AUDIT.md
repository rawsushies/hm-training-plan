# RUNLAB Milestone 0: audit of the current product

Audited on 18 Nov 2026 against `main` @ `52a89c4` (WeRunIt 4.0.1, package `4.0.1`), on branch `claude/charming-cori-ge7n37`,
restarted from that commit (the earlier `feat/werunit-v4` work is already merged into `main`). The working tree was clean.
Statements below are taken from code and test runs, not from READMEs. Status vocabulary:

- **implemented**: code exists and is reachable from the UI.
- **tested (emulator/mock)**: covered by unit, Firestore-emulator or Playwright tests here.
- **device-tested**: verified on a physical phone. Nothing in this repo claims that, and none was done in this session.
- **deployed**: live on `we-run-it.web.app` (hosting serves the release in `public/version.json`).
- **needs credentials**: blocked on an account, key, partner approval or a paid plan.

## 1. What works today (verified in code and tests)

| Area | Status | Where |
|---|---|---|
| Google sign-in (web + native Credential Manager → legacy fallback) | implemented, tested (emulator + Capacitor bridge mock), deployed | `cloud-firebase.js`, `test/e2e/native-auth.test.js` |
| Account-scoped offline storage (`hmtp:user:{uid}:v3`, `hmtp:anon:v3`), legacy `hmtp:v1` one-way copy | implemented, unit-tested | `logic.js` (`KEYS`, `migrateLegacyStorage`) |
| Record-level Firestore sync with rev+1 optimistic concurrency, conflict archive, merge3 | implemented, unit + rules + e2e tested | `sync.js`, `logic.js`, `firestore.rules` |
| First sign-in merge / use-cloud / keep-local, automatic backups `hmtp:backup:*` | implemented, e2e-tested | `index.html` (`PENDING_MIG`, `listBackups`) |
| Training plan (31 weeks), flexible schedule, replanning, race events | implemented, unit + e2e | `schedule.js`, `views-v4.js`, `index.html buildPlan` |
| Run log (manual, ✓ Selesai one-tap, timer), GPX/TCX/Strava-CSV import with duplicate review | implemented, e2e | `index.html`, `integrations.js`, `views-m4.js` |
| FIT import | **not implemented**; the UI says so ("File FIT belum didukung") | `index.html` |
| Strength, daily check-in (6 fields), monthly review, goals/badges | implemented | `index.html`, `ask.js` |
| Race workspace (weighted Riegel prediction with confidence, pacing strategies, splits, hydration/fuel/HR only from measured inputs, race sheet) | implemented, unit + e2e | `race.js`, `views-v4.js` |
| Shoes: mileage incl. initial km, rotation hint, embedded catalogue + weekly auto catalogue (`data-shoes` branch) | implemented, unit + e2e; the auto job is live in GitHub Actions | `shoes.js`, `views-m4.js`, `scripts/shoes/*`, `.github/workflows/shoes.yml` |
| Weather (Open-Meteo, explicit location, freshness labels) | implemented, e2e with mocked API; **live forecast not verified from the sandbox** | `weather.js`, `views-weather.js` |
| Friends by search (opt-in directory), per-friend sharing whitelist, shared goals, blocks | implemented, rules + e2e | `views-social.js`, `firestore.rules` |
| Android local notifications | implemented, tested through Capacitor's real bridge with a fake plugin; **not device-tested** | `notify.js`, `views-notify.js` |
| Health Connect read (runs, 30 days) | implemented, tested via bridge + fake plugin; **not device-tested** | `views-m4.js`, `@capgo/capacitor-health` |
| In-app live updates (web SW + native file swap with rollback) | implemented, e2e | `updater.js`, `sw.js`, `scripts/release.mjs` |
| 4.0 "quick app": 4-tab dock (Hari ini, Lari, Race, Kamu), Kiki companion chat, "Tanya Kiki" one-question flows, drum wheels | implemented, e2e | `app4.js`, `companion.js`, `ask.js` |
| Daily scores Siap / Beban / Tidur + load ratio | implemented, unit-tested, **heuristic** (see §5) | `scores.js`, `vessel.js`, `app4.js` |

## 2. Scaffolds, mocks and unverified assumptions

- **No AI or LLM backend exists.** `ask.js` ("Tanya Kiki") is a scripted question flow that writes to the existing records.
  `companion.js` (Kiki chat) shows pre-written tutorial and help text with typing animation. Neither calls a model.
- **No scholarly retrieval exists.** Score comments cite papers in code comments only; nothing is fetched or shown as a source.
- `functions/` is a **Strava OAuth/webhook scaffold**. It is not deployed (needs Blaze + Strava app). It must not become the
  RUNLAB backend (§11 of the directive: Strava data must not feed AI).
- Strava appears in two places: CSV import (`src: "Strava"`) and the undeployed scaffold. Both stay excluded from any future AI path.
- Notifications and Health Connect are not device-tested. Location permission for weather is not device-tested.
- `DESIGN.md` (4.0 graphite/race-orange) is newer than `docs/V4.md` and `docs/ARCHITECTURE.md` (v3 core + v4 pointer).
  The running CSS is `public/css/werunit.css` plus inline styles in `index.html`; treat those as the truth.

## 3. Data and features that must be preserved

Every collection and key in the schema map (`RUNLAB_MIGRATION_PLAN.md` §1): runs, strength, check-ins, shoes, reviews, plan
records (settings, goals, tutorial, raceCheck, schedule, profile, race prefs, plan map, overrides, status, locked, elev, events,
shareWith), local backups, conflict archive, legacy v1 copies, friends/shares/goals documents, the Firebase UID identity,
package `com.hmtrainingplan.app`, signing key, live-update channel. Also: offline use, ✓ Selesai, timer, import review, race
workspace, schedule editor, shoes, export/backup/restore.

## 4. Disposition of existing features (preserve / reposition / revise / retire)

| Feature | Decision | Reason |
|---|---|---|
| Hari ini hero (today's session, ✓ Selesai, ▶ Mulai, week dots) | **Preserve** | Fast daily path; the directive requires it stays fast. |
| One-tap body check (Segar/Oke/Capek/Nyeri) | **Revise (M2)** | It writes six specific check-in values the user never entered (e.g. "Segar" → sleep 5, energy 5). That is invented user-reported data feeding Siap. Store the tap as its own field (`quick: "segar"`), keep it out of 6-field analyses unless the full check-in was answered. |
| Siap / Beban / Tidur vessels, "Monitor badan", load-ratio dial | **Revise (M2)** | Heuristic composites shown as precise percentages. ACWR labels "Aman, sesuai kapasitas" / "Terlalu tinggi, kurangi" imply safety/injury thresholds. Calibrating state uses a default mean (3.6) that still yields a confident-looking number. Runs without a time use an assumed 390 s/km. See §5. |
| Target beban hari ini | **Revise or retire (M2)** | A prescriptive range derived from a heuristic. |
| Kiki companion + tutorial chat | **Preserve / reposition** | Useful onboarding and help; it must never be presented as AI analysis. |
| Tanya Kiki one-question flows | **Preserve; reuse the pattern** | The Lab interview reuses the one-question UX. |
| Lari feed, quick log, import | **Preserve → "Lari / Evidence"** | Becomes the evidence view; add source/coverage labels (M2). |
| Race tab | **Reposition** | Supporting capability: still reachable from Hari ini and Kamu, no longer a dock tab, so the Lab gets a first-class tab. |
| Race prediction | **Preserve** | Already excludes the target as a prediction (`source !== "target"`) and shows confidence. |
| Shoes, weather, friends, notifications, integrations, schedule, strength, reviews, goals | **Preserve** (under Kamu / contextual entry points) | Practical utility; no change needed for RUNLAB. |
| Legacy groups UI | **Already retired** (creation disabled, data kept) | — |
| Strava auto-sync scaffold | **Keep disabled** | AI use prohibited by Strava terms; never a RUNLAB connector. |

## 5. Risks in the current analytics formulas and labels (`scores.js`, `app4.js`)

1. **ACWR zones as safety bands.** `ratioZone` (`<0.8 low, 0.8–1.3 sweet, ≤1.5 high, >1.5 danger`) is shown as "Aman" (safe) and
   "Terlalu tinggi, kurangi" (too high, reduce). The ACWR–injury link is contested, and a single threshold does not establish
   safe load. Relabel as a descriptive ratio ("7-day load is 1.4× your 28-day average"), with no safety words.
2. **Siap (readiness) as a percentage.** A logistic squash of z-scores tuned so "a typical day lands near 58". The number reads as a
   measured state. During calibration it uses default mean 3.6 / spread 0.5. Show calibration as "not enough history" with no number,
   or present it as "relative to your recent check-ins".
3. **Estimated inputs in load.** A missing duration becomes distance × 390 s/km, and a missing RPE uses session-type defaults
   (`TYPE_RPE`). These are flagged internally (`est`), but the UI only says "Data masih tipis". The estimate method needs to be visible
   per day, and an opt-out is needed for analyses that require measured data.
4. **HR zones.** Used only with avgHR plus a stored HRmax in 120–230. The UI does not say whether that HRmax was measured. Require the
   profile's "HR maks terukur" (already labelled measured in onboarding) and show "HR-based" vs "RPE-based" per run.
5. **Quick body check** fabricates six user-reported values (§4).
6. **"Monitor badan"** shows ✓/! per signal against fixed thresholds (sleep ≥ 3 etc.). It is presented like a health monitor, and the
   thresholds are arbitrary. Reword as "your answers today" and drop the pass/fail marks.
7. **Strength sessions** add a fixed 25 min × 2.5 load. That is undisclosed; disclose it or show it separately.

None of these breaks data. All are presentation/method issues, scheduled for RUNLAB Milestone 2 ("audit and re-label existing scores").

## 6. Baseline test results on `main` @ 52a89c4 (this session)

See `docs/TEST_REPORT.md` (updated) and the numbers in the M0/M1 report. The suites run here were `npm test`,
`npm run test:rules`, `npm run test:e2e` (Firestore + Auth emulators, Chromium) and `npm run check:release`. Device tests: none.

## 7. Status of the §5 findings (RUNLAB 4.2, this branch)

| Finding | Status |
|---|---|
| 1. ACWR shown as "Aman" / "Terlalu tinggi, kurangi" | **Fixed**: descriptive wording only ("Di atas rata-rata 28 hari"), neutral colour, footnote "bukan batas aman atau prediksi cedera"; removed from the pass/fail check-in row. |
| 2. Siap percentage while calibrating | **Fixed**: `charge()` returns no score until ≥4 past full check-ins (unit-tested). |
| 3. Estimated inputs hidden | **Fixed (disclosed)**: Beban detail names the source per run (HR zone / RPE / estimate), the 6:30 /km assumption, and which days used estimates. RUNLAB analyses never use estimated values. |
| 4. HR zones without measured HRmax | Unchanged in code (already requires the profile's measured HRmax); now disclosed in the Beban detail. |
| 5. Quick body check invented six answers | **Fixed**: stored as `quickChecks[date] = {v}` (plan records `plan/quick_*`); never writes check-in fields; full check-ins unchanged (unit-tested). Older taps already saved as full check-ins cannot be told apart and are left untouched. |
| 6. "Monitor badan" pass/fail marks | **Partly**: renamed "Jawaban check-in", load ratio removed from it; per-answer marks remain as a reading of the user's own answers. |
| 7. Strength fixed load | **Disclosed** in the Beban detail. |
