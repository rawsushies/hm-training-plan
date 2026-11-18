# Strava integration feasibility (product reset, M0)

Status (updated 2026-11-18): **DISPLAY-ONLY, built and tested, not deployed.**

The owner chose display-only after being told that dropping AI does not lift the analysis and storage limits. What
display-only means:

- OAuth connect through our server function. The secret stays server-side; tokens are kept in `serverOnly/**`.
- On demand, the server lists the athlete's activities from the last 7 days and returns only display fields.
- The app keeps them in **this device's localStorage for at most 7 days**, per account.
- They are shown back to the same athlete in Coach ("Strava · 7 hari terakhir"), as day tags in Plan, and as the
  connection state in Settings.
- **Never:** written to Firestore, saved as runs, synced, exported, analysed by the coach, used to change the plan, or
  sent to any AI or third party.
- Disconnect revokes access at Strava (`/oauth/deauthorize`) and deletes the stored tokens and the device cache.
- The webhook handles only athlete de-authorisation.
- Code: `functions/index.js`, `functions/strava-core.js`, `public/js/coach/strava.js`.
- Tests: `test/unit/strava.test.js` and the e2e "Strava display-only" test, with the endpoints mocked.
- **To activate (owner):**
  1. Firebase Blaze plan.
  2. A Strava API app (plus any subscription Strava requires).
  3. `firebase functions:secrets:set STRAVA_CLIENT_SECRET`.
  4. Params `STRAVA_CLIENT_ID`, `STRAVA_VERIFY_TOKEN` and `APP_URL`.
  5. Add `functions` to `firebase.json`.
  6. Deploy.
  7. Set `window.HMTP_STRAVA_ENABLED = true` in `public/firebase-config.js`.
  8. Set the Strava app's callback domain to the functions host.
- Still **not verified** against the full policy text (the site is unreachable from this sandbox). The questions below
  still apply.

Earlier status: BLOCKED. No Strava OAuth, no Strava data ingestion, no Strava data to any AI.
Date checked: 2026-11-18, on branch `claude/charming-cori-ge7n37`.

## How this was checked, and what could not be checked

- `www.strava.com`, `developers.strava.com` and `support.strava.com` cannot be reached from this build sandbox. The direct
  fetch of https://www.strava.com/legal/api_policy failed with DNS `ENOTFOUND`. The owner asked not to request network
  changes, so none were requested.
- A web search returned fragments of the official policy page and the official FAQ page, plus third-party commentary.
  **The full current text of §§3.5, 5.3, 5.4, 5.5, 5.16 and 6.2 was not read directly.** Before any implementation, the
  owner (or a session that can reach strava.com) must read those sections in full.
- Everything below that is marked *(secondary)* comes from commentary, not from Strava.

## Intended use

- One runner (the owner) uses WeRunIt on their own devices to:
  - store training history persistently;
  - compute deterministic analytics (consistency, volume, long runs, intensity, pace trends);
  - ask a coach questions in natural language;
  - get adaptive training plans.
- The app is non-commercial, but the code is general. Anyone who signs in gets the same features, so it is technically
  multi-user even if only one person uses it today.

## Relevant clauses

| Clause | What it governs | Source checked |
|---|---|---|
| Effective date | The policy took effect on 1 June 2026. | Official page fragment + news |
| §3.5 (MCP exception) | Strava subscribers may use the Strava MCP for personal use of their own data and may bring their own AI application. The MCP may not be used to enable commercial or third-party access. | Official page fragment (search) |
| §5.3 (AI) | Strava Data, including derived data, may not be used in an AI Application. This reportedly includes inference, context-window ingestion, retrieval and embeddings, not just training. | *(secondary)*: Sahha blog, Strava community forum, owner's directive |
| §5.4 (analytics) | Restricts processing Strava Data for analytics or analysis, and combining it with other data. | *(secondary)*: forum; owner's directive |
| §5.5 / §6.2 (storage) | Persistent storage restricted; caching limited to 7 days. | *(secondary)*; owner's directive |
| §5.16 | Strava's MCP is the sole authorised agent-mediated interface. Operating an MCP server, proxy or equivalent for Strava data is prohibited. | *(secondary)*: Scalekit; owner's directive |
| Access tier | Standard-tier API developers need a Strava subscription (from 1 June 2026 for new developers, 30 June 2026 for existing ones). | *(secondary)*: TechRepublic |

## Permitted vs not permitted for this app

