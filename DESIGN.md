---
version: alpha
name: WeRunIt
description: >
  A race-day instrument for one runner: graphite surfaces, hairlines, one race-orange accent and bib numerals.
  Opening the app answers "am I on track for my race, and what do I run today?" with almost no reading.
colors:
  # Dark (primary theme) — graphite ramp
  bg: "#141415"
  surface-0: "#0f0f10"        # dock, deepest surface
  surface-1: "#19191b"        # cards, lists
  surface-2: "#232325"        # raised: inputs, active segment, chart tracks
  line: "rgba(237,237,237,0.08)"
  line-strong: "rgba(237,237,237,0.14)"
  text: "#ededed"
  text-muted: "#a1a1a6"
  text-faint: "#85858b"
  primary: "#FF5A1F"          # race orange: today, this week, your position, the active number
  primary-text: "#FF7A47"     # orange used as text on dark (6.8:1 on surface-1)
  on-primary: "#141415"       # ink on orange (5.9:1)
  button: "#ededed"           # primary button fill on dark
  on-button: "#141415"
  positive: "#4cc38a"
  caution: "#e2a336"
  negative: "#ec5b5f"
  # Light theme (same roles)
  light-bg: "#fafafa"
  light-surface-1: "#ffffff"
  light-surface-2: "#f4f4f5"
  light-text: "#171717"
  light-text-muted: "#525252"
  light-text-faint: "#737373"
  light-primary: "#EA580C"
  light-primary-text: "#C2410C"
  light-button: "#171717"
  light-on-button: "#ffffff"
  light-positive: "#15803d"
  light-caution: "#b45309"
  light-negative: "#dc2626"
  # Session types: muted, categorical, never decorative
  session-easy: "#7d9cc0"
  session-long: "#FF5A1F"
  session-recovery: "#7fb8a4"
  session-locked: "#e2a336"
  session-elevation: "#b48fbf"
  session-benchmark: "#ec5b5f"
  session-race: "#ededed"
  session-strength: "#8c8c93"
  session-rest: "#3a3a3e"
typography:
  bib:
    fontFamily: Barlow Condensed
    fontSize: 112px
    fontWeight: 600
    lineHeight: 0.8
  figure-lg:
    fontFamily: Barlow Condensed
    fontSize: 56px
    fontWeight: 600
    lineHeight: 0.85
  figure:
    fontFamily: Barlow Condensed
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1
  h1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.15
  h2:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  meta:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
rounded:
  sm: 8px
  md: 12px
  lg: 16px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
components:
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 16px
  tile:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    typography: "{typography.figure}"
    rounded: "{rounded.md}"
    padding: 14px
  button-primary:
    backgroundColor: "{colors.button}"
    textColor: "{colors.on-button}"
    typography: "{typography.label}"
    rounded: "10px"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "10px"
    padding: "12px 20px"
  chip-today:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.meta}"
    rounded: "6px"
    padding: "2px 8px"
  dock:
    backgroundColor: "{colors.surface-0}"
    textColor: "{colors.text-muted}"
    rounded: "999px"
    padding: 4px
motion:
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
  duration-press: 150ms
  duration-menu: 200ms
  duration-enter: 400ms
  duration-fill: 900ms
  press-scale: 0.98
  rise: 8px
  stagger: 50ms
---

# WeRunIt Design Bible

> Redesigned with the unslop process (unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0),
> with sports apps such as Strava and adidas Running as the reference point. The holographic purple glass of
> 3.11–3.15 is retired: no hue gradients, glows, glass or blobs anywhere.

## Overview

- **Product:** tells one runner in Indonesia, at a glance, whether they are on track for the BTN JAKIM Half Marathon
  (13 Juni 2027, 21,1 km) and what to run today. Any race event works the same way.
- **Character:** focused, gritty, encouraging.
- **World:** a road race at dawn: asphalt, lane lines, race bibs, split clocks. Graphite surfaces, one
  high-visibility race orange.
- **Moments:** (1) the race countdown with the route line from week 1 to the finish flag; (2) the weekly volume chart,
  with orange only on this week.
- **Signature:** bib numerals. Distances, paces, times and the countdown are set in Barlow Condensed, like a race bib and
  a split clock. Nothing else uses that face.

### Principles

1. **The data is the only bright thing.** Chrome (cards, lists, buttons, nav) is graphite with hairlines. Colour goes
   into the countdown, the route marker, this week's bar and status dots.
2. **One accent, a few percent of the screen.** Race orange marks today, this week, your position on the route and the
   one figure that matters. Never two oranges competing on one card.
