# RUNLAB progress (checkpoint)

Branch `claude/charming-cori-ge7n37` (based on `main` @ 52a89c4). Pushed to the feature branch only. Nothing is deployed,
merged or released. Local release manifest: 4.3.0 (stamped for `check:release`, not published).

## Done
- M0 docs, M1 Lab slice.
- M1.5 first redesign; **Redesign 2** (composition, not tokens: see `docs/RUNLAB_VISUAL_DIRECTION.md` §Redesign 2):
  - Question-first Lab home and a 1200 px evidence rail.
  - Investigation workspace: header band, canvas and inspector, two columns from 1240 px; collapsible inspector on phones.
  - The lead finding has an evidence grade, a key figure, an n strip (metric n vs eligible records + exclusions), a large
    chart with hover tooltip, a pinned readout and a method fold.
  - Conclusions block. Compact snackbar with ok/err kinds. FAB hidden on the Lab tab. Sticky analyse button on phones.
  - Styles in `public/css/runlab.css`.
- M2 `analysis.js`: weekly / trend / compare / quality, typed versioned results, snapshots keyed to answers.
  - **New:** `grade()` (descriptive / insufficient / observation / supported via a seeded permutation test) and
    `leadBand()`. No metric formula was changed.
- M3 `research.js`: hardened PubMed + OpenAlex adapters.
  - Per-request timeout; one retry with backoff on 429/5xx/network; the OpenAlex keyless-budget 429 is detected.
  - 14-day cache with origin labels (`live`, `cache`, `stale-cache`, `none`); offline serves the cache only.
  - Synthetic fixtures in `test/fixtures/research/` and offline tests. Docs: `docs/RUNLAB_RESEARCH.md`.
- M4 `consult.js` + `functions/runlab-consult.js` (scaffold, not exported or deployed); honest "Belum diatur" panel.
- Score audit fixes (ACWR descriptive, no Siap % before baseline, Beban provenance, quick check stored separately).
- Visual QA script `scripts/visual-qa.mjs`: 390, 768, 1440, 320, landscape; dark and light; screenshots inspected.

## Next three
1. M5 personal experiments (protocol, safety blocks, honest outcomes), reusing the grade + permutation machinery.
2. Lari tab: per-run provenance labels; carry the snackbar kinds to the rest of the app.
3. Real-device check on Android (touch inspection, safe areas); live PubMed/OpenAlex verification.

## Blockers / owner actions
- Live research calls can't be verified here because the sandbox network is restricted. These are listed as unverified in
  `docs/RUNLAB_RESEARCH.md`.
- AI consultation needs a provider choice, an API key in Secret Manager, Blaze/Cloud Run and budgets.
- Production: deploy the Firestore rules (lab collection) before hosting.
