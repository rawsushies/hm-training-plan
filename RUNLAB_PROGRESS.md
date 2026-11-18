# RUNLAB progress (checkpoint)

Branch `claude/charming-cori-ge7n37` (based on `main` @ 52a89c4). Commits are local in this run unless noted; nothing deployed.
Release manifest: 4.2.0.

## Done
- M0 docs, M1 Lab slice (0c06f6f).
- M1.5 redesign (123288c): visual direction doc, Lab tokens/components (dark+light), desktop workspace, hero pace trace,
  composer + starter tiles, runtime capability states, evidence panel, investigation stepper/tiles/inspector.
- M2 `analysis.js`: weekly / trend / compare / quality, typed versioned results, snapshots keyed to answers (stale on change).
- M3 `research.js`: PubMed E-utilities + OpenAlex, normalize/dedupe/relevance filter/14-day cache, saved sources.
- M4 `consult.js` + `functions/runlab-consult.js` (scaffold, not exported/deployed): consent payload builder (no notes/ids/
  Strava), finding validator (rejects unverified citations and diagnostic/clearance language), honest "Belum diatur" panel.
- Score audit fixes: ACWR descriptive, no Siap % before baseline, Beban input provenance disclosed, quick body check stored
  as `quickChecks` (no invented answers), DESIGN.md truth notes.
- Visual QA script `scripts/visual-qa.mjs` (390, 768, 1440, 320, landscape; dark+light) — screenshots inspected.

## Next three
1. M5 personal experiments (protocol, safety blocks, honest outcomes) — only after reviewing the core on a phone.
2. Evidence: Lari tab coverage/provenance labels per run; trend chart band filter persistence.
3. Real-device check of Lab on Android; live PubMed/OpenAlex verification from a network that allows them.

## Blockers / owner actions
- Live research calls not verifiable here (sandbox host access declined); tested with real-shaped mocks.
- AI consultation: needs provider choice, API key in Secret Manager, Blaze/Cloud Run, budgets.
- Production: deploy Firestore rules (lab collection, quick checks use existing plan rules) before hosting.
