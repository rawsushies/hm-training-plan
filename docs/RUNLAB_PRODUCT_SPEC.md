# WeRunIt — Personal Running Lab (RUNLAB): product specification

**Promise:** ask a meaningful question about your running. WeRunIt looks at your own evidence, checks relevant research, explains
uncertainty, and helps you test what may actually work for you.

WeRunIt stays a fast daily running app (today's session, ✓ Selesai, timer, import, race tools). The **Lab** becomes the centre of
gravity: the loop *observe → ask → investigate → understand → test → learn*.

It is not: a Strava clone or social feed, a generic AI chatbot, a medical device, an injury predictor, or a black-box readiness score.
Package ID, Firebase project, domain, account identity and repository name stay unchanged. "RUNLAB" names the Lab area. The public name stays
"WeRunIt", with "Personal Running Lab" as positioning copy only (no global rebrand).

## 1. Information architecture

### Current (4.0.1)
Dock: **Hari ini · Lari · Race · Kamu**, plus the orange record button. Race is a first-class tab, and everything else lives under Kamu.

### Target (RUNLAB, from Milestone 1)
Dock: **Hari ini · Lab · Lari · Kamu**.

| Tab | Purpose | Contents |
|---|---|---|
| **Hari ini** | "What matters today?" in seconds | Today's session / rest day, ✓ Selesai / ▶ Mulai, week dots, a compact race countdown card (opens Race), weather when set, and a "Lanjutkan investigasi" card when an investigation is open. Scores stay until M2 re-labels them. |
| **Lab** | RUNLAB workspace | New investigation (free text or starter questions), open and past investigations, Lab tools (Workout Compiler: *Segera hadir*, disabled), status of data / analysis / research / AI. |
| **Lari** (Evidence) | The personal record | Run feed, details, import + duplicate review, check-ins, strength, shoes; from M2, source/coverage labels per field (measured / user-entered / derived / estimated). |
| **Kamu** | Profile, data control, everything else | Account, sync, export/backup, privacy, integrations, notifications, schedule, **Race** (workspace and events), shoes, friends, settings, tutorials. |

Race stays one tap away: the Hari ini countdown card and Kamu → Race. Deep links (`nav` to `race`) keep working.

## 2. The investigation flow (all milestones)

1. **Ask.** Free text or a starter. The question is classified by transparent keyword rules into a type: *performance trend,
   consistency, session comparison, environment, equipment, recovery observation, personal experiment*. The user sees why
   ("matched: pace, improving") and can change the type. There is no diagnosis category.
2. **One question at a time.** Each follow-up has a stated reason (missing variable, time window, comparison, interpretation). Every
   question can be skipped or answered "Nggak tahu"; both stay *unknown* and are never inferred. Earlier answers can be corrected.
   Facts already in the records are not asked again.
3. **Plan before analysis.** The investigation shows the question, date range, included records, fields available vs missing, the
   planned comparisons, and possible confounders. The scope can be corrected.
4. **Deterministic analysis** (M2). Versioned functions with typed outputs that list inputs, record IDs, window, filters, units,
   method, measured vs estimated, exclusions with reasons, and sample-size limits. Association, never causation.
5. **Research** (M3). PubMed/NCBI and OpenAlex (Crossref optional) metadata and abstracts with stable IDs. Nothing is cited unless it is
   verified. "No sufficiently relevant research found" is a valid result.
6. **Synthesis** (M4, credential-gated LLM). Sections: what your data shows / what research says / possible explanations
   (hypotheses) / what we cannot conclude / what to investigate next / safety note only when relevant.
7. **Saved, auditable record.** Original and corrected question, answers with timestamps, scope and record IDs, analysis version and
   outputs, sources, synthesis with provider/model, and the user's own conclusion. It can be revisited, edited, exported (JSON) and
   deleted. Snapshot vs recompute is stated.

**Milestone 1 delivers steps 1–3 and 7**, with an honest status: *analysis not yet available*, *research not connected*,
*AI not configured*. Nothing is mocked as a result.

## 3. Personal experiments (M5)

Each experiment records: hypothesis, baseline and observation windows, one primary variable, outcome measures and units, protocol,
inclusion rules, context variables, adherence and deviations, a pre-declared "meaningful difference" chosen by the user, dates and
status, results with uncertainty, and the user's interpretation. Unsafe protocols are blocked: sudden load jumps, dehydration,
supplements/medication, pain-provoking tests. If the result is too small or inconsistent, the outcome is "inconclusive".

## 4. Safety boundaries

Educational research companion, not healthcare. No diagnosis (injury, illness, eating disorder, mental health, overtraining syndrome),
no prescriptions, no "safe to run through pain". Acute red flags (chest pain, fainting, severe breathlessness, heat-stroke signs,
neurological symptoms, severe acute injury) → stop and seek urgent care. Persistent or recurring pain → see a qualified professional.
The tone is calm; ordinary questions get no alarm text.

## 5. Roadmap

| Milestone | Scope | Status |
|---|---|---|
| M0 | Audit, spec, architecture, migration plan, disposition matrix | this document set |
| M1 | Lab tab, investigations (create / one-question follow-ups / scope + missing data / save / reopen / edit / export / delete), honest status, Workout Compiler placeholder | in progress after M0 |
| M2 | Analysis engine (pace/duration trend in distance bands, weekly frequency/volume, matched run comparison, data-quality report); re-label scores (§5 of the audit) | planned |
| M3 | Scholarly retrieval (PubMed E-utilities, OpenAlex; Crossref optional), cache, citations | planned |
| M4 | LLM consultation behind a provider-neutral interface, server-side, consent, budgets; deterministic fallback | planned, **needs owner decision on provider and billing** |
| M5 | Personal experiments | planned |
| Later | **Workout Compiler (RUNPROTOCOL)**: natural-language prescription → typed steps → validate → visualize → export → planned vs done. Placeholder only until then; the existing timer and schedule are not the compiler. | placeholder card in Lab tools |
| Later, separate product | **STRIDETRANSIT**: running-first multimodal mobility, Jabodetabek first. Roadmap note only, no code, no UI placeholder; must stay decoupled from the analysis engine. | roadmap only |