3. **Labels, not paragraphs.** No page intros, no tips cards, no explanatory captions. A title, a figure, a label. The
   "why" lives behind the `?` help button and the tutorial.
4. **Numbers are set like a bib.** Big, condensed, tabular. Units sit next to them small and muted.
5. **One main chart per screen.** Everything else that shows data is smaller and different in kind: a progress bar, a
   heatmap, a list, plain number tiles.
6. **Calm motion.** One ease-out curve, short presses, one entrance. No springs that overshoot, no blur, no glow.

## Colors

- **Surfaces:** `bg` → `surface-1` cards and lists → `surface-2` for inputs, active segments and chart tracks; the dock
  sits on `surface-0`. Depth comes from these steps and 1px hairlines (`line`), not shadows. Light theme: the same
  roles, with a 1px `0 1px 2px rgba(0,0,0,.05)` shadow on cards.
- **Text:** three roles only: `text`, `text-muted`, `text-faint` (meta and axis labels only).
- **Accent:** `primary` (#FF5A1F dark, #EA580C light). Fills that carry text use `on-primary` ink (5.9:1 / 5.0:1).
  Orange as text uses `primary-text` (#FF7A47 on dark, #C2410C on light; both ≥ 5:1).
- **Primary button:** an off-white fill with ink text on dark, an ink fill with white text on light. Not orange: orange
  is saved for the data.
- **Semantic:** `positive`, `caution`, `negative`, toned to the palette, only for meaning (readiness, low check-in
  values, missed sessions). Notes show their meaning as a small leading dot, not a coloured panel.
- **Session types:** muted categorical colours, used as small dots and the thin stripe on log rows. Long run takes the
  accent because it is the key session of the week.
- **Banned:** hue-to-hue gradients, gradient text, coloured glows and shadows, radial washes, blobs, glass blur, holo
  foil. A gradient is allowed only as a tiny tone step inside one neutral.

## Typography

- **Inter** for the interface: titles 600, body 400, labels 500. Sentence case everywhere; no uppercase tracked labels.
- **Barlow Condensed 600** for figures only (`.num`, tiles, countdown, prediction, bullet values): the bib signature.
- Countdown 112px; next-workout distance and race prediction 56px; tile figures 30px; bullet values 28px.
- Units next to figures: Inter 13px 500 in `text-muted`.
- Letter spacing 0 below 16px. No italics for emphasis.

## Layout

Mobile-first single column, 16px gutters, 4px grid. Same thing, same size: one card padding (16), one tile padding
(14), one list row height.

### Beranda (`vHome`, `cockpit`)

1. **Hero (moment 1):** "Week 11 dari 31 · Elevation", readiness chip, `?`. The countdown in bib numerals with
   "hari lagi ke BTN JAKIM Half Marathon". Date, distance, target. The **route line** (`raceRoute`): a course from week 1
   to a chequered finish flag; walked weeks drawn in `text`, the rest in `line-strong`; week dots solid when ≥ 80% of
   planned km was run, grey when partial, hollow when empty; you are the orange marker.
2. Two quiet actions: Catat lari, Check-in.
3. Weather card (when relevant).
4. **Volume mingguan (moment 2, the main chart):** 8 weeks, plan as a dark track, actual in `text-faint`, this week in
   orange; this week's km in the header.
5. Tren pace (small line), Aktivitas terakhir (list).
6. Hari ini, then the week: a progress bar (orange, the only accent bullet) and the 7-day session dots (done = filled
   off-white with a check, today = orange ring, upcoming = hairline circle, missed = dashed red with ✕).
7. Workout berikutnya: distance as the figure, one line of type, Mulai timer + Catat.
8. Badan kamu: 14-day check-in rows in neutral bars, low values in `caution`.
9. Progres kamu: six number tiles, no mini charts.
10. Konsistensi: 8-week heatmap; run days in `text` shaded by distance, missed sessions dashed, today ringed orange.
11. Target bulan ini: two progress bars against the block plan; tap for the review.

### Other screens

| Screen | Leads with |
| --- | --- |
| Latihan | Month progress bars (km, sessions), then the calendar; days you ran are a raised cell, today is an orange chip |
| Aktivitas | Totals tiles, 12-week km bars, the session share as one stacked bar in neutral steps by rank; import folded into one row |
| Check-in | 14-day check-in rows, the 1–5 inputs, the readiness ring in its semantic colour |
| Review | Progress bars and number tiles for the block; each chart in its own card |
| Race | Event card with the countdown, prediction as a 56px figure; method, data and limits folded into "Cara hitung" |
| Menu | Account, then grouped tiles (Latihan, Badan & progres, Belajar, Akun & data) with muted line icons |

## Elevation & Depth

Dark: surface steps and hairlines only. Light: a single small neutral shadow on cards. No glass, no backdrop blur, no
inner white highlights except the faint `inset 0 1px 0 rgba(255,255,255,.12)` on the primary button.

## Shapes

Cards and panels 16px, tiles and notes 12px, buttons and inputs 10px, small buttons and calendar cells 8px, chips 6px.
The dock and segmented controls are pills. Nested radius = outer − padding, never below 4.

## Components

- **Card / list (`.card`, `.rows`):** `surface-1`, hairline, 16px radius, 16px padding.
- **Number tile (`.stile`):** label (13px muted), figure (30px bib), unit. Nothing else.
- **Progress bar (`bulletBar`):** 8px track in `surface-2`, plan in a lighter neutral with a tick at its end, actual in
  `text`; `key: true` makes the actual orange (only the home week bar).
- **Session dot (`.sdot`):** see Beranda › week.
- **Note (`.note`):** `surface-1` panel with a 6px leading dot in the note's meaning colour.
- **Buttons:** primary off-white / ink; secondary `surface-2` with hairline; 44px tall, 36px for small.
- **Dock:** `surface-0` pill; the active tab sits on a `surface-2` indicator. Its two-ended spring is the one motion
  exception (unit-tested in `test/unit/motion.test.js`).
- **Legend (`lgd()`):** two small squares, "Target" and "Aktual", instead of a caption sentence.

## Motion

One curve: `cubic-bezier(0.22, 1, 0.36, 1)`. Press 150ms with scale 0.98; menus 200ms; entrances 400ms fade and 8px
rise, at most one per screen with a 50ms stagger; ring and bar fills 900ms. Transition colour, background, border,
opacity and transform only. The old `--ease-pop*` tokens now resolve to the same ease-out curve. Respect
`prefers-reduced-motion`.

## Data visualisation

- One main chart per screen, the biggest data object on it.
- Marks are neutral; orange goes only on the current period or your position.
- Plan versus actual: plan as a dark track, actual in a lighter neutral.
- Shares are one stacked bar in neutral steps (largest share brightest), with percentages in the legend.
- Stat tiles are numbers only: no sparklines, no mini bars.
- Axis labels Inter 9–11px in `text-faint`; at most three x-axis labels where space is tight.

## Copy

- Bahasa Indonesia, casual, second person, short. Titles name the place or period ("Log Lari", "Week 11"), never a
  greeting.
- No page intros, tips cards or captions that explain a chart; explanations go behind `?`.
- No emoji in the interface; ✓ is allowed as a check mark. No exclamation marks.
- Buttons are verbs: Mulai, Catat, Simpan, Urungkan.
- Chart words: bar, garis, titik. Describe marks by role ("Target", "Aktual"), never by a colour.
- Safety copy (pain, injury) stays, shortened to one sentence that still says rest and see a professional.

## Accessibility

- Text contrast: `text` 15:1, `text-muted` 6.8:1, `text-faint` 4.8:1 on `surface-1` (dark); light equivalents ≥ 4.7:1.
- Orange text uses `primary-text`; ink on orange fills.
- Every chart has an `aria-label` with its numbers; the route line names the current week.
- Focus ring: 3px orange at 22% around inputs; 2px outline on interactive cards.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| Put colour in the data | Tint cards, buttons or navigation |
| Use orange once or twice per screen | Make every highlight orange |
| Set figures in bib numerals | Use the bib face for labels or paragraphs |
| Write a label | Write an intro paragraph or a tips card |
| Show one main chart | Put a mini chart in every tile |
| Use a hairline | Use a glow, a glass blur or a gradient |
| Fold method and footnotes into a disclosure | Leave long explanations open on the screen |

## Source of truth

- Tokens: `public/css/werunit.css` (`:root` and `[data-theme="light"]`) and the "v6 race layer" at its end.
- Fonts: Inter and Barlow Condensed via Google Fonts in `public/index.html`.
- Logo mark: `public/js/brand.js` (flat race orange); notification accent: `public/js/notify.js`.
- Home: `vHome`, `cockpit`, `raceRoute`, `homeWeek`, `homeNext`, `homeBody`, `homeProgress`, `homeConsistency`,
  `homeBlock` in `public/index.html`.
- Icons and splash: regenerate with `node scripts/make-brand-assets.mjs` after any change to the mark (it reads
  `public/js/brand.js`; background `#141415`).
