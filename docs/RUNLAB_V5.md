# RUNLAB v5: WeRunIt + RUNLAB merged

One app, visual first. A number or a shape carries the meaning; labels are two or three words. The data model, sync,
migrations, offline support and Firestore rules are unchanged. The merge happens in the view layer:

- `public/js/v5/ds.js`: design-system primitives (`WRI_DS`).
- `public/js/v5/app5.js`: navigation, removed routes, and the Hari ini, Lari and Kamu views.
- `public/css/ds.css`: tokens and components, loaded last.

## Owner decisions (2026-11-18)

| Area | Decision |
|---|---|
| Kept | Run log, import, Lab, race plan and countdown, weekly schedule and calendar, shoes, weather, reminders, account/sync/backup, settings, integrations |
| Removed from the UI | Daily check-in and the Siap/Beban scores, strength, elevation, locked-in pages, friends, the Kiki companion and tutorials, monthly review, pace calculator |
| Data of removed features | Untouched: still stored, synced and exported (e2e test "merged app: removed features…"). Old deep links land on Hari ini. |
| Navigation | Hari ini · Lari · Lab · Kamu. Race, Jadwal, Sepatu, Pengingat, Integrasi, Data, Pengaturan and Tentang live in Kamu. |
| Direction | "Instrument": dark-first like a sports watch, one huge figure per block |
| Later | Strength and elevation slots stay free for future features |

## Design system "Instrument"

- **Colour roles:** orange `--acc` = action / current; teal `--pos` = done / positive; amber `--warn` and red `--bad` =
  warnings; slate `--mu` = context. No gradients, glass or glow.
- **Type:** figures in Barlow Condensed (tabular), sizes `xl` 112 / `l` 64 / `m` 40 / `s` 26. Labels are Inter 11 px caps.
  Page titles are Inter 34–44 px.
- **Surfaces:** a ground colour plus one panel colour (`--s1`), no borders by default. Dashed outline = "not set yet" or
  "planned".
- **Primitives:**
  - `fig(value, unit, label)`
  - `ring(v, max)`: draws no stub at 0.
  - `bars(items)`: plan as a dashed outline, actual as fill, current in orange; every bar has a tooltip.
  - `spark(vals)`
  - `meter(v, max, mark)`
  - `heat(cells)`: GitHub-style, weeks as columns.
  - `head(kicker)`
  - `ic(name)`
- **Honesty rules:** missing values draw empty tracks, never assumed ones. Weather keeps its source, age, model-vs-measured
  label and the reason behind each tip (folded).

## Views

- **Hari ini**
  - Race countdown ring.
  - Today's session as an xl figure plus a workout shape, with Selesai / Mulai. On a rest day it shows the next session.
  - Week ring (done/plan) and day bars with plan outlines.
  - Tiles: 12-week volume, pace sparkline, shoe meter, Lab continue card.
  - Weather panel: hourly feels-like bars with the run window highlighted.
- **Lari:** month figures, 12-week heat map (tap a day to filter), weekly volume vs plan, type chips, run rows (date, km
  figure, distance bar in type colour, pace), import fold.
- **Kamu:** compact account block (no mascot), lifetime figures, tiles to every kept page.
- **Catat:** one quick sheet. Fixed: an emptied distance used to save the default 5 km; it is now refused.

## Phases

1. **Done:** design system, shell, Hari ini, Lari, Kamu, removed routes, tests.
2. **In progress** (`js/v5/pages5.js`):
   - **Race, done:** countdown ring over the plan; finish time on one axis (target outline, forecast dot, range band);
     the whole build as plan-vs-actual bars; records as figures. The load-ratio dial and readiness blob are removed.
     The overview tab no longer prints the target as a big "Perkiraan finish" when no forecast exists.
   - **Sepatu, done:** a wear ring per shoe; rotation as one stacked bar with the suggestion and its reason.
   - **Still on the older layout** under the new tokens: Jadwal (already dial pickers), Kalender, Pengingat, Pengaturan,
     Data, Integrasi.
   - **Open owner question:** the plan still schedules strength sessions and Jadwal still has the strength-day picker.
     The owner asked to keep those slots for later features, so they are left in place.
3. **After:** the Lab adopts the primitives: fewer words, findings drawn first.

## Verification (this change)

- unit 106/106, rules 23/23, e2e 54/54, `check:release` 5.0.0 (local stamp only, not published). Phase 2 so far: e2e 54/54 again; shoe and race assertions updated to the new layout.
- Screenshots at 390×844, 768×1024 and 1440×900, dark and light: no horizontal overflow, no console errors.
- E2E rewritten:
  - Friends and tutorial tests are replaced by the removed-features test.
  - The glass-pill dock test is replaced by a solid four-tab dock test.
  - The Kiki Catat test is replaced by the quick-sheet test.
  - Strength, check-in, goals, locked-in, elevation and review steps are removed from the regression test; shoes and
    settings stay.
