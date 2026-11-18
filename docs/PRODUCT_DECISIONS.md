# Product decisions (product reset)

| # | Decision | Why |
|---|---|---|
| P1 | Three primary destinations: Hari ini, Coach, Plan. Settings is secondary. | Directive §2 target IA |
| P2 | ~~Strava stays blocked~~, superseded by P10 (display-only). | `STRAVA_INTEGRATION_FEASIBILITY.md`; policy text not fully verifiable from this sandbox |
| P3 | Working sources: manual entry (runner-reported) and Health Connect (Android, on device, needs a device test). No file import UI. | Owner rejects file import; both sources are permitted for on-device analysis |
| P4 | The coach is deterministic and on-device. Answers come from documented rules over the analysis engine and are labelled "aturan analisis, bukan AI". No data goes to an LLM. | No permitted provider + key. Health Connect AI-transfer terms are unclear. Strava forbids it. |
| P5 | Observations separate fact, interpretation and recommendation. Each shows window, n, coverage and confidence. | Directive §1B, §4 |
| P6 | No readiness score, no safety labels, no injury prediction. Pain → see a qualified professional. | Directive §1B, §1C |
| P7 | Removed or deferred features keep their data (sync, export, rules unchanged). Only UI and navigation change. | Directive §2, §5.10 |
| P8 | Keep the framework-free stack and the Instrument design system from v5 (tokens, primitives); recompose the screens. | Directive §5.2 (no greenfield rewrite) |
| P9 | The plan never increases load automatically after a completed week. Adjustments are proposed with a reason and applied only on confirmation. | Directive §1E |
| P10 | Strava is **display-only** (owner, 2026-11-18): last 7 days on demand, a 7-day device cache, never stored as runs, synced, analysed, used for plans or sent to AI. Off until the owner deploys the functions and enables the flag. | The owner wants Strava. No AI addresses §5.3 only; the analysis and storage limits (§5.4, §5.5/§6.2) still apply. |
