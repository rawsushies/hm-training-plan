# RUNLAB visual direction

The Lab is a **running research instrument**: the chart is the content, the numbers are expressive, and every mark is real data
or plainly labelled empty. One token system and one interaction grammar for the whole of WeRunIt; the Lab is where it is most
developed.

## 1. What we take from each reference (principles only, no copying)

| Reference | Principle we take | What we do not take |
|---|---|---|
| WHOOP | A few key figures with strong hierarchy; summary → detail drill-down; signal colour only where it means something | Proprietary scores, readiness percentages, neon, upsell |
| Strava training log | Weekly rhythm at a glance; date navigation; filters change the data; tap through to the activity | Orange brand, social feed priority |
| Intervals.icu | Large legible charts as the main content; multiple series; selected-point readout; link from chart point to activity | CTL/ATL/TSB or any copied load model |
| Apple Fitness | Immediately understandable summary; grouped metrics; big touch targets | Ring-closing gamification |
| Linear | Quiet navigation; predictable header/action placement; restrained separators; density without clutter | A reskin; WeRunIt needs expressive sports charts |
| Shared dashboards (owner's moodboard) | Stat tiles with icon + figure + delta; big weekly-mileage bar chart with a callout; side calendar | Fabricated predictors, zone rings without HR data |

## 2. Decisions

- **Dark-first ink**: Lab surfaces sit one step deeper than the app (`--lab-bg`) with raised panels (`--lab-panel`) separated by
  1 px hairlines. Elevation comes from contrast and borders, not blur.
- **One action accent**: WeRunIt race orange (`--acc`) for the primary action and the *current/selected* data point only.
- **Data series** (`--sa` orange, `--sb` blue, `--sc` teal): comparisons are always orange vs blue; teal for secondary series.
  Status colours (`--ok/--warn/--bad`) are reserved for adequacy and data quality.
- **Figures**: Barlow Condensed 600 with tabular numerals for every metric; units are small and muted beside the figure.
- **Glass**: the frosted spring pill in the nav and segmented controls is the single sanctioned glass element (owner's motion spec).
  Everything else is solid. The CSS overrides that already flatten `.glass/.card` stay; `DESIGN.md` now says so.
- **Gradients**: none on buttons, cards or charts. The only gradient is a faint lane/trace fade in the Lab hero.
- **Motif**: the hero draws the runner's own recent pace trace (real runs). With no data, it shows a plain track lane, marked `aria-hidden`.
- **Honesty states**: capability chips show real runtime state (analysis available offline; research needs a connection; AI not configured).

## 3. Tokens (added to `public/css/werunit.css`, dark | light)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--lab-bg` | `#0e0f11` | `#f4f4f5` | Lab canvas |
| `--lab-panel` | `#16171a` | `#ffffff` | panels |
| `--lab-panel-2` | `#1f2024` | `#f1f1f3` | raised controls, tiles |
| `--lab-grid` | `rgba(237,237,237,.07)` | `rgba(23,23,23,.07)` | chart grid |
| `--sa` / `--sb` / `--sc` | `#FF5A1F` / `#5aa9ff` / `#5fd0ae` | `#EA580C` / `#2563eb` / `#0f9a7a` | series |
| Radius | 18 px panels, 14 px tiles, 999 px chips | | |
| Spacing | 4-pt scale: 4 / 8 / 12 / 16 / 24 / 32 | | |
| Motion | press 0.97 scale over 120 ms; selection 200 ms ease-out; nothing loops; all off under reduced motion | | |
| Touch | ≥ 44 px targets; answer tiles ≥ 56 px | | |

## 4. Layout sketches

Mobile (390):
```
[ Lab · Personal Running Lab            ? ]
[ hero: "Ajukan pertanyaan yang lebih baik…"  ~~pace trace~~ ]
[ composer ................................ [Mulai] ]
[ starter tiles 2×3 (icon + type + question) ]
[ capabilities: ● Analisis lokal  ○ Riset (online)  ○ AI (belum diatur) ]
[ Bukti kamu: 3 figures | weekly bars (tap = readout) | coverage bars ]
[ Investigasi: state badge + question + mini progress ]
[ Alat: Workout Compiler — Segera hadir (disabled) ]
[ dock: Hari ini · Lab · Lari · Kamu ]
```
Desktop (1440): the existing left rail plus a 2-column Lab grid. The left column holds the hero, composer, starters and
investigations. The right column is a sticky "Bukti kamu" panel. The investigation page uses a main column (stepper, current
question / findings with large charts) and a right inspector (scope, coverage, method details).

## 5. First screens

1. Lab home (hero, composer, starters, capabilities, evidence panel, investigations).
2. Investigation (stepper, tile answers, why-expander, editable answers, evidence visuals, run analysis, findings with charts and
   inspector, research section).
3. Shared chart components: weekly timeline, pace trend dot plot with IQR, two-group comparison, coverage bars.
