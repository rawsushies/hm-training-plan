---
version: alpha
name: WeRunIt
description: >
  WeRunIt 4.0, the quick app. A race-day instrument for one runner: graphite surfaces, hairlines, one race-orange accent and bib numerals.
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

### WeRunIt 4.0: four tabs and a record button (`public/js/app4.js`)

4.0 is a quick app. A runner opens it, sees what to run, taps once, and closes it. Fewer things on screen, every
number paired with a shape. Older features stay reachable from **Kamu** (or from the tab they belong to) but never
compete with the core loop.

| Tab | Job | What is on it |
| --- | --- | --- |
| **Hari ini** (`home`) | What do I run today? | Date and race countdown chip; the **workout card**: today's distance as a bib numeral and the workout **shape** (one block per step, width = time, height = intensity, orange = hard part), ✓ Selesai (logs the planned distance) and ▶ Mulai (timer); after logging it becomes the result (km, pace, time, effort, a distance-vs-plan bar). Rest days say "Istirahat". Then the **one-tap body check** (four batteries: Segar, Oke, Capek, Nyeri), the week (progress bar + session dots), weather when set, and the next session with its shape |
| **Lari** (`log`) | What did I run? | This week as a big number and seven day bars (today orange); a **feed of run cards** like Strava: type, day, three big numbers (km, pace, time), a distance-vs-plan bar, effort as ten cells; links to Review and Kalender; Filter and Import folded at the bottom |
| **Race** (`race`) | Am I ready? | Countdown and the route line, plan completion ring, predicted finish against target (a forecast from runs, never the target echoed back), weekly volume, **records as medals** (longest, best pace, total, streak), consistency heatmap, then the race strategy workspace |
| **Kamu** (`more`) | Me and everything else | Account, three lifetime numbers, then one clean list: Latihan (hari lari, kalender, check-in, strength, locked-in, elevation), Gear & teman (sepatu, teman, goals), App (settings, notifikasi, integrasi, data, panduan, kamus, tutorial, tentang) |

- **Record button:** a 60px orange circle beside the dock opens **Catat lari**: the distance is prefilled from today's
  plan and set with −/+ 0,5 km (or typed), time is optional, effort is five bars (RPE 2/4/6/7/9), date defaults to
  today. One tap saves. "Isi detail lengkap" opens the full form (shoes, HR, notes, elevation).
- **One-tap body check** writes a normal check-in (sleep, soreness, fatigue, energy, motivation, pain), so readiness,
  reviews and sync work unchanged. The full six-question check-in stays under Kamu › Check-in.
- **Dock grouping:** calendar, hari lari, locked-in, elevation, strength and check-in light Hari ini; review and
  integrasi light Lari; pace and goals light Race; everything else lights Kamu.

### Daily scores: Siap, Beban, Tidur (`public/js/scores.js`, `public/js/vessel.js`)

Three 0–100 scores open Hari ini, each a **liquid vessel**: glass filled to the value, two travelling waves on the
surface, fine metal flake drifting in the liquid, the surface levelling when the phone tilts (where the browser
allows device orientation) and splashing on tap. One shared animation loop; a still frame under reduced motion.
Charts stay crisp; only gauges are liquid. Tap a vessel for its detail: a big vessel, 30 days of bars coloured by
band with a dashed AVG line, the band breakdown, and the drivers.

| Score | Answers | Model (published method) | Colour |
| --- | --- | --- | --- |
| **Siap** | How recovered am I? | Hooper-style wellness from the check-in as a robust z-score against the runner's own winsorized EWMA baseline (half-life 14), 0.65 weight; Banister freshness (CTL τ28 − ATL τ7), 0.35 weight; logistic squash anchoring a typical day near 58; pain ≥ 4 caps at 30 | green ≥ 67, yellow 34–66, red < 34 |
| **Beban** | How hard was today? | Session load = minutes × intensity (Edwards 5-zone on %HRmax when an average HR and the measured HRmax exist; otherwise Foster session-RPE ÷ 2; otherwise a per-type default), logarithmic `100·ln(load+1)/ln(2401)` | blue `#3aa0ff` |
| **Tidur** | How was my sleep? | Reported sleep quality (85%) plus seven-night consistency (15%) | violet `#8f86ff` |

- **Confidence tier** under each score: *Kalibrasi* (baseline still learning or no data), *Data masih tipis*
  (building), or nothing when solid. With no honest input the vessel stays empty and shows "–".
- **Target beban** for today follows Siap: green 60–80, yellow 45–65, red 0–40; a bar shows today's Beban against it.
- **Monitor badan:** five signals in a row (tidur, energi, pegal, nyeri, rasio beban) each with a green check or
  an amber "!", and a footer "n/5 sinyal dalam rentang".
- **Race tab:** *Kesiapan race* as a slowly turning wavy blob (plan completion and predicted finish inside) and
  *Rasio beban* as a dial (acute:chronic workload ratio, Hulin 2016; green 0.8–1.3, yellow to 1.5, red above).
- **Home layout (NOOP-style):** a purple-blue sky behind the header that fades into graphite (`body[data-tab="home"]`),
  the spaced WERUNIT wordmark, a dark score panel holding the three vessels ("SIAP ›") and the target-load bar, then
  the workout, body check and monitor, then **Kartu kamu**: rows with a mini vessel, an uppercase label, a sub-line,
  a big value and a chevron (rasio beban, kesiapan race, perkiraan finish, km minggu ini, streak).
