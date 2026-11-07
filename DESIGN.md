---
version: alpha
name: WeRunIt
description: >
  Visual-first race-progress monitor. One glance tells you where you stand on the road to your race
  (default: BTN JAKIM Half Marathon, 13 Juni 2027); one tap tells you more. Dark-first, glass surfaces,
  holographic accent, quick and physical motion.
colors:
  # Surfaces (dark is the primary theme)
  bg: "#13131C"
  surface-1: "#1C1B2A"
  surface-2: "#262539"
  glass: "rgba(235,235,255,0.07)"
  glass-border: "rgba(235,235,255,0.15)"
  border: "rgba(235,235,255,0.11)"
  # Text
  text: "#F6F4FF"
  text-muted: "#A8A5BB"
  text-faint: "#77758A"
  # Brand
  primary: "#9673FF"
  primary-text: "#B9A4FF"
  on-primary: "#14102B"      # dark violet ink: 5.4:1 on primary, 7.5:1 on blue. Light theme: #FFFFFF on #7552F0
  blue: "#65A7FF"
  cyan: "#79E5DE"
  pink: "#F18CD5"
  silver: "#F0EEFF"
  # Readiness states (the only colours that carry meaning on the hero)
  state-ready: "#7BE38A"
  state-steady: "#79E5DE"
  state-caution: "#FFB86B"
  state-alert: "#FF7A85"
  state-idle: "#4A4860"
  # Session types (calendar, log, charts)
  session-easy: "#65A7FF"
  session-long: "#9673FF"
  session-recovery: "#79E5DE"
  session-locked: "#FFB86B"
  session-elevation: "#F18CD5"
  session-benchmark: "#FF7A85"
  session-race: "#F0EEFF"
  session-strength: "#4FD1C5"
  session-rest: "#4A4860"
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 84px
    fontWeight: 700
    lineHeight: 0.82
    letterSpacing: -0.05em
  ring-number:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
  stat-number:
    fontFamily: Space Grotesk
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
  h1:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: 650
    lineHeight: 1.2
  h3:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: 650
    lineHeight: 1.25
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.45
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.06em
rounded:
  sm: 11px
  md: 16px
  lg: 22px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 56px
components:
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 18px
  glass-surface:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 16px
  dock:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: 4px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.h3}"
    rounded: "{rounded.md}"
    padding: "14px 20px"
  fab:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    size: 56px
  chip-session:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  tile-metric:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    typography: "{typography.stat-number}"
    rounded: "{rounded.lg}"
    padding: 16px
  sheet:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "8px 18px 24px"
# --- WeRunIt extensions (not part of the base DESIGN.md spec) ---
gradients:
  holo: "linear-gradient(115deg,#F0EEFF 0%,#9673FF 26%,#65A7FF 48%,#79E5DE 70%,#F18CD5 88%,#FFE2C6 100%)"
  ring-progress: "conic, in oklab: #9673FF → #65A7FF → #79E5DE"
  ring-recovery: "conic, in oklab: #3FB950 → #7BE38A → #D7F25C"
  ring-effort: "conic, in oklab: #FFB86B → #F18CD5 (hatched below target)"
  ring-sleep: "conic, in oklab: #5B4BFF → #9673FF → #B7C7FF"
  screen-tint: "radial-gradient(125% 125% at 50% 0%, #13131C 40%, <state colour at 18%> 100%)"
  hero-glow: "radial-gradient(closest-side, <state colour at 36%>, <state at 15%> 35%, <state at 4%> 70%, transparent)"
  grain: "SVG feTurbulence noise, 4–6% opacity, overlay blend"
motion:
  # Durations: open/enter uses the named token, close/exit uses the next step down.
  duration-instant: 100ms
  duration-quick: 150ms
  duration-base: 250ms
  duration-moderate: 350ms
  duration-slow: 500ms
  duration-fill: 900ms
  duration-reel: 1400ms
  # Easings
  ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
  ease-out-expo: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-sheet: "cubic-bezier(0.32, 0.72, 0, 1)"
  ease-in-out: "cubic-bezier(0.65, 0, 0.35, 1)"
  ease-pop-soft: "cubic-bezier(0.34, 1.35, 0.64, 1)"
  ease-pop: "cubic-bezier(0.34, 1.45, 0.64, 1)"
  ease-pop-strong: "cubic-bezier(0.34, 1.96, 0.64, 1)"
  # Springs, as WRI_MOTION.springF(omega, zeta)
  spring-pill-lead: { omega: 19, zeta: 0.55 }
  spring-pill-trail: { omega: 11, zeta: 0.72 }
  spring-morph: { omega: 14.1, zeta: 0.85 }
  spring-panel: { omega: 17.3, zeta: 0.87 }
  spring-digit: { omega: 30.6, zeta: 0.98 }
  # Distances and depth
  distance-sm: 8px
  distance-md: 12px
  distance-lg: 16px
  scale-enter: 0.96
  scale-press: 0.96
  blur-enter: 2px
  blur-max: 8px
  stagger-text: 40ms
  stagger-list: 50ms
  stagger-digit: 70ms
