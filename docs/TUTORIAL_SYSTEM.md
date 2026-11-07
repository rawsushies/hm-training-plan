# Tutorial system (v3)

Content: `public/js/tutorial.js`. Engine: "Tutorial v3" section of `public/index.html`.

## Layers

1. **Quick start** (6 steps): what the app does, the dashboard, this week, next workout + timer,
   logging a run, where to get help.
2. **Feature tours** (18): dashboard, calendar, log, import, timer, locked-in, elevation, strength,
   check-in, monthly review, race plan, shoes, goals & badges, pace calculator, data & backup,
   account & friends, settings, notifications. 2–7 steps each.
3. **Contextual help**: a `?` button in the header of every page opens a sheet with *Apa ini? /
   Kenapa ada? / Cara pakai / Contoh / Perlu diingat*, plus *Mulai tur fitur ini*.

Hub: *Menu → Tutorial & bantuan* lists every tour (done ✓, Mulai/Ulangi), every help page, and a reset.

## Step format

`{tab, sel, t, b}`: the page to open, the `data-tour` value of the element to highlight (or `null`),
the title and the body. Text was written against the actual behaviour of each feature (e.g. readiness
thresholds 3.8 / 2.8, the "pain ≥ 4 means rest" rule, ±7-day session matching, 150 m duplicate
tolerance, 7-day single-use invites). Change a feature → update its tour and help entry.

## Behaviour

- Navigates to the step's page, scrolls the target into view and outlines it (`.tour-hl`).
- Placement: the engine computes where the target can be scrolled and puts the bubble at the bottom or
  the top, whichever covers less. While a tour runs, the page gets extra bottom space so the last
  element can still scroll clear. Short screens (landscape phones) get a compact bubble. Tested at
  320×640, 390×844, 844×390 and 1280×800.
- Missing target (e.g. no runs logged yet): the bubble stays and shows a short fallback note.
  Calendar steps pick a day that has sessions.
- Controls: Lanjut / ‹ Balik / Lewati (quick start) / × (close) / Semua tutorial, progress dots, and
  "Langkah N dari M". Escape closes.
- **Resume:** the current step (`S.ui.tut`) is device-local, so a reload resumes the tour.

## Versioning & per-account progress

- `S.tutorial = {v:3, quick, tours:{id:true}, bannerDismissed}` is a synced record (`plan/tutorial`),
  so progress follows the **account** across devices. Anonymous use has its own copy in the anonymous slot.
- Start policy (`HMTP.tutorialStartMode`):
  - never saw any tutorial → quick start opens automatically once;
  - completed the v2 tour (`ui.tourDone`, `tourV = 2`) → a non-blocking **banner** on Home
    ("Tutorial baru dari Kiki", Mulai / Nanti aja) instead of an interruption;
  - quick start seen (finished *or* skipped) or banner dismissed → never auto-opens again.
- Feature tours are only marked done when finished, and can be replayed any time.