| Operation | Conclusion |
|---|---|
| OAuth + fetch activities + store them persistently in Firestore | **Not permitted** (persistent storage limit, 7-day cache) |
| Compute analytics (trends, weaknesses) from Strava activities | **Not permitted** (§5.4 analysis restriction, as summarised in the directive) |
| Send Strava activities or derived metrics to an LLM for coaching | **Not permitted** (§5.3, including derived data and context-window use) |
| Pre-process, anonymise or convert to metrics first, then use in AI | **Not permitted** (derived data is covered; the directive forbids these workarounds) |
| Build a custom Strava MCP server or proxy for the app | **Not permitted** (§5.16) |
| Owner, as a Strava subscriber, uses Strava's own MCP from Claude to ask questions about their own data | Appears permitted for personal use under §3.5. **This happens in Claude, outside this app.** The MCP is not a general API that WeRunIt can embed, and embedding it would make WeRunIt the intermediary. |
| Display an athlete's own Strava activities back to them, without analysis or AI | Possibly permitted under the general API terms, but useless for this product, whose purpose is analysis and coaching. Not built. |

### Personal vs multiple users

- Separate OAuth consent per athlete does **not** make prohibited processing permitted. The restriction is on the processing,
  not on who consents.
- For the owner alone, the only clearly described path is Strava's own MCP inside a supported AI client (Claude). That path
  cannot feed WeRunIt's analysis engine or plans.

## What is in the repository today

- `functions/index.js`: a Strava OAuth/webhook **scaffold**. It is not exported, not deployed, and not wired into the UI.
  It stays disabled and must not be deployed for analytics or coaching.
- The app labels Strava as unavailable. The product reset adds an explicit "Diblokir oleh kebijakan Strava" state in Settings.
- The provider registry (`public/js/coach/model.js`) registers Strava with status `blocked` and a reason. `connect()` throws.

## Technical prerequisites (only if Strava ever confirms the use in writing)

- A Strava API application at Standard tier with a subscription.
- A server-side client secret in Secret Manager.
- A Firebase Blaze plan for Cloud Functions.
- OAuth state, redirect-URI, scope, refresh and revocation handling.
- None of this is useful until the policy question is answered.

## Questions to send to Strava (developers@strava.com, or the developer community hub)

1. A non-commercial app is used by one athlete, the app's own developer, on their own Strava data. May it store that
   athlete's activities beyond 7 days and compute training analytics (weekly volume, pace trends, intensity distribution)
   for display to that same athlete?
2. Does §5.3 prohibit sending that athlete's own activity data, or metrics derived from it, to an LLM to generate coaching
   answers shown only to that athlete, when the athlete initiates each request?
3. Can a subscriber's §3.5 personal MCP use be invoked from a self-built personal app, or only from Strava-listed AI clients
   such as Claude?

Until Strava answers in writing, the integration stays at this documented boundary.

## Alternatives checked

| Source | Status for this product |
|---|---|
| **Manual entry by the runner** (date, distance, time, effort) | Permitted: it is the runner's own input. This is the working source today. |
| **Health Connect (Android)** | Read-only exercise and distance code already exists and still needs a device test. Google Play treats Health Connect data as personal and sensitive user data: access only for user-facing health features, no transfer or sale to third parties. **On-device deterministic analysis fits that.** No official clause on sending the data to an LLM was found, so the coach does **not** send Health Connect data to any AI. A Play Console health declaration is needed before a store release. Sources: [Health Connect policy FAQ](https://support.google.com/googleplay/android-developer/answer/12991134), [Sahha summary (secondary)](https://sahha.ai/blog/health-api-ai-restrictions/). |
| GPX/FIT/TCX/CSV file import | Works in code, but the owner rejected it as the ingestion workflow. Its UI is removed in the reset; data imported earlier is kept. |
| Garmin, COROS, Suunto, Huawei | Partner programmes only. Not investigated further. |

## Sources

- [Strava API Policy (official; only fragments readable from this sandbox)](https://www.strava.com/legal/api_policy)
- [Strava API and MCP FAQ (official; only fragments readable)](https://support.strava.com/en-us/articles/15401526-strava-api-and-mcp-faq)
- Required reading not reachable from here:
  - [API Agreement](https://www.strava.com/legal/api)
  - [Authentication](https://developers.strava.com/docs/authentication/)
  - [API reference](https://developers.strava.com/docs/reference/)
- Secondary:
  - [Sahha, health API AI restrictions](https://sahha.ai/blog/health-api-ai-restrictions/)
  - [Scalekit, Strava MCP vs API](https://www.scalekit.com/blog/strava-mcp-vs-api)
  - [Strava community: is my app compliant](https://communityhub.strava.com/developers-api-7/is-my-app-compliant-13485)
  - [Strava community: is a coach personal use](https://communityhub.strava.com/developers-api-7/api-terms-is-an-athlete-s-coach-considered-personal-use-13581)
  - [Strava community: §5.3 and inference on derived metrics](https://communityhub.strava.com/developers-api-7/does-api-policy-5-3-permit-inference-only-llm-use-on-derived-metrics-no-training-13565)
  - [TechRepublic, Strava tightens API access](https://www.techrepublic.com/article/news-strava-api-scraping-crackdown/)
  - [vorplabs, Strava MCP](https://vorplabs.com/agent-tools/strava-mcp)
