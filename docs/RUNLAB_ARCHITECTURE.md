# RUNLAB architecture

Constraints kept: framework-free classic scripts served from `public/`, no build step, no new framework, PWA + Capacitor shell
unchanged. New code lives in `public/js/lab/`. Pure logic is separated from DOM code and is importable by the Node test runner.

## 1. Layers

| Layer | Responsibility | Where | Runs |
|---|---|---|---|
| Data | The user's private records (existing) + Lab records (`lab/{id}`) | `logic.js` record model, `sync.js`, Firestore `users/{uid}/…` | device (offline-first), synced |
| Analysis | Deterministic, versioned functions over records → typed results with inputs, method, units, exclusions | `public/js/lab/analysis.js` (M2) | device, offline |
| Research | Scholarly search + normalization + cache | `public/js/lab/research.js` (M3); server proxy only if a key is needed | online only; clearly "unavailable" offline |
| Language | Follow-up wording and synthesis over the evidence supplied to it, nothing else | provider adapter behind a server endpoint (M4) | server, credential-gated |

The LLM never computes statistics, fills missing inputs, drops outliers, or adds sources that the research layer did not supply.

## 2. Modules (M1)

- `public/js/lab/lab.js` (pure, `globalThis.WRI_LAB`):
  - `classify(question)` → `{type, matched[]}` from transparent keyword rules (Indonesian + English).
  - `nextQuestion(inv, ctx)` → the next unanswered follow-up `{k, q, why, opts, kind}` for the type, or `null`.
    Skip / "Nggak tahu" are stored as explicit `{v: null, state: "skipped" | "unknown"}`.
  - `scope(inv, state)` → date window, included and excluded record IDs with reasons (sample, outside window, filters), field
    coverage counts (distance, duration, pace, HR, elevation, RPE, shoe, weather text, start time, cadence = never stored), planned
    comparisons and confounders for the type.
  - `cleanInvestigation(x)` → sanitizer (sizes, enums, dates) used by `sanitizeState` and on import.
  - `exportJson(inv, scope)` → a self-describing export (`schema`, `exportedAt`, method versions).
- `public/js/lab/views-lab.js` (UI): Lab tab, investigation page, one-question card (reuses the Tanya-Kiki pattern visually),
  scope panel, status badges (analysis / research / AI), tools list with the disabled **Workout Compiler** card.

Seams for later milestones: `WRI_LAB.ANALYSES` (registry, empty in M1), `WRI_LAB.research` (adapter slot), and
`WRI_LAB.provider` (`{id, available(): false}` in M1, `NullProvider`). Workout Compiler gets a reserved namespace,
`WRI_PROTOCOL`, which is not created yet.

## 3. Data model (additive)

`S.lab = { [id]: Investigation }`, synced as record `lab/{id}` (one document per investigation, envelope `{data, rev, deleted, …}`
like every other record):

```
Investigation {
  id, schema: 1, createdAt, updatedAt (ISO),
  question: string ≤ 500, questionEdited?: string ≤ 500,
  type: "performance"|"consistency"|"comparison"|"environment"|"equipment"|"recovery"|"experiment",
  typeSource: "auto"|"user", matched: string[] ≤ 8,
  answers: { [key]: { v: string|number|null, state: "answered"|"skipped"|"unknown", at: ISO } },   // ≤ 12 keys
  status: "draft"|"scoped"|"closed",
  notes?: string ≤ 2000,                     // user's own conclusion
  snapshots?: [] (M2: analysis outputs with method version + record ids, size-capped)
}
```

Size is bounded (well under 50 KB per document; Firestore's limit is 1 MiB). There are no transcripts in one document; M4 turn
records go in a separate `labturns/{id}` collection if needed. Research cache (M3): shared, non-personal scholarly metadata belongs in
a top-level read-only cache written by a server, or on the device. It never goes under a user's private path together with queries
that contain personal data.

Privacy:
- Lab records are private (owner-only rules, same as runs).
- Never included in friend shares, the profile directory, or notifications.
- Exported and deleted per investigation.

## 4. Security and the AI path (M4)

- Secrets (LLM, any scholarly key) live in Secret Manager behind an HTTPS function in `asia-southeast2`. Nothing goes in `public/`,
  localStorage, Firebase web config or the APK.
- Every request verifies the Firebase ID token and authorizes by UID. Input size limits, schema validation, per-user rate limits and
  monthly budgets, timeouts, and CORS restricted to `we-run-it.web.app`, `we-run-it.firebaseapp.com` and the Capacitor origin.
- No logging of raw notes, prompts, GPS or tokens.
- Explicit consent before any user data leaves the device for an LLM. Minimal fields: only the records in the investigation's scope,
  and no GPS or route unless the user opts in.
- Response contract `LabFinding` (versioned) with observations / research / hypotheses / unknowns / confounders / follow-up /
  experiment / safety. It is validated on server and client. Citations must reference source IDs returned by the research layer;
  anything else is rejected.
- **Strava**: API-derived data is never sent to an LLM, used for grounding or embeddings, or used for training. CSV imports tagged
  `src: "Strava"` are excluded from AI input by default until rights are cleared.

## 5. AI / data cost and privacy threat assessment

| Item | Assessment |
|---|---|
| LLM cost | Per-token API billing, separate from any consumer subscription (a Claude.ai or ChatGPT plan does not include API use). Needs an owner-held API key, a budget cap per user/month and a global cap, and a deterministic fallback when the cap is hit. **Not enabled without owner decision.** |
| Server cost | Firebase Functions requires the **Blaze** plan (billing account). Not enabled. Alternative: Cloud Run with the same constraints. |
| Scholarly APIs | NCBI E-utilities: free; without an API key 3 req/s, with a key 10 req/s; tool/email identification is expected. OpenAlex: free; a polite pool with a contact email is recommended. Crossref: free; polite pool with mailto. All must be cached and backed off. Verify current limits before M3. |
| Threats | Prompt injection via abstracts or user notes: treat source text as data and validate outputs. Hallucinated citations: rejected by the contract. Cross-account access: UID authorization plus rules tests. Data leakage to the provider: consent, minimization, no identifiers. Health-adjacent notes: private by default, excluded from sharing. |
| Offline | Lab investigations, scope, and (M2) deterministic analysis work offline. Research and AI show "tidak tersedia offline". |

## 6. Testing strategy

- **Unit** (`test/unit/lab.test.js`): classification, follow-up order, skip/unknown semantics, scope counts and exclusions, sample
  data never included, sanitizer bounds, export shape.
- **Rules**: `lab` is an owner-only sync collection, and other accounts and friends are denied.
- **e2e**: create → answer/skip/correct → scope → save → reopen → edit → export → delete; the Workout Compiler card is disabled;
  no element claims AI or research output; existing flows (✓ Selesai, import, race via Kamu) still work.
