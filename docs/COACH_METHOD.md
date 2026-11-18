# Coach method (coach-1)

- Code: `public/js/coach/engine.js` (pure and deterministic, unit-tested in `test/unit/coach.test.js`) and
  `public/js/coach/model.js`.
- No AI model is involved. Answers are assembled from the observations below.

## Input: TrainingSession

| Field | Unit | Source | Notes |
|---|---|---|---|
| date | YYYY-MM-DD | run record | |
| distanceKm | km | runner-entered or Health Connect | null if missing |
| durationSec | s | same | null if missing; never estimated |
| paceSecPerKm | s/km | derived | only when distance and duration are both recorded |
| rpe | 1–10 | runner-entered | null if missing |
| hrAvg | bpm | recorded | used only with an entered HR max (120–230) |
| elevGainM | m | recorded | |
| source | manual / healthconnect / file / strava / sample | | **sample and strava rows are excluded** (policy) |

The window is the 8 calendar weeks ending today, starting on a Monday. Strength sessions are counted only from recorded
strength entries.

## Dimensions

| Id | Minimum data | Definition | Classification |
|---|---|---|---|
| consistency | 4 runs | Active weeks out of 8, runs per week, longest gap in days (including up to today) | Strength: ≥ 7 active weeks and ≥ 3 runs/week. Limitation: ≤ 4 active weeks or a gap ≥ 14 days. Otherwise neutral |
| volume | ≥ 3 runs with distance in each 4-week half | km in the last 28 days vs the 28 days before | +30% or more: opportunity (hold). −30% or more: limitation (cause unknown). Otherwise neutral |
| longrun | 6 runs with distance | Long run = ≥ max(8 km, 1.5 × median distance). Counts weeks with a long run and the longest run per half | ≥ 5 weeks: strength. ≤ 2 weeks: opportunity |
| intensity | RPE in ≥ 6 runs and ≥ 50% of runs | Shares of easy (1–4), moderate (5–6) and hard (7–10) by RPE | Easy < 60%: limitation. Easy ≥ 75%: strength |
| pace | 6 runs with pace in one distance band | Distance band with the most balanced halves; median pace, early half vs late half; permutation test (2000 shuffles, seeded) | "Supported" needs p < 0.05, ≥ 6 runs per half and \|Δ\| ≥ 5 s/km; otherwise neutral |
| recovery | RPE in 6 runs | Hard sessions (RPE ≥ 7) on consecutive days | ≥ 2 such pairs: limitation |
| strength | ≥ 1 recorded strength entry | Sessions per week | ≥ 1.5/week: strength; otherwise opportunity. **No records → "insufficient", never "you don't train strength"** |

Each observation has:
- fact
- interpretation (non-causal)
- recommendation (one change)
- monitor
- measures
- window
- n
- coverage (field have/total)
- confidence: high when n ≥ 12 and coverage ≥ 80%; medium when n ≥ 6 and coverage ≥ 50%; otherwise low

The **key insight** on Today is the first limitation or opportunity by rank, then by confidence. With no data there is
no key insight.

## Unanswerable (always shown)
- Pace vs heart rate, without an entered HR max and HR in ≥ 6 runs.
- Hills, when elevation is in < 50% of runs.
- Sleep, soreness and recovery: no source.
- Weather per run: not recorded.

## Ask the coach
- Keyword routing to dimensions. Answers are built only from those observations, with n, window and an uncertainty
  line, at most two actions, and follow-up questions.
- Questions about pain or injury always get a safety answer: stop, then see a doctor or physiotherapist.
- Heart-rate questions without data get "not answerable yet".

## Never
- No readiness score, no safe/unsafe labels, no injury prediction, no diagnosis.
- No filled-in values.
- No causal claims.
- No Strava data, no data sent to an LLM.
