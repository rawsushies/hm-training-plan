# Product reset audit (M0)

The source of truth is the owner's "Product Reset & Personal Running Coach Directive" (2026-11-18). Target journey:
**permitted data → understand my running → ask my coach → get a programme → adapt it as I train.**

The repo was inspected at branch `claude/charming-cori-ge7n37` @ 092e227 with a clean working tree.

Stack:
- Framework-free PWA: `public/index.html` plus classic scripts.
- Firebase Auth and Firestore record-level sync.
- Capacitor Android app, id `com.hmtrainingplan.app`.
- `node:test` unit tests, emulator rules tests and Playwright e2e.

Synced collections (`logic.js` `COLLS`): `runs`, `strength`, `checkins`, `shoes`, `reviews`, `plan`, `lab`. Device-local
items are the weather location and cache, gate state, device prefs and backups.

**Rule for every REMOVE/DEFER below:** only UI and navigation are removed. No persisted record is deleted, renamed or
migrated. Sync, `sanitizeState`, export/import and the Firestore rules keep handling every collection. This is regression-
tested by the e2e test "merged app: removed features … stored data is kept" and by the unit sync tests.

## Feature decisions

| Feature (where) | Decision | Reason / new home |
|---|---|---|
| Today hero: today's / next session, Selesai (`app5.js` `hero`) | **KEEP → Today** | The core daily path |
| Week ring + day bars vs plan | **KEEP → Today** | Answers "is my training consistent this week" |
| One key insight | **NEW → Today** | Directive: "one key insight" (top observation from the coach engine) |
| Weather panel + heat tips | **MERGE → Today session** (compact) | Only matters for the next run; source and age kept |
| Race countdown chip | **MERGE → Plan** (goal header); small link on Today | Race is a goal inside Plan |
| Lari tab: feed, heat map, volume chart | **MERGE → Coach › Bukti** | Evidence behind the coach, not a separate stats page |
| Activity detail / edit (`editLog`) | **KEEP** (opened from evidence and charts) | Drill-down to the underlying session |
| Quick manual log "Catat" | **KEEP → Plan session ("Tandai selesai" + numbers) and Coach › Bukti** | Runner-entered data is the one source that works and is permitted today; it is not file import |
| GPX/TCX/CSV file import UI | **REMOVE (UI)** | Owner rejects file import as the workflow. Imported runs stay. Parser code stays for tests and possible later removal. |
| Health Connect read | **KEEP → Settings › Sumber data** | Candidate permitted source; on-device analysis only; needs a device test |
| Strava backend scaffold (`functions/index.js`) | **DEFER / BLOCKED** | See `STRAVA_INTEGRATION_FEASIBILITY.md`; shown as "Diblokir" in Settings |
| Lab investigations (question → interview → scope → findings) | **REMOVE (UI)** | Directive: "not a research laboratory". The `lab` records stay synced and exported. |
| Lab analysis engine (`lab/analysis.js`: weekly/trend/compare/quality, permutation grading) | **KEEP → reused by the coach engine** | Deterministic, tested |
| PubMed/OpenAlex research panel (`lab/research.js`) | **REMOVE (UI)** | Directive. Module and tests stay unused until deleted in a later cleanup |
| AI consult contract (`lab/consult.js`, `functions/runlab-consult.js`) | **DEFER** | No permitted LLM provider/key; the coach answers with deterministic rules, labelled as such |
| Workout Compiler placeholder | **REMOVE** | Dead placeholder |
| Race strategy tabs (pace/splits/elevation/hydration/fuel/HR/stations/checklist) | **DEFER (hidden)** | Oversized subsystem. Plan keeps goal, date, target, forecast and readiness of volume. |
| Race event list/edit (`evList`, `evEdit`) | **KEEP → Plan › Tujuan** | The goal and date drive the plan |
| Race forecast (`race.js` predict) | **KEEP → Plan › Tujuan** | It already excludes the target as a forecast |
| Weekly schedule engine + availability (`schedule.js`, Jadwal) | **KEEP → Plan** | The programme |
| Calendar month/week, session detail, skip/unskip, reschedule | **KEEP → Plan** | Following and adapting the programme |
| Run timer / run mode ("Mulai") | **DEFER** | The app is not primarily for recording |
| Shoes (mileage, rotation, catalogue) | **DEFER (hidden)** | Not part of the coaching journey. Data kept. |
| Shoe catalogue workflow (`.github/workflows/shoes.yml`) | **DEFER** | Runs on a branch only; does not affect the app |
| Daily check-in, Siap/Beban scores, vessels, load-ratio dial | **REMOVED (v5)** | Directive: no readiness score from incomplete data, no single load ratio |
| Post-session effort / fatigue / pain check | **NEW (M4) → Plan session** | Directive E. Stored on the run as `rpe` plus the existing notes. |
| Friends, social, profiles directory | **REMOVED (v5)** | Social |
| Kiki companion, tutorials, help bubbles | **REMOVED (v5)** | Decorative |
| Strength / Elevation / Locked-in pages | **REMOVED (v5) → strength returns in Plan (M4)** | The directive wants strength programmes inside Plan |
| Goals & badges, monthly review, pace calculator | **REMOVED (v5)** | Duplicates / utilities. The pace calculator may return inside the session prescription. |
| Notifications / reminders | **KEEP → Settings** | Supports following the plan |
| Account, sync, backup/export, data reset | **KEEP → Settings** | Data safety |
| Settings: theme, units, profile (HR max measured) | **KEEP → Settings** | |
| Integrations page | **MERGE → Settings › Sumber data** | |
| About / update banner | **KEEP → Settings** | Release flow |
| Onboarding (availability) | **KEEP** | Feeds the plan |
| Login gate | **KEEP** | Accounts |

