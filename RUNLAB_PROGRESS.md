# RUNLAB progress (checkpoint)

Branch `claude/charming-cori-ge7n37` (based on `main` @ 52a89c4). Local commits only in this run; nothing deployed.

## Done
- M0 docs, M1 Lab slice (commit 0c06f6f).
- M1.5 redesign: `docs/RUNLAB_VISUAL_DIRECTION.md`; Lab tokens + components in `public/css/werunit.css` ("RUNLAB workspace");
  hero with the runner's own pace trace, composer + starter tiles, runtime capability states, evidence panel (KPIs, interactive
  weekly chart, coverage, sources), investigations with real stages, desktop 2-column workspace (`main.tab-lab` full width).
- Investigation: stepper, large answer tiles, "Kenapa ditanya?" expander, distinct Nggak tahu / Lewati, editable answers with
  dependent-answer invalidation, evidence card (split bar, coverage, missing data, confounders), run/recompute analysis,
  findings with charts + readouts + method inspector, research panel, honest hypothesis/limits/experiment sections.
- M2 `public/js/lab/analysis.js`: weekly / trend / compare / quality; typed results; snapshots keyed to answers.
- M3 `public/js/lab/research.js`: PubMed E-utilities + OpenAlex, normalize, dedupe, relevance filter, 14-day cache, save sources.
- Charts `public/js/lab/charts.js`; visual QA script `scripts/visual-qa.mjs`.

## Tests run (this session)
- unit 88/88 (before score work), runlab e2e 3/3. Full suite: see TEST_REPORT after the next run.

## Next three
1. Score relabel (ACWR descriptive, no % while calibrating, input provenance) + quick body-check fix (coarse field, no invented answers).
2. M4 provider contract (disabled, server-only design, consent UI copy) + research/lab unit tests.
3. Full suite, DESIGN.md truth update, TEST_REPORT, commit.

## Blockers
- Live PubMed/OpenAlex calls cannot be verified from the sandbox (host access declined); tested with real-shaped mocks.
- AI consultation needs owner decision + server + key (not configured, nothing faked).
