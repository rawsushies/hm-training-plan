# Research API fixtures (SYNTHETIC — not real papers)

These files mirror the **documented response shapes** of:

- NCBI E-utilities `esearch.fcgi` / `esummary.fcgi` (retmode=json) and `efetch.fcgi` (db=pubmed, rettype=abstract, retmode=xml)
  — https://www.ncbi.nlm.nih.gov/books/NBK25499/
- OpenAlex `GET /works` — https://docs.openalex.org/api-entities/works

Every record is **invented for offline testing**: titles start with `[FIXTURE]`, PMIDs are `999999xx`, DOIs use the prefix
`10.0000/werunit-fixture`, and the journal is "Fixture Journal of Running". They are used only by tests (`test/unit`,
`test/e2e`); the app never loads them and never shows them as research. Do not cite them.
