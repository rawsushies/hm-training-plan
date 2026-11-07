---
name: WeRunIt
version: 1.0.0
description: >
  Visual-first race-progress monitor. One glance tells you where you stand on the road to your race
  (default: BTN JAKIM Half Marathon, 13 Juni 2027); one tap tells you more. Dark-first, glass surfaces,
  holographic accent, sprung motion.
colors:
  # Surfaces (dark is the primary theme)
  bg: "#13131C"
  surface-1: "#1C1B2A"
  surface-2: "#262539"
  glass: "rgba(235,235,255,0.07)"
  glass-border: "rgba(235,235,255,0.15)"
  line: "rgba(235,235,255,0.11)"
  # Text
  text: "#F6F4FF"
  text-muted: "#A8A5BB"
  text-faint: "#77758A"
  # Brand
  accent: "#9673FF"
  accent-text: "#B9A4FF"
  on-accent: "#FFFFFF"
  blue: "#65A7FF"
  cyan: "#79E5DE"
  pink: "#F18CD5"
  silver: "#F0EEFF"
  # Readiness states (the only colours allowed to carry meaning on the hero)
  state-ready: "#7BE38A"      # go: on plan, recovered
  state-steady: "#79E5DE"     # normal range
  state-caution: "#FFB86B"    # behind plan, low recovery
  state-alert: "#FF7A85"      # missed key session, injury flag
  state-idle: "#4A4860"       # no data / rest
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
gradients:
  holo: "linear-gradient(115deg,#F0EEFF 0%,#9673FF 26%,#65A7FF 48%,#79E5DE 70%,#F18CD5 88%,#FFE2C6 100%)"
  ring-progress: "conic: #9673FF → #65A7FF → #79E5DE"
  ring-recovery: "conic: #3FB950 → #7BE38A → #D7F25C"
  ring-effort: "conic: #FFB86B → #F18CD5 (hatched below target)"
  ring-sleep: "conic: #5B4BFF → #9673FF → #B7C7FF"
  hero-glow: "radial-gradient(closest-side, rgba(150,115,255,0.22), transparent)"
  ambient-mesh: "3–4 blurred blobs from the brand set on bg, 6–10% opacity, 2% grain"
typography:
  display: { family: "Space Grotesk", fallback: "Inter, system-ui, sans-serif" }
  body: { family: "Inter", fallback: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }
  numeric: { family: "Space Grotesk", features: "tnum, ss01" }
  scale:
    hero-number: { size: 84px, weight: 700, line: 0.82, tracking: -0.05em }
    ring-number: { size: 28px, weight: 700, line: 1, tracking: -0.03em }
    stat-number: { size: 34px, weight: 700, line: 1, tracking: -0.03em }
    h1: { size: 28px, weight: 700, line: 1.1, tracking: -0.02em }
    h2: { size: 20px, weight: 650, line: 1.2, tracking: -0.01em }
    h3: { size: 16px, weight: 650, line: 1.25, tracking: -0.01em }
    body: { size: 15px, weight: 400, line: 1.5 }
    meta: { size: 13px, weight: 500, line: 1.45 }
    caption: { size: 12px, weight: 600, line: 1.4, tracking: 0.06em, case: uppercase }
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 56]
  gutter: 16px
  card-padding: 18px
  section-gap: 32px
rounded:
  sm: 11px
  md: 16px
  lg: 22px
  pill: 999px
elevation:
  card: "surface-1 + 1px line border, no shadow"
  glass: "glass fill + glass-border + backdrop-filter: blur(20px) saturate(140%)"
  floating: "0 12px 40px rgba(5,4,20,0.45)"
motion:
  spring-lead: { omega: 19, zeta: 0.55 }
  spring-trail: { omega: 11, zeta: 0.72 }
  ease-out: "cubic-bezier(.2,.9,.3,1)"
  ease-overshoot: "cubic-bezier(.2,.9,.3,1.15)"
  ease-press: "cubic-bezier(.3,1.6,.5,1)"
  ease-draw: "cubic-bezier(.6,0,.2,1)"
  duration: { press: 120ms, micro: 180ms, ui: 300ms, reveal: 600ms, ring-fill: 900ms, number-roll: 700ms }
  stagger: 50ms
components:
  tap-target-min: 48px
  dock-height: 64px
  ring-size: { hero: 168px, trio: 108px, mini: 44px }
---

# WeRunIt Design Bible

## 1. What we are building

