# WeRunIt product reset: progress

Branch `claude/charming-cori-ge7n37`. Nothing has been deployed, merged or released.

## M0: audit (done)
- `docs/PRODUCT_RESET_AUDIT.md`: keep/merge/remove/defer for every feature, the screen→destination map and migration risks.
- `docs/STRAVA_INTEGRATION_FEASIBILITY.md`: **Strava blocked**. strava.com is unreachable from this sandbox, so the full
  policy text is unverified. Questions for Strava are drafted.
- `docs/PRODUCT_DECISIONS.md`: P1–P9.

## M1 + M2: structure, redesign and coach engine (done)
- **Navigation:**
  - Three destinations: **Hari ini · Coach · Plan**. Settings sits behind a gear on phones and in the rail on desktop.
  - Old routes redirect: `lab` and `review` → Coach; `shoes` and `integ` → Settings; `pace` → Plan; other removed pages → Hari ini.
- **Hari ini:** today's or next session; "Catat hasil" opens the quick sheet prefilled with the plan, which the runner
  confirms (no more one-tap logging of the planned distance); one key insight with "Lihat bukti"; week vs plan; weather
  panel.
- **Coach:**
  - Ask box with suggested questions and evidence-linked answers.
  - Observations grouped as Perlu diperbaiki / Peluang / Kekuatan / Stabil / Belum cukup data. Each opens to: measures,
    meaning, what to change, what to monitor, window, n, coverage, confidence.
  - Data coverage and the questions that cannot be answered yet.
  - Evidence: heat map, weekly volume vs plan, run list → run detail.
  - Empty state: one clear call to action.
- **Plan:** goal (countdown over the plan, distance, target, forecast-from-runs, change/edit, cancelled/postponed note);
  this week day by day with status (missed shows as "tidak tercatat", no guilt wording); next week folded; Kalender and
  Hari & jam lari.
- **Pengaturan:**
  - Account.
  - Data sources: manual connected; Health Connect with its "Ambil 30 hari" sync on Android; Strava **Diblokir** with the reason.
  - Reminders, theme/profile, backup, about.
  - Stored-data counts, including archived Lab, shoes and check-ins.
- **Engine:** `public/js/coach/model.js` (TrainingSession and providers) and `engine.js` (coach-1, see `docs/COACH_METHOD.md`).
- **Removed UI** (data kept): Lab investigations and research panel, file import, shoes, race strategy tabs, run timer.
- **Bugs fixed:**
  - The bottom bar showed behind the sign-in gate.
  - The legacy companion "chunker" rewrote long sentences into bold heads and "Detail" folds; it now skips v5 screens.

### Tests (exact)
- `npm test`: 116/116 (10 new coach tests on synthetic data).
- `npm run test:rules` via `npx firebase emulators:exec`: 23/23.
- e2e: 49/49.
  - New: `test/e2e/coach.test.js` (3 tests).
  - Rewritten: dock (three destinations), today log (confirmed sheet), Health Connect (now in Settings), removed-features
    redirects.
  - Removed with their UI: the Lab interview/research e2e, the GPX import e2e (the parser stays unit-tested in
    `logic.test.js`), shoes, integrations-web, shoe catalogue, race workspace tabs.
- `check:release` 5.1.0: verified (local stamp, not published).
- Screenshots captured and inspected:
  - Sizes 360×800, 390×844, 768×1024 and 1440×900, dark and light; with data and empty.
  - Pages: Hari ini, Coach, Plan, Pengaturan.
  - No horizontal overflow, no console errors.

## M4 (first slice, done)
- `public/js/coach/plan.js` (unit-tested in `test/unit/plan-coach.test.js`).
- **Prescriptions:** every planned session opens in Plan to show purpose, warm-up, main set, cool-down, intensity guide,
  a shorter version and the reason for the session.
  - Intensity is RPE-based.
  - A pace hint appears only when the runner has at least 4 recent runs rated RPE ≤ 4 with pace. It shows their own
    median and n. No zones are invented.
- **Adaptation:** a missed session gets a proposal with its reason. A long run moves to a free day that is not next to a
  hard session; anything else is let go.
  - It never doubles up and never adds load; a completed week proposes nothing.
  - "Terapkan" applies it (a session override or skip); "Biarkan" changes nothing.
- **"Catat hasil" per session:** opens the quick sheet prefilled from that session.
- **Tests:** unit 119/119, e2e 50/50 (new Plan e2e).

## Next
- M4 remainder: programme builder (running, endurance, strength, combined) with per-session purpose, warm-up, main set,
  cool-down and a shorter alternative; missed-session and fatigue adaptation proposed with a reason and applied only
  on confirmation.
- Post-session effort/fatigue/pain check in the quick sheet; pain → professional advice.
- Later cleanup: delete unused Lab, research, shoes and import view code once no test depends on it.

## Known blockers
- Strava: the policy has to be read in full and Strava has to answer the questions in writing (see the feasibility doc).
- Health Connect: needs a test on a real Android device, and a Play health declaration before a store release.
- AI coach: no permitted provider. The coach is deterministic (P4).