## Target information architecture

1. **Hari ini (Today):** today's or next session with the action; this week vs plan; one key insight; a compact
   weather note for the next run.
2. **Coach:**
   - Ask box with suggested questions.
   - Strengths / limitations / opportunities, each with evidence on demand.
   - Data coverage: what can and cannot be answered.
   - Evidence: charts and the run list, drilling down to a session.
3. **Plan:**
   - Goal (race or custom) with countdown and forecast.
   - This week's sessions with prescription, alternative and done/skip.
   - Calendar.
   - Availability.
   - Programme builder (M4).
4. **Settings** (secondary; gear icon in the header on phones, rail footer on desktop): data source (Health Connect /
   manual / Strava blocked), account and sync, reminders, theme and profile, backup, about.

Three primary destinations, as the directive targets. Settings is not a destination for the training journey.

## Screen / route mapping (current → target)

- `home` → Today
- `log`, `review` → Coach (evidence)
- `lab` → Coach
- `race`, `cal`, `jadwal` → Plan
- `more`, `settings`, `notif`, `integ`, `data`, `about` → Settings
- `shoes`, `pace`, `bareng`, `strength`, `recovery`, `locked`, `elev`, `goals`, `tutorials`, `guide`, `kamus` → redirect
  to Today, or to Plan for race-related routes

## Tests mapping

- Unit and rules tests are unaffected: data layer only.
- e2e tests covering removed UI (Lab interview and research, file import, shoes, race strategy tabs, Kamu tiles) are
  rewritten to the new destinations. Data-preservation assertions stay.

## Migration risks

| Risk | Mitigation |
|---|---|
| A synced `ui.tab` value from an older version points at a removed route | Route guard maps it to the new destination (`app5.js` redirect list) |
| Older app versions on other devices still write `lab` / `shoes` records | Collections untouched; rules unchanged |
| Hidden features' data looks "lost" to the user | Settings › Data lists record counts per collection and exports everything |
| Removing the import UI strands a user who relied on it | Disclosed in Settings › Sumber data; imported runs stay; Health Connect / manual remain |