---

# WeRunIt Design Bible

## Overview

WeRunIt is a **race-progress monitor**, not a training spreadsheet. A runner opens it, sees in under two seconds
whether they are on track for their race, and closes it. Everything else (logging, plans, shoes, friends) is one tap
behind that answer.

- **Primary race:** BTN JAKIM Half Marathon, 13 Juni 2027 (21.0975 km). Any race event works the same way.
- **The question the app answers:** "Am I ready, and what do I do today?"
- **Interaction promise:** *One tap to know. One tap to act.* No form-filling to see your status, and no button whose
  purpose needs a label to explain it.
- **Feel:** a calm, dark instrument panel that comes alive under your thumb. Glass that floats, numbers that pop in,
  rings that fill.
- **Language:** UI copy is Bahasa Indonesia, casual and warm (Kiki's voice). This document is in English.

### The one-tap rule

| Depth | What the user sees | How they got there |
| --- | --- | --- |
| 0 taps | Readiness hero: race countdown, readiness %, today's session, one sentence of coaching | Opening the app |
| 1 tap | Detail sheet for whatever they tapped (a ring, a card, a chart) | Tap anywhere meaningful |
| 2 taps | An action completed (start session, log run, mark done) | Primary action in the sheet |

If a common task needs three taps, the design is wrong. If a screen needs a button to explain another button,
the design is wrong.

### Principles

1. **Charts carry the information.** Every section opens with a visual (ring, bar, dot strip, heatmap, sparkline); the
   number sits on it as a label; text is one line that names the chart or says what to do. A number never stands alone
   in a grid of numbers, and a list of facts becomes a chart before it becomes a table.
2. **The whole card is the button.** Cards, rings and chart tiles are tap targets. No "Lihat detail" links, no
   chevron-only hit areas. An arrow glyph (→) in the top-right only signals "this opens".
3. **One primary action per screen.** It lives in the floating `+` (or the hero's single CTA). Secondary actions live
   inside sheets, never on the surface.
4. **Colour means state.** Brand colours decorate; state colours carry meaning. Never use red or amber for decoration.
5. **Compare to *you*.** Every metric shows today against your own 30-day range, labelled `normal`, `lebih rendah`
   or `lebih tinggi`.
6. **Calm at rest, alive on touch.** Motion answers the user or new data. No looping decoration on data screens.
7. **Offline is normal.** Show the last known state with a quiet timestamp ("Diperbarui 08:06"), never an error wall.

## Colors

Use the token role (`{colors.primary}`), never the hex literal, when building components. Dark is the primary theme;
the light theme lives in `public/css/werunit.css` under `[data-theme="light"]` and keeps the same hierarchy.

### Layers

```
bg (#13131C)            app background, with the screen tint
└ surface-1 (#1C1B2A)   cards
  └ surface-2 (#262539) ring tracks, inset wells, chart backgrounds
glass                   anything floating over content: dock, sheets, segmented pills, toasts, the + button
```

### State colours

Use exactly one state colour per hero. The ring gradient, the hero glow, the status dot and the coaching headline
share it.

| State | Token | When | Example copy |
| --- | --- | --- | --- |
| Ready | `state-ready` | Readiness ≥ 67 %, on plan | "Siap gas. Tempo 8 km hari ini." |
| Steady | `state-steady` | 34–66 %, within range | "Normal. Lari santai aja." |
| Caution | `state-caution` | < 34 %, or ≥ 1 key session behind | "Pelan dulu. Tidurmu kurang." |
| Alert | `state-alert` | Pain flag, ≥ 2 key sessions missed, race-week risk | "Ada nyeri? Istirahat dan cek lagi besok." |
| Idle | `state-idle` | No data yet, rest day | "Hari istirahat. Nikmati." |

### Gradients and texture

Techniques taken from patterncraft (radial glows, fade-masked grids), feralui (pinned mesh spots, oklab blending,
noise) and neat (animated gradient fields with grain, vignette and bloom):

- **Holo** (`gradients.holo`) is the brand foil: the logo, the "It" of the wordmark, the race-progress ring and the
  active dock icon. Nowhere else.
- **Screen tint** (`gradients.screen-tint`): a 125 % radial glow from the top centre, `bg` until 40 %, fading into the
  current state colour at about 18 % strength. It tells you the day's verdict before you read anything (reference: the
  green readiness screen). It cross-fades in `duration-slow` when the state changes.
- **Hero glow** (`gradients.hero-glow`): a multi-stop `closest-side` radial glow behind the hero number. Use three or
  four stops (36 % → 15 % → 4 % → 0) so the falloff looks like light, not a disc.
- **Ring gradients** are conic, interpolated `in oklab` so the mid-tones stay bright, light at the head so the ring
  reads as moving forward.
- **Grain** (`gradients.grain`): 4–6 % noise over any large gradient to stop banding on OLED screens.
- **Empty chart wells:** a faint 22 px dot grid (`radial-gradient(border 1px, transparent 1.25px)`), masked to fade at
  the edges. It shows "data goes here" without looking broken.
- **Living gradient** (neat-style animated field, 16 fps, film grain, vignette): only on the onboarding hero, the
  race-day screen and the finish celebration. Never on data screens. Pause it when the tab is hidden or the battery is
  low, and replace it with the static screen tint under reduced motion.
- Never place a gradient behind body text. Text sits on solid or glass surfaces.

### Contrast

Body text ≥ 4.5:1 on its surface; numbers and labels ≥ 3:1. `text-faint` is for timestamps and axis ticks only.
State is never shown by colour alone: pair it with a word or an icon.

## Typography

Two families: **Space Grotesk** for display and all numbers, **Inter** for reading.

- **Numbers are the heroes.** Big, tight and tabular (`font-variant-numeric: tabular-nums`) so digits don't jump
  while they animate. Units are set at 45–55 % of the number's size, on the same baseline, in a muted colour:
  `76`<sub>%</sub>, `64`<sub>bpm</sub>, `5:42`<sub>/km</sub>.
- **Hierarchy per card:** `label-caps` (what it is) → number (the value) → `meta` (comparison or timestamp). At most
  three type sizes in one card.
- **Coaching text** is `body-md`, at most two sentences on the surface; the full insight opens in a sheet.
- Headline pattern: `Hari ini, 7 November ▾`. The date *is* the control.

## Layout

- Mobile-first, single column, 16 px gutters, 4 px grid. Max content width 520 px; on desktop centre it and keep the
  side nav (`nav.side`).
- **Vertical rhythm:** 12 px between cards in a group, 32 px between sections. Section titles are `h2`.
- **Thumb zone:** primary actions in the bottom third. Only the date and avatar in the top 15 %.
- **Bottom safe area:** content scrolls under the dock:
  `padding-bottom: calc(64px + 24px + env(safe-area-inset-bottom))`. A progressive blur (stacked blur layers with
  gradient masks) fades content as it passes under the dock.

### Home screen order (fixed)

Every block below leads with a chart. Built in `vHome()` (`public/index.html`).

1. **Readiness hero:** race countdown, readiness from today's check-in, and the 31-week volume strip (plan bars,
   actual fill).