- **Score detail:** 30-day bars with MEAN / MIN / MAX, a 17-week calendar heatmap, the band breakdown, **Cara kerja**
  (the model's weights as bars) and the drivers.
- Labels in this layer use uppercase tracked type (`.cap`), the sports-watch convention.
- The three-score structure, confidence tiers, logistic anchoring and the liquid-vessel idea follow NOOP's open
  documentation (github.com/ryanbr/noop, PolyForm Noncommercial). WeRunIt's implementation is independent
  JavaScript for its own data; no NOOP code or assets are used. Not medical advice.

### Data as shapes

| Shape | Data | Rule |
| --- | --- | --- |
| Workout shape (`workoutShape`) | The session's steps from the timer (`runSteps`) | Width = duration (estimated from distance when open-ended), height = intensity; warm-up/cool-down/rest in `text-faint`, steady running in `text`, hard work in orange |
| Distance vs plan (`vsPlan`) | Logged km against the session's planned km | 6px track; fill in `text`; an orange tick where the plan ends |
| Effort cells (`effortCells`) | RPE 1–10 | Ten cells; filled cells in `text-muted`, orange when RPE ≥ 8 |
| Battery (`battery`) | Body check level | Four bars down to one; a cross for pain; the chosen one takes its meaning colour |
| Medal (`medal`) | A personal record | Ribbon and disc; orange when the record is earned |
| Route line (`raceRoute`) | Weeks from start to race day | See Race |

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

## Brand surfaces (4.0)

- **Mark:** a stride "W" whose last leg keeps climbing into an arrow (`TRACK` + `CADENCE` in `brand.js`). Flat race
  orange on graphite, strokes only. White on the orange coach disc.
- **Wordmark:** WERUNIT in Barlow Condensed caps; the "IT" is orange. No gradient, no foil.
- **Boot:** mark draws in, wordmark rises, four lane segments (App, Versi, Akun, Data) fill orange as each real step
  finishes. Grey segment = skipped. No sentences.
- **Gate:** two numbered links, both required. 1 Google, 2 Health Connect (Android app only; on the web the row reads
  "Android" and is dimmed, and on a phone without Health Connect it reads "Tidak ada"). The app stays behind the gate
  until both are done. The only bypass is "Lanjut offline", shown only when there is no connection.
- **Kiki (companion bot):** a small sporty robot: white helmet head, black visor with two orange LED eyes that blink,
  orange headband with flying tails, antenna, graphite body with a "21" race bib, fists. Bobs gently; cheers on the
  last tutorial step. Drawn in `public/js/companion.js` (`mascot(cls, mood)`), used in the tour, help sheets and
  onboarding. Still under reduced motion.
- **Kiki chat (tutorial + help):** the tutorial is a chat with Kiki: avatar, name, "Title · 2/6", a progress line,
  then one message (typing dots, then a bold headline and a short line whose words land one by one), then reply chips
  (Ayo / Oke, lanjut / Siap, Lewati, ‹). Moods: wave on the first step, point when a target is highlighted, think when
  nothing is highlighted, cheer on the last step. Help sheets use the same chat: "Apa ini?" as one message, "Cara
  pakai" as numbered steps that slide in. Kiki's voice: first person, casual, one idea per line.
- **Coach card (old, replaced by Kiki chat):** a wide card docked above the tab bar, Kiki peeking over its top-left edge, a segmented
  progress line, "Title · 2/6", one line of copy, Lewati on the left and a round orange arrow on the right. Swipe left
  for next, right for back. No side tab, no speech-bubble tail.
- **Swipe dials:** any button row with three or more options (check-in 1–5, months, frequency and similar) is a
  horizontal drum; the chosen option sits in the orange lens; swiping and letting go picks the option in the lens.
- **Long text:** a paragraph over ~18 words becomes headline (first sentence, bold), sub-headline (second sentence,
  muted) and context (the rest, behind "Detail").
- **Gate skip:** on the Android app the Health Connect step offers "Lewati" for phones without it (e.g. Huawei).
- **Pickers:** every `<select>` renders as a drum wheel (swipe or tap a row; the orange lens marks the value). The real
  select stays in the DOM, invisible, so forms and handlers are unchanged. Day pickers are a week dial: seven days
  around a ring, selected days orange, the count in the centre.
- **Update strip:** a pill with the version number in an orange badge, two words, one button.

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
- Tour steps are one line (at most about 12 words). Help sheets carry only "Apa ini?" and "Cara pakai".
- Secondary screens: no hint paragraphs under fields; how-to text folds behind a "Cara" disclosure; things that are not
  available are a list of names with a status chip, not paragraphs.
- Cut in 4.0: Panduan latihan and Kamus istilah are no longer in the menu; the About page lost the motion demo and the
  how-updates-work essay.

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
- Scores: `public/js/scores.js` (pure, unit-tested in `test/unit/scores.test.js`); liquid vessels: `public/js/vessel.js`.
- 4.0 screens, record button, quick log and body check: `public/js/app4.js` (loaded after the other view modules,
  before `startApp()`). Shared pieces it reuses from `public/index.html`: `raceRoute`, `homeWeek`, `homeConsistency`,
  `bulletBar`, `chartBars`, `runSteps`.
- Icons and splash: regenerate with `node scripts/make-brand-assets.mjs` after any change to the mark (it reads
  `public/js/brand.js`; background `#141415`).
