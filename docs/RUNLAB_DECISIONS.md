# RUNLAB decisions

| # | Decision | Why |
|---|---|---|
| D1 | Keep the classic-script, no-build architecture; new code under `public/js/lab/` (pure modules + one view module). | Directive; no measured limitation requires a framework. |
| D2 | Lab records are a private sync collection `lab/{id}` with strict rules payload checks; denied `lab` reads never break sync on older rules. | Additive, account-isolated, same conflict handling as runs. |
| D3 | Analyses are pure, versioned (`weekly-1`, `trend-1`, `compare-1`, `quality-1`) and return one typed shape. Snapshots store exact record ids (≤400), method version and an `answersKey`; changing answers makes a snapshot stale instead of silently reusing it. | Reproducibility and "recompute vs saved snapshot" honesty. |
| D4 | Pace analyses use only runs with recorded duration; implausible paces (outside 2:30–20:00 /km) are flagged and excluded, never corrected. Minimum 3 runs per group/half, else "Belum cukup data". | No estimated evidence; avoid single-sample claims. |
| D5 | Time-of-day comparison only uses imported start times (`extId t:…`); manual runs are excluded with the reason "jam mulai tidak tercatat". Heat questions get no analysis because temperature is not measured (weather is free text). | Never infer missing variables. |
| D6 | Research uses PubMed E-utilities + OpenAlex directly from the browser (both document CORS, no key needed); results are filtered for running relevance, deduplicated by DOI → PMID, cached 14 days locally, and only provider fields are stored. | No server or billing needed for M3. Live calls were **not verifiable** from the build sandbox (host access declined); tested with real-shaped mocks. |
| D7 | No `email`/`mailto` sent to NCBI/OpenAlex (only `tool=werunit`). | Never send the user's email to third parties; NCBI recommends but does not require it at low volume. |
| D8 | AI consultation stays **not configured**: capability chip says so; no mock output anywhere. A provider-neutral contract is documented for a future server-side adapter. | Directive; no key, no budget, no server authorized. |
| D9 | Glass: only the nav/segmented spring pill (owner's motion spec). Everything else solid; gradients only in the Lab hero trace lane. | Resolve DESIGN.md vs CSS contradiction truthfully. |
| D10 | The 4.0 auto "headline/sub/Detail" paragraph splitter skips the Lab (`.lab2`). | Lab text is already structured; the splitter produced odd "Detail" folds. |
| D11 | Strava-origin runs stay usable for on-device calculations but are flagged and will be excluded from any AI payload. | Strava terms prohibit AI use; local deterministic math on the user's own export is not an AI use. |