2. **This week ring:** km done vs target, with one primary action (Mulai).
3. **Today:** today's sessions.
4. **Week strip** (`homeWeek`): a bullet bar of km vs target, then seven day columns with one dot per session, coloured
   by type: filled = done, ringed = today, outlined = upcoming, dashed red = missed. Tap a dot to open the session.
5. **Next workout** (`homeNext`): distance as the big figure, type dot, two-line description, Mulai timer + Catat.
6. **Body** (`homeBody`): 14 days of check-ins as four rows of small bars (sleep, energy, soreness, pain; soreness and
   pain flipped so a taller bar is always better).
7. **Progress tiles** (`homeProgress`): total km, runs, longest run, best pace, elevation, streak. Each tile is a
   value on its own 8-week mini chart.
8. **Consistency** (`homeConsistency`): 8 weeks × 7 days heatmap: run days in the session colour, missed sessions
   dashed, planned days outlined, today ringed.
9. **Month target** (`homeBlock`): two bullet bars (runs, km) against the block plan; tap for the review.

Shoes, friends, plans and settings live in Menu.

### Other screens

Shared primitives carry the system everywhere: lists (`.rows`), tables (`.t-wrap`), the account box and chart panels
(`.vchart`, `.vglass`) are glass; stat grids (`.stats`) are separate glass tiles; notes are tinted panels with no side
rail; inputs are 44px with a `primary` focus ring. The chart-first screens:

| Screen | Leads with |
| --- | --- |
| Latihan (`calMonth`) | Bullet bars for the month's km and sessions; calendar days you ran fill with that run's session colour |
| Aktivitas (`logSummary`, `logRow`) | Totals tiles, 12-week km bars, the session-type mix bar; each log row carries a distance bar in its type colour |
| Check-in (`vRecovery`) | The 14-day check-in rows, a readiness ring in the result, and six mini bars per history entry |
| Review (`vReview`) | Bullet bars for km, sessions, longest run and strength against the block plan; stat tiles for pace, benchmark, elevation and check-in score; every chart in its own glass panel |
| Menu (`vMore`) | Grouped icon tiles (Latihan, Badan & progres, Belajar, Akun & data) instead of a text list |

## Elevation & Depth

Depth comes from tonal layers and glass, not drop shadows.

- Cards: `surface-1` with a 1 px `border`. No shadow.
- Glass (dock, sheets, segmented pills, the `+`, toasts): `glass` fill, `glass-border`,
  `backdrop-filter: blur(20px) saturate(140%)`, shadow `0 12px 40px rgba(5,4,20,0.45)`, and a 135° highlight
  (`rgba(255,255,255,0.14)` → transparent at 42 %) on the top edge so it catches light.
- Stacks (toasts, banners): items behind the front one scale down 6 % per level, fade 40 % per level and peek 12 px.
- Inset wells (ring tracks, chart areas): `surface-2`.

## Shapes

- `rounded.lg` (22 px): cards, sheets (top corners), hero.
- `rounded.md` (16 px): buttons, inner tiles.
- `rounded.sm` (11 px): small chips inside cards, tooltips.
- `rounded.pill`: chips, segmented controls, dock, the `+`.
- Rings use round line caps; chart lines use round joins.

## Components

### Readiness hero
Large ring (168 px) or a `display-hero` number, with the state glow behind it. Top to bottom: `label-caps`
(`KESIAPAN`), number, state word (`Siap`, `Normal`, `Pelan dulu`), one coaching sentence, today's session chip. Tap
anywhere to open the readiness sheet, which explains what fed the score in plain words.

### Race countdown chip
`H-218 · BTN JAKIM HM` with a 44 px holo progress ring. Tap to open the race sheet (plan, target pace, race-day tips).
Switching race happens inside that sheet, not on home.

### Ring trio
Three 108 px rings in equal columns separated by 1 px dividers, with a label under each. Tap a ring to open its sheet.

### Metric tile (`tile-metric`)
`label-caps` + value + comparison (`normal` ✓ / `lebih rendah` ↓ / `lebih tinggi` ↑) and a range dot strip. The
whole tile is tappable, with an → in the top-right corner.

### Session chip (`chip-session`)
Pill with a session-type colour dot, name and duration: `● Tempo · 45 mnt`. Tap to open the session sheet, which has
one primary action: **Mulai** (start timer) or **Catat** (log).

### Floating `+` (`fab`)
56 px glass circle to the right of the dock. Tap to open an action sheet with at most four large options: Catat lari,
Mulai sesi, Check-in harian, Impor file. This is the only "create" entry point in the app.

### Dock (`dock`)
Glass pill, 64 px tall, five items (icon + short label): Beranda · Latihan · Aktivitas · Race · Menu (`NAV_MAIN` in
`public/index.html`). The active item sits on the sprung glass pill with a holo icon. No badge counts, only a dot.

### Sheet (`sheet`)
Bottom sheet, glass, grab handle, opens to 60 % height and drags to full. Its header repeats the visual you tapped
(shared element). At most one primary button, full width at the bottom.

### Segmented control
Glass pill (`seg-glass`, `js/ui-glass.js`) for 2–4 options such as `7H / 30H / Blok`. Never more than four segments.

### Delta chip
Small pill with an arrow and a percentage. Green tint when the change is good for the runner, red tint when bad, grey
when flat (`→ 0.0 %`). What counts as "good" depends on the metric (a lower RHR is good).

### Toast
Glass, bottom, above the dock, one line, auto-dismiss after 3 s. Used for "Tersimpan", `Urungkan` and sync notes.
Never for errors that need a decision.

## Motion

Motion explains cause and effect: what you touched, where it went, what changed. Every value comes from the motion
tokens in the front matter. A hard-coded `0.3s` or `transition: all` is a bug.

The token scale and recipes follow transitions.dev, a library of production UI transitions. Springs follow
motion-primitives, converted to the app's own spring engine (`WRI_MOTION.springF(omega, zeta)` in
`public/js/motion.js`). The sheet curve comes from ui-layouts.

