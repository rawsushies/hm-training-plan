# RUNLAB research retrieval (M3)

Module: `public/js/lab/research.js` (`WRI_RESEARCH`). Providers: **PubMed via NCBI E-utilities** and **OpenAlex**.
No paid service. No key or secret in the app. The user's email or other identity is never sent.

## Request contracts used

| Step | Request | Notes |
|---|---|---|
| PubMed search | `GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=8&tool=werunit&term=…` | `esearchresult.idlist` |
| PubMed summaries | `GET …/esummary.fcgi?db=pubmed&retmode=json&tool=werunit&id=…` | `result[uid]`: `title, authors[].name, pubdate, fulljournalname/source, pubtype[], articleids[{idtype:"doi"}]` |
| PubMed abstracts | `GET …/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&tool=werunit&id=…` | `PubmedArticle > MedlineCitation > PMID`, `Abstract > AbstractText[@Label]` |
| OpenAlex works | `GET https://api.openalex.org/works?search=…&per-page=8&filter=type:article\|review&select=…` | `results[]`: `id, doi, display_name, publication_year, authorships[].author.display_name, primary_location.source.display_name, abstract_inverted_index, type, ids.pmid` |

**Provider policies (checked by web search on 18 Nov 2026; the official pages could not be opened from the sandbox):**
- **NCBI:** stay at or below 3 requests per second without a key. `tool` and `email` are requested in every call. We send
  `tool=werunit` and space requests 350 ms apart. We do **not** send an email: there is no project contact address yet, and
  the user's address must never be sent. Add a project contact before any high-volume use.
  ([NCBI E-utilities guide](https://www.ncbi.nlm.nih.gov/books/NBK25497/))
- **OpenAlex:** since early 2026 a free API key is strongly recommended, and `mailto` is no longer honoured. Keyless calls draw
  from a small daily budget shared per IP address (reported around 100 searches a day) at up to 10 requests per second. When the
  budget runs out, the API returns **429 "Insufficient budget"** until midnight UTC. The app calls OpenAlex keyless, which is
  fine for one person's use because each phone has its own IP, and shows the budget message plainly when hit. A key may be
  added **only** through a future server proxy, never in client code.
  ([OpenAlex LLM quick reference](https://docs.openalex.org/api-guide-for-llms),
  [rate limits & authentication](https://github.com/ourresearch/openalex-docs/blob/main/how-to-use-the-api/rate-limits-and-authentication.md),
  [error handling](https://help.openalex.org/api/errors/))

## Behaviour

- **Query:** built from the investigation type and answers only (e.g. "time of day running performance"). No names, notes,
  email or other personal data.
- **Normalization:** id = `doi:` → `pmid:` → `openalex:`, plus title, authors (≤12), year, journal, kind, link, excerpt
  (≤420 chars of the provider's own abstract) and retrieval time.
  - **Kind** comes from metadata: PubMed `pubtype` (meta-analysis, review, RCT, guideline, primary) or OpenAlex `type`
    (review/article).
  - Missing fields stay empty or null.
- **Dedupe** by DOI (case-insensitive), then PMID. PubMed metadata wins, and OpenAlex fills gaps.
- **Relevance filter:** a result is kept only if its title or abstract mentions running, runners, marathon or jogging. "Not
  enough relevant research" is a valid result.
- **Robustness:**
  - Per-request timeout (12 s, AbortController).
  - One retry after a short backoff on 429/5xx or a network error. Exception: the OpenAlex "Insufficient budget" 429 is not
    retried.
  - Malformed JSON or XML is reported as an error, never a crash.
  - If one provider fails, results from the other are still shown, with a note.
- **Cache:** `localStorage hmtp:lab:research:v1`, 14 days, up to 20 queries.
  - `origin` on every result: `live` | `cache` | `stale-cache` | `none`.
  - Offline: cache only, labelled.
  - If both providers fail, the last cached result is shown, labelled as old.
- **Untrusted text:** markup is stripped on parse and escaped on render; the text is never executed or treated as instructions.

## Tests

| Test | Network | Status |
|---|---|---|
| `test/unit/research-fixtures.test.js`: parsing (labelled abstracts, entities), normalization, dedupe, relevance filter, timeout, retry/backoff, malformed JSON, partial failure, cache/offline/stale, markup stripping | none (synthetic fixtures in `test/fixtures/research/`, marked `[FIXTURE]`) | passing |
| `test/unit/research.test.js`: query privacy, end-to-end pipeline with fake fetch | none | passing |
| `test/e2e/runlab.test.js`: research in the real UI with routed responses shaped like the APIs | none (Playwright `route`) | passing |
| **Live PubMed E-utilities call from a browser/WebView (CORS, real field values)** | **required** | **unverified**: sandbox network policy blocks the host |
| **Live OpenAlex call (keyless budget, real 429 body)** | **required** | **unverified** |
| **Android WebView behaviour of both** | required + device | **unverified** |

### Manual live check (when network allows)
```bash
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&tool=werunit&term=running%5Btiab%5D" -H "Origin: https://we-run-it.web.app" -D - | head -20
```
```bash
curl -s "https://api.openalex.org/works?search=running%20economy&per-page=2" -H "Origin: https://we-run-it.web.app" -D - | head -20
```
Look for `Access-Control-Allow-Origin` in both responses. Then open Lab → an investigation → Analysis → "Cari riset terkait"
on the live site.