WeRunIt is a **race-progress monitor**, not a training spreadsheet. A runner opens it, sees in under two seconds
whether they are on track for their race, and closes it. Everything else (logging, plans, shoes, friends) is
one tap behind that answer.

- **Primary race:** BTN JAKIM Half Marathon, 13 Juni 2027 (21.0975 km). Any race event works the same way.
- **Primary question the app answers:** "Am I ready, and what do I do today?"
- **Interaction promise:** *One tap to know. One tap to act.* No form-filling to see your status, no buttons whose
  purpose needs a label to explain.
- **Language:** UI copy is Bahasa Indonesia, casual and warm (Kiki's voice). This document is in English.

### The one-tap rule

| Depth | What the user sees | How they got there |
| --- | --- | --- |
| 0 taps | Readiness hero: race countdown, readiness %, today's session, one sentence of coaching | Opening the app |
| 1 tap | Detail sheet for whatever they tapped (a ring, a card, a chart) | Tap anywhere meaningful |
| 2 taps | An action completed (start session, log run, mark done) | Primary action in the sheet |

If a common task needs three taps, the design is wrong. If a screen needs a button to explain another button,
the design is wrong.

## 2. Principles

1. **Visual before verbal.** A ring, a dot or a line says it first; the number confirms; text explains only if asked.
   Every card leads with a visual (reference: the Effort / Récupération / Sommeil ring trio).
2. **The whole card is the button.** Cards, rings and chart tiles are tap targets. No "Lihat detail" links, no
   chevron-only hit areas. An arrow glyph (→) in the top-right only signals "this opens".
3. **One primary action per screen.** It lives in the floating `+` (or the hero's single CTA). Secondary actions live
   inside sheets, never on the surface.
4. **Colour means state.** Brand colours decorate; state colours (ready / steady / caution / alert / idle) carry
   meaning. Never use red or amber for decoration.
5. **Compare to *you*.** Every metric shows today against your own 30-day range (reference: "Today vs. 30 day range"),
   with a plain label: `normal`, `lebih rendah`, `lebih tinggi`.
6. **Calm by default, alive on touch.** Surfaces are still at rest; motion happens in response to the user or to data
   arriving. No looping decoration on data screens (the brand mark and onboarding are the exceptions).
7. **Offline is normal.** Show the last known state with a quiet timestamp ("Diperbarui 08:06"), never an error wall.

## 3. Colour

Dark is the primary theme. Light theme exists (tokens in `public/css/werunit.css`, `[data-theme="light"]`) and must
keep the same hierarchy, but every new screen is designed dark first.

### Layers

```
bg (#13131C)            app background, plus optional ambient mesh
└ surface-1 (#1C1B2A)   cards
  └ surface-2 (#262539) ring tracks, inset wells, chart backgrounds
glass                   anything floating over content: dock, sheets, segmented pills, toasts
```

### State colours

Use exactly one state colour per hero. The ring gradient, the status dot and the coaching headline share it.

| State | Token | When | Example copy |
| --- | --- | --- | --- |
| Ready | `state-ready` | Readiness ≥ 67 %, on plan | "Siap gas. Tempo 8 km hari ini." |
| Steady | `state-steady` | 34–66 %, within range | "Normal. Lari santai aja." |
| Caution | `state-caution` | < 34 %, or ≥ 1 key session behind | "Pelan dulu. Tidurmu kurang." |
| Alert | `state-alert` | Pain flag, ≥ 2 key sessions missed, race-week risk | "Ada nyeri? Istirahat dan cek lagi besok." |
| Idle | `state-idle` | No data yet, rest day | "Hari istirahat. Nikmati." |

### Gradients

- **Holo** (`gradients.holo`) is the brand foil. Use it on the logo, the "It" of the wordmark, the race-progress ring
  and the active dock icon. Nowhere else.
- **Ring gradients** run along the stroke (conic), light at the head, so the ring reads as moving forward.
- **Ambient mesh** (reference: the green glow behind the 73 % "Moderate Readiness" hero): a large, soft blob of the
  current state colour behind the hero at 15–25 % opacity, with 2 % grain to prevent banding. It shifts colour when
  the state changes (600 ms cross-fade). Only the hero gets it.
- Never place a gradient behind body text. Text sits on solid or glass surfaces.

### Contrast

Body text ≥ 4.5:1 on its surface; numbers and labels ≥ 3:1. `text-faint` is for timestamps and axis ticks only.
State is never shown by colour alone: pair it with a label word or an icon.

## 4. Typography

Two families: **Space Grotesk** for display and all numbers, **Inter** for reading.

- **Numbers are the heroes.** Big, tight, tabular (`font-variant-numeric: tabular-nums`). Units are set at 45–55 % of
  the number's size, same baseline, muted colour: `76`<sub>%</sub>, `64`<sub>bpm</sub>, `5:42`<sub>/km</sub>.
- **Hierarchy per card:** caption (what it is) → number (the value) → meta (comparison or timestamp). At most three
  type sizes inside one card.
- **Captions** are uppercase, 12 px, tracked 0.06 em, `text-muted` (reference: "COACHING", "7-DAY OVERVIEW").
- **Coaching text** is body size, max two sentences on the surface; the full insight opens in a sheet
  (reference: "View insights →").
- Headline style: `Hari ini, 7 November` with a ▾ that opens a date picker. The date *is* the control.

## 5. Layout

- Mobile-first, single column, 16 px gutters, 4 px grid. Max content width 520 px; on desktop centre it and keep the
  side nav (`nav.side`).
- **Vertical rhythm:** 12 px between cards in a group, 32 px between sections. Section titles are `h2`.
- **Thumb zone:** primary actions in the bottom third. Nothing important in the top 15 % except the date and avatar.
- **Bottom safe area:** content scrolls under the dock; add `padding-bottom: calc(64px + 24px + env(safe-area-inset-bottom))`.

### Home screen order (fixed)

1. Top bar: date headline with ▾ (left), avatar (right). No other buttons.
2. **Readiness hero:** race countdown + readiness %, state glow, one coaching sentence, today's session chip.
3. **Ring trio:** Beban (effort) · Pemulihan (recovery) · Tidur (sleep). Tap a ring for its sheet.
4. **Race progress strip:** weeks done / weeks total, km this block vs plan (line chart: plan in grey, actual in
   accent, like the "Résumé d'activité" chart).
5. **Today vs 30-day tiles:** RHR, HRV, pace, consistency. 2-column grid of compact tiles.
6. Weather tip card (existing Open-Meteo card) when relevant to today's session.

Nothing else on home. Shoes, friends, plans and settings live in Menu.

## 6. Surfaces, shape and depth

- Cards: `surface-1`, radius `lg` (22 px), 1 px `line` border, 18 px padding, no drop shadow.
- Glass (dock, sheets, segmented pills, the `+` button): `glass` fill, `glass-border`, `backdrop-filter: blur(20px)
  saturate(140%)`, `floating` shadow. Glass only for things that float over content.
- Pills (chips, segmented controls, dock): radius `pill`.
- Inset wells (ring tracks, chart areas): `surface-2`.
- Dividers inside a card are 1 px `line` and only between peer columns (reference: Haut | Bas | Moyenne).

## 7. Motion

Motion explains cause and effect: what you touched, where it went, what changed. The engine is in
`public/js/motion.js` (`WRI_MOTION`); use it, don't write ad-hoc keyframes.

| Moment | Spec |
| --- | --- |
| Press | scale 0.96, 120 ms, `ease-press`; release springs back |
| Tab / segment change | `GlassPill`: leading end spring ω 19 ζ 0.55, trailing end ω 11 ζ 0.72; stretch and frost scale with speed |
| Card → sheet | Shared-element: the tapped card's ring/number morphs into the sheet header; sheet rises with `ease-out` 300 ms; background dims to 40 % |
| Sheet dismiss | Drag down past 25 % or flick > 800 px/s; reverse the morph |
| Data arrives | Rings fill 0 → value in 900 ms `ease-out`; numbers roll (`rollNumber`) 700 ms; sparklines draw left→right 600 ms `ease-draw` |
| Screen entrance | Cards reveal with 8 px rise + fade, 600 ms `ease-overshoot`, 50 ms stagger, max 6 items |
| State change | Hero glow cross-fades 600 ms; the ring re-colours along its stroke |
| Milestone (PB, week complete, race day) | One celebratory beat: holo shimmer sweep across the hero, 1.2 s, once |

Rules:

- **Reduced motion** (`prefers-reduced-motion` or `data-motion="reduced"`): no springs, no stretch, no rolls; fades
  ≤ 150 ms, rings render at their final value. Already handled by `WRI_MOTION.reduced()`; every new animation must check it.
- Animate `transform` and `opacity` only. Blur only on the glass pill, capped at 8 px.
- No animation longer than 1.2 s, except the boot mark draw (1.1 s + wordmark rise).
- Never animate while the user is reading a number they just opened: the roll finishes before the sheet settles.

## 8. Data visualisation

Every chart answers one question, stated in its caption.

| Viz | Use for | Rules |
| --- | --- | --- |
| **Ring gauge** | A 0–100 % score (readiness, recovery, effort, sleep, race progress) | 9 px stroke (trio) / 12 px (hero), round caps, gradient head, `surface-2` track. Target zone shown as a faint arc on the track (reference: "Target Strain 26–58 %"). Below-target effort uses a hatched fill. |
| **Range dot strip** | Today vs 30-day range (RHR, HRV, sleep) | Hatched band = normal range; grey dots = past days; one large dot = today in the metric's colour (reference: "Today vs. 30 day range" cards). |
| **Cumulative line** | Plan vs actual volume toward race day | Plan line grey 1.5 px; actual line accent 2 px with small hollow dots per run; end dot enlarged and glowing; area fill 8 % below actual. |
| **Training-load line** | Acute:chronic ratio | Zones as stacked bands (Detraining / Optimal / Risiko sedang / Risiko tinggi); a tooltip chip on scrub shows value + date (reference: "1.39 · Nov 7"). |
| **Activity heatmap** | Consistency over the block | Week rows × day columns, rounded bars; colour by session count or session type; today outlined (reference: monthly activity calendar). |
| **Sparkline tile** | Period-over-period trends | Label top-left, value top-right, delta chip below (↑ 4.1 % on green-tint, ↓ 2.2 % on red-tint only when worse is bad). |
| **Consistency ticks** | Sleep / wake times | Time label above a short coloured tick, hatched band for the usual window. |

- Scrubbing a chart (press and drag) shows a value chip; lifting hides it. No zoom buttons.
- Axis labels in `text-faint` 11 px; at most 3 x-axis labels (start, middle, today).
- Empty data: draw the track/axes in `state-idle` and say what unlocks it: "Lari 3x lagi untuk lihat tren."

## 9. Components

### Readiness hero
Large ring (168 px) or giant number (`hero-number`) with the state glow behind it. Contents, top to bottom:
caption (`KESIAPAN`), number, state word (`Siap`, `Normal`, `Pelan dulu`), one-sentence coaching, today's session
chip. Tap anywhere → readiness sheet (what fed the score, explained in plain words).

### Race countdown chip
`H-218 · BTN JAKIM HM` with a mini holo progress ring (44 px). Tap → race sheet (plan, target pace, race-day tips).
Switching race happens inside that sheet, not on home.

### Ring trio
Three equal columns separated by 1 px dividers. Label under each ring. Tap → that metric's sheet. The values come
in with the data-arrives motion.

### Metric tile
Caption + value + comparison label (`normal` ✓ / `lebih rendah` ↓ / `lebih tinggi` ↑) and a range dot strip.
Whole tile is tappable, with an → in the top-right corner.

### Session chip
Pill with session-type colour dot, name and duration: `● Tempo · 45 mnt`. Tap → session sheet with the single
primary action **Mulai** (start timer) or **Catat** (log).

### Floating `+` (primary action)
56 px glass circle to the right of the dock. Tap → action sheet with at most 4 large options: Catat lari, Mulai sesi,
Check-in harian, Impor file. This is the only "create" entry point in the app.

### Dock
Glass pill, 64 px tall, 4–5 items (icon + short label): Beranda · Latihan · Aktivitas · Race · Menu
(`NAV_MAIN` in `public/index.html`). Active item sits on the sprung glass pill with a holo icon. No badge
counts other than a single dot.

### Sheet
Bottom sheet, glass, radius 22 px on top corners, grab handle, opens to 60 % height and drags to full. Header repeats
the tapped visual (shared element). Max one primary button, full-width at the bottom.

### Segmented control
Glass pill (`seg-glass`, `js/ui-glass.js`) for 2–4 options such as `7H / 30H / Blok`. Never more than 4 segments.

### Delta chip
Small pill with arrow and percent. Green tint when the change is good for the runner, red tint when bad, neutral grey
when flat (`→ 0.0 %`). "Good" depends on the metric (lower RHR is good).

### Toast
Glass, bottom, above the dock, auto-dismiss 3 s, single line. Used for "Tersimpan" and sync notes. Never for errors
that need a decision.

## 10. Interaction rules (less hassle)

- **No visible edit/delete buttons on lists.** Swipe left to reveal Hapus; long-press for the context menu.
- **No confirm dialogs for reversible actions.** Do it, then offer `Urungkan` in the toast for 5 s.
- **Prefill everything.** Log run prefills today, last distance, last shoe. Health Connect / file import fills the rest.
- **Smart defaults over settings.** A setting is added only after the default has proven wrong for real users.
- **Gestures are shortcuts, never the only path.** Every swipe action is also in the long-press menu and the sheet.
- **Icons need labels in the dock and action sheet.** Icon-only buttons are allowed only for universal glyphs
  (close ✕, back ‹, info ⓘ, add +) and must have an `aria-label`.
- **Tap targets ≥ 48 × 48 px**, with ≥ 8 px between neighbouring targets.
- **Haptics (Android/Capacitor):** light tick on tab change and toggle; success pattern on session complete; none on scroll.

## 11. Voice and copy

- Bahasa Indonesia, casual, second person (`kamu`), short. Kiki is a supportive running buddy, not a drill sergeant.
- Lead with the verdict, then the reason: "Pelan dulu. HRV-mu turun 12 % dari biasanya."
- Numbers over adjectives: "Kurang 6 km dari rencana minggu ini", not "Volume agak kurang".
- Buttons are verbs: `Mulai`, `Catat`, `Simpan`, `Urungkan`. Never `OK` or `Submit`.
- Empty states say what to do next, in one line.
- Health claims stay modest: "kelihatannya", "biasanya". Pain and injury copy always suggests rest and, if it
  persists, a professional.

## 12. Accessibility

- Every ring and chart has a text equivalent in its `aria-label`: "Pemulihan 76 persen, normal".
- Focus ring: 2 px `accent-text`, offset −6 px inside pills (existing `.dock button:focus-visible`).
- Support 200 % text zoom without truncating numbers; hero number scales down before it wraps.
- Respect reduced motion (Section 7) and the light theme.
- State is never colour-only (Section 3).

## 13. Do and don't

| Do | Don't |
| --- | --- |
| One verdict per screen, visible without scrolling | Stack five equally loud cards |
| Make the whole card tappable | Add "Detail" text buttons under every card |
| Use a single `+` for creating anything | Scatter add buttons across screens |
| Compare against the runner's own 30-day range | Show raw numbers with no context |
| Use state colour on the hero only when it means something | Paint decoration red, amber or green |
| Keep holo for brand moments and race progress | Use holo gradient on body cards or text blocks |
| Spring motion that follows the finger | Looping animations on data screens |
| Show last-known data offline with a timestamp | Block the screen with a sync error |

## 14. Reference map

What we took from each reference image the team supplied:

| Reference | Borrowed |
| --- | --- |
| French dark dashboard (Accueil / Activité) | Date-as-headline with ▾, ring trio with labels, coaching card, stress gauge, monthly activity heatmap, cumulative plan-vs-actual line, glass dock + detached `+` |
| Light "Your dashboard" web view | Today-vs-30-day range dot strips, normal/lower labels, sleep/wake consistency ticks, sparkline tiles with delta chips |
| Strain / Recovery / Sleep detail screens | Detail-sheet anatomy: big ring → two stat tiles → insight card → "View insights →", target zone on the ring, per-metric ambient tint |
| Green readiness concept | Full-bleed state glow behind the hero number, training-load zone chart with scrub tooltip, 7-day line with value labels on points, compact glass dock |

The web references listed in the brief (transitions.dev, beautifului.dev, motion-primitives.com, ui-layouts.com,
patterncraft.store, feralui.dev/gradients, neat.rebase.pro, designmd.co, context.dev and design.dev DESIGN.md
generators) could not be reached when this file was written. Review Section 7 (motion) and the gradient tokens
against them once they are reachable, and update this file.

## 15. Source of truth

- Tokens in code: `public/css/werunit.css` (`:root` and `[data-theme="light"]`). When a token here changes, change it
  there in the same commit.
- Motion engine: `public/js/motion.js`. Glass controls: `public/js/ui-glass.js`. Brand mark: `public/js/brand.js`.
- New tokens introduced by this document and not yet in CSS: `state-*`, ring gradients, `ambient-mesh`, the
  `hero-number`/`ring-number`/`stat-number` type roles, and the 48 px tap-target minimum.