### Rules

1. **Name the properties.** Animate `transform`, `opacity` and (sparingly) `filter`. Never `transition: all`, never
   width, height, top or left (the one exception is the glass pill's width, which the spring engine drives).
2. **Exits are faster than entrances.** Close in the next duration step down: open `duration-base` → close
   `duration-quick`; open `duration-moderate` → close `duration-base`.
3. **Small distances.** Elements travel 8–16 px (`distance-sm` to `distance-lg`), never across the screen. Scale
   from `scale-enter` (0.96), never from 0. The exception is a sheet, which slides up from below the screen edge.
4. **Blur on the way in.** Entering text, digits and icons start at `blur-enter` (2–3 px) and sharpen as they land.
   This is what makes an entrance feel optical rather than mechanical. Never above `blur-max` (8 px).
5. **Overshoot is earned.** The `ease-pop*` curves are for things that *arrive* or *succeed*: digits, check marks,
   toggles, celebration. Navigation, sheets and layout changes use `ease-out` or a spring with no visible bounce.
6. **Stagger, then stop.** 40 ms between text lines, 50 ms between list items, 70 ms between digits. Stagger at most
   six items; the rest appear with the sixth.
7. **Interruptible.** A new tap retargets a running animation from where it is (springs do this naturally; CSS
   transitions must not use keyframes for state changes).
8. **Reduced motion is part of every recipe.** Under `prefers-reduced-motion: reduce` or `data-motion="reduced"`
   (`WRI_MOTION.reduced()`): no movement, no scale, no blur, no springs. Allow opacity fades of at most
   `duration-quick`. Rings and numbers render at their final value at once.
9. **Nothing over 1.4 s** (`duration-reel`), except the boot mark draw and the living gradient.

### Easing guide

| Token | Curve | Use for |
| --- | --- | --- |
| `ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default for anything entering, moving or resizing: modals, tabs, cards, toasts, accordions |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Long fills that should start fast and settle slowly: rings, chart lines, counter reels |
| `ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | Bottom sheets and the action sheet (the iOS drawer curve) |
| `ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Loops only: shimmer, skeleton pulse, living gradient |
| `ease-pop-soft` | `cubic-bezier(0.34, 1.35, 0.64, 1)` | Toggles, check-mark bob, chips settling |
| `ease-pop` | `cubic-bezier(0.34, 1.45, 0.64, 1)` | Digits popping in, badges appearing |
| `ease-pop-strong` | `cubic-bezier(0.34, 1.96, 0.64, 1)` | Milestone moments only (PB, week complete, finish) |

### Springs

| Token | ω, ζ | From | Use for |
| --- | --- | --- | --- |
| `spring-pill-lead` / `spring-pill-trail` | 19, 0.55 / 11, 0.72 | WeRunIt `GlassPill` | Dock and segmented-control indicator: leading edge fast and springy, trailing edge lazy, so the pill stretches |
| `spring-morph` | 14.1, 0.85 | motion-primitives morphing dialog (stiffness 200, damping 24) | Card → sheet shared-element morph |
| `spring-panel` | 17.3, 0.87 | motion-primitives transition panel (stiffness 300, damping 30) | Content swapping inside a sheet (7H ↔ 30H) |
| `spring-digit` | 30.6, 0.98 | motion-primitives sliding number (stiffness 280, damping 18, mass 0.3) | Live-changing digits: timer, pace, heart rate |

Conversion: ω = √(stiffness / mass), ζ = damping / (2 · √(stiffness · mass)).

### Recipes for WeRunIt moments

| Moment | Recipe (source) | Spec |
| --- | --- | --- |
| **Press** any card, chip or button | — | scale `scale-press` in `duration-instant` `ease-out`; release springs back in `duration-base` `ease-pop-soft` |
| **Dock / segment change** | Tabs sliding (transitions.dev) with WeRunIt's glass pill | `GlassPill` springs; labels cross-fade colour in `duration-base` `ease-out`; light haptic tick |
| **Card → sheet** | Morphing dialog (motion-primitives) | The tapped ring or number morphs into the sheet header with `spring-morph`; the sheet rises from below the screen in `duration-moderate` `ease-sheet`; backdrop fades to 40 % black in `duration-base` |
| **Sheet dismiss** | — | Drag past 25 % or flick faster than 800 px/s; reverse the morph; close in `duration-base` `ease-sheet` |
| **Action sheet from `+`** | Modal open/close (transitions.dev) | The `+` rotates 45° into ✕ (`duration-base` `ease-out`); options rise 12 px with 2 px blur, 50 ms stagger |
| **Hero number on open** | Number pop-in (transitions.dev) | Each digit rises 8 px from 2 px blur and 0 opacity, `duration-slow` `ease-pop`, 70 ms stagger left to right |
| **Live numbers** (timer, pace, HR) | Sliding number (motion-primitives) | Only the changed digit rolls vertically with `spring-digit`; tabular figures so nothing shifts |
| **Weekly km / totals counting up** | Spinning counter (transitions.dev) | Digit reels spin 0 → value in `duration-reel` `ease-out-expo` with 3 px motion blur, 90 ms stagger from the right |
| **Rings fill** | — | 0 → value in `duration-fill` `ease-out-expo`; the number pops in when the ring passes 60 % |
| **Chart lines draw** | — | Stroke draws left → right in `duration-fill` `ease-out-expo`; the end dot pops in with `ease-pop` |
| **Screen entrance** | Texts reveal (transitions.dev) | Cards rise 12 px from 3 px blur, `duration-slow` `ease-out`, 50 ms stagger, max six |
| **Page change** (Latihan → Race) | Page side-by-side (transitions.dev) | Outgoing page shifts 8 px away and fades in `duration-base`; incoming shifts 8 px in from the travel direction with 3 px blur |
| **Card grows** (expanding a week) | Card resize / accordion (transitions.dev) | Height and content in `duration-moderate` `ease-out`; the chevron rotates in `duration-base` |
| **Loading** | Skeleton loader and reveal (transitions.dev) | One pulse at 50–100 % opacity over 1000 ms `ease-in-out`, then content reveals from 2 px blur in 400 ms. Show the skeleton only if loading takes longer than 300 ms |
| **Saved / logged** | Success check (transitions.dev) | Check rotates in from 80°, rises 40 px, sharpens from 10 px blur; path draws after 80 ms; all `duration-slow`, bob on `ease-pop-soft` |
| **Toggle** | Toggle (transitions.dev) | Knob travels in `duration-moderate` `ease-pop-soft` with 1 px overshoot |
| **Toast** | Toast open/close (transitions.dev) | Rises 16 px from scale 0.97 and 2 px blur in `duration-moderate`; leaves in `duration-base`; stacks per Elevation & Depth |
| **Icon changes** (play ↔ pause) | Icon swap (transitions.dev) | Outgoing scales to 0.25 and blurs out, incoming scales up from 0.25 with 2 px blur, `duration-base` |
| **Invalid input** | Error state shake (transitions.dev) | 6 px shake (80 ms, then 60 ms), 4 px overshoot; the error text stays 3 s, then reverts in 280 ms |
| **State changes** (Normal → Siap) | — | Screen tint and hero glow cross-fade in `duration-slow`; the ring re-colours along its stroke |
| **Milestone** (PB, week complete, race day, finish) | Like button particles + confetti burst (transitions.dev) | Hero scales 1 → 1.04 → 1 on `ease-pop-strong` (350 ms); 8–12 particles in holo colours travel 20 px over 600 ms; one holo shimmer sweep across the hero. Once per event, never repeated |

### Loops (the only ones allowed)

- **Shimmer** on "Menyinkronkan…" text: a 200 % wide gradient sweep, 1.4 s linear, only while the work is happening.
- **Skeleton pulse:** one pulse, then hold (see Loading).
- **Brand mark** on boot and onboarding (`brand.js`, liquid settle, 1.6 s).
- **Living gradient** on onboarding, race day and the finish screen.

## Data visualisation

Every chart answers one question, stated in its caption.

| Viz | Use for | Rules |
| --- | --- | --- |
| **Ring gauge** | 0–100 % scores (readiness, recovery, effort, sleep, race progress) | 9 px stroke (trio) / 12 px (hero), round caps, gradient head, `surface-2` track. Target zone as a faint arc on the track (reference: "Target Strain 26–58 %"). Effort below target uses a hatched fill. |
| **Range dot strip** | Today vs 30-day range (RHR, HRV, sleep) | Hatched band = normal range; grey dots = past days; one large dot = today, in the metric's colour. |
| **Cumulative line** | Plan vs actual volume toward race day | Plan line grey 1.5 px; actual line primary 2 px with small hollow dots per run; end dot enlarged and glowing; 8 % area fill under actual. |
| **Training-load line** | Acute:chronic ratio | Zone bands (Detraining / Optimal / Risiko sedang / Risiko tinggi); a value chip appears on scrub (reference: "1.39 · Nov 7"). |
| **Activity heatmap** | Consistency over the block | Week rows × day columns, rounded bars; colour by session count or type; today outlined. |
| **Sparkline tile** | Period-over-period trends | Label top-left, value top-right, delta chip below. |
| **Consistency ticks** | Sleep and wake times | Time label above a short coloured tick; hatched band for the usual window. |
| **Bullet bar** | Actual vs plan for one quantity (week km, block runs, block km) | 10px track; plan as a tinted fill with a tick at its end; actual as a primary→blue fill (primary→cyan when over plan); the value as a `stat-number` label above. |
| **Week strip** | This week's sessions at a glance | Seven columns; one 34px dot per session in its `session-*` colour; done filled with a check, today ringed, missed dashed red with ✕, skipped faded; the km under each dot. |
| **Check-in rows** | 14 days of how the body feels | Four rows of 14 bars; a taller bar is always better (soreness and pain flipped); low values in `state-caution`; empty days as a flat stub. |
| **Spark tile** | One headline number with its trend | `label-caps`, value, then an 8-week mini bar or line (34px tall); the current week highlighted in cyan. |

### Chart finish: glass and gradient

Charts sit on frosted glass and their marks glow softly, so the data is the brightest thing on the screen.

- **Chart cards** (`.vglass` in `public/css/werunit.css`): `glass` fill tinted 6% `primary` → 5% `cyan` on a 160° diagonal,
  `backdrop-filter: blur(18px) saturate(150%)`, a 1px gradient edge (white 28% → transparent → cyan → primary) and a
  7% white sheen on the top half. Solid `glass-solid` fallback where blur is unsupported or `data-glass="off"`.
- **Something to blur:** screens with chart cards get an ambient aura behind the content: three blurred blobs
  (`primary`, `cyan`, `pink`) at 16–28% opacity, fixed, `pointer-events: none`.
- **Marks:** bars fill bottom-to-top `primary` → `blue` (the current week `blue` → `cyan`); lines stroke `primary` →
  `cyan` with an area that fades from 38% to 0; done session dots and heatmap cells use a lit radial or diagonal
  gradient of their own colour with a soft outer glow (`color-mix(... 40–50%, transparent)`, 8–18px). Low values use
  `state-caution` → `pink`.
- **Restraint:** gradients and glow belong to data marks and chart cards only, never to body text, captions or axes.
  Headline numbers may carry a faint 22px `primary` text glow.

- Press and drag on a chart to scrub; a value chip follows the finger and hides on lift. No zoom buttons.
- Axis labels in `text-faint` 11 px; at most three x-axis labels (start, middle, today).
- Empty data: dot-grid well, track drawn in `state-idle`, and one line saying what unlocks it:
  "Lari 3x lagi untuk lihat tren."

## Interaction rules (less hassle)

- **A chart before a list.** If the same information can be a dot, bar or cell, draw it and make the mark the tap
  target; keep plain rows for logs people scroll through.
- **No visible edit or delete buttons on lists.** Swipe left to reveal Hapus; long-press for the context menu.
- **No confirm dialogs for reversible actions.** Do it, then offer `Urungkan` in the toast for 5 s.
- **Prefill everything.** Logging a run prefills today, the last distance and the last shoe. Health Connect and file
  import fill the rest.
- **Smart defaults over settings.** Add a setting only after the default has proven wrong for real users.
- **Gestures are shortcuts, never the only path.** Every swipe action is also in the long-press menu and the sheet.
- **Labels in the dock and action sheet.** Icon-only buttons are allowed only for universal glyphs (✕, ‹, ⓘ, +) and
  need an `aria-label`.
- **Tap targets ≥ 48 × 48 px**, with ≥ 8 px between neighbours.
- **Haptics (Android, Capacitor):** light tick on tab change and toggle; success pattern on saving and finishing a
  session; nothing on scroll.

## Voice and copy

- Bahasa Indonesia, casual, second person (`kamu`), short. Kiki is a supportive running buddy, not a drill sergeant.
- Lead with the verdict, then the reason: "Pelan dulu. HRV-mu turun 12 % dari biasanya."
- Numbers over adjectives: "Kurang 6 km dari rencana minggu ini", not "Volume agak kurang".
- Buttons are verbs: `Mulai`, `Catat`, `Simpan`, `Urungkan`. Never `OK` or `Submit`.
- Chart words: say **bar** for a bar (never the literal "batang"), **garis** for a line and **titik** for a dot. Describe
  marks by role, not by a colour that can change: "abu-abu = target, berwarna = aktual", never "hijau = aktual".
- Prefer the words runners already use: km, pace, long run, easy run, RPE. Keep English running terms when they are
  what people say; translate the rest into casual Indonesian.
- Empty states say what to do next, in one line.
- Keep health claims modest ("kelihatannya", "biasanya"). Pain and injury copy always suggests rest and, if it
  persists, a professional.

## Accessibility

- Every ring and chart has a text equivalent in its `aria-label`: "Pemulihan 76 persen, normal".
- Animated numbers announce only their final value (`aria-live="polite"` on the container, digits `aria-hidden`).
- Focus ring: 2 px `primary-text`, offset −6 px inside pills (existing `.dock button:focus-visible`).
- 200 % text zoom must not truncate numbers; the hero number scales down before it wraps.
- Reduced motion per the Motion rules; the light theme keeps every state readable.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| One verdict per screen, visible without scrolling | Stack five equally loud cards |
| Make the whole card tappable | Add "Detail" text buttons under every card |
| Use a single `+` for creating anything | Scatter add buttons across screens |
| Compare against the runner's own 30-day range | Show raw numbers with no context |
| Use state colour on the hero only when it means something | Paint decoration red, amber or green |
| Keep holo for brand moments and race progress | Use the holo gradient on body cards or text |
| Use motion tokens and name the animated properties | Write `transition: all 0.3s` |
| Close faster than you open | Make the user wait for an exit animation |
| Save overshoot for arrivals and success | Bounce navigation, sheets or layout |
| Show last-known data offline with a timestamp | Block the screen with a sync error |

## References

### Supplied screenshots

| Reference | Borrowed |
| --- | --- |
| French dark dashboard (Accueil / Activité) | Date-as-headline with ▾, ring trio with labels, coaching card, stress gauge, monthly activity heatmap, cumulative plan-vs-actual line, glass dock + detached `+` |
| Light "Your dashboard" web view | Today-vs-30-day range dot strips, normal/lower labels, sleep and wake consistency ticks, sparkline tiles with delta chips |
| Strain / Recovery / Sleep detail screens | Sheet anatomy: big ring → two stat tiles → insight card → "View insights →", target zone on the ring, per-metric tint |
| Green readiness concept | Full-screen state tint behind the hero number, training-load zone chart with scrub chip, 7-day line with labelled points, compact glass dock |

### Websites (read 7 November 2026)

| Site | Used for |
| --- | --- |
| transitions.dev | Motion token scale, default `ease-out`, pop curves, the recipe values in the Motion table, rules (name properties, faster exits, reduced-motion guard per recipe) |
| motion-primitives.com | Spring values (morphing dialog, transition panel, sliding number), progressive blur under the dock, number-effect patterns |
| ui-layouts.com | `ease-sheet` drawer curve (0.32, 0.72, 0, 1) at 500 ms |
| beautifului.dev | Shimmer text (1.4 s linear, 200 % gradient), 22 px dot grid for empty wells, the `cubic-bezier(0.23, 1, 0.32, 1)` family confirming the ease-out choice |
| patterncraft.store | 125 % radial screen tint, corner glows, edge-faded grids |
| feralui.dev/gradients | Mesh built from pinned radial spots, oklab interpolation, 6 % noise finish, multi-stop light falloff |
| neat.rebase.pro | Living gradient (low-fps animated field with grain, vignette and bloom) for onboarding, race day and finish |
| design.dev DESIGN.md generator | File format: `version`, token groups, `{token.path}` references in components, prose section names |
| context.dev DESIGN.md generator | Purpose of the file: palette, type scale, components and visual rules an agent can follow |
| designmd.co | Not read: the site returned 403 Forbidden to automated access |

## Source of truth

- Tokens in code: `public/css/werunit.css` (`:root` and `[data-theme="light"]`). When a token here changes, change
  it there in the same commit.
- Motion engine: `public/js/motion.js`. Glass controls: `public/js/ui-glass.js`. Brand mark: `public/js/brand.js`.
- **Not yet in code:** the `state-*` colours, ring gradients, screen tint, grain, the `display-hero` / `ring-number`
  / `stat-number` roles, the 48 px tap-target minimum, and the whole motion token scale. Current CSS still uses
  ad-hoc curves that should move to tokens: `.btn` press `cubic-bezier(.3,1.6,.5,1)` 180 ms → `ease-pop-soft`;
  ring fill `cubic-bezier(.2,.9,.3,1)` 0.9 s → `ease-out-expo` + `duration-fill`; `.rv` reveal
  `cubic-bezier(.2,.9,.3,1.15)` → `ease-out` + `duration-slow` with blur.
