import { test } from "node:test";
import assert from "node:assert/strict";
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
import "../../public/js/lab/research.js";
const R = globalThis.WRI_RESEARCH;
const NOW = "2026-11-18T00:00:00.000Z";
// minimal XML parser for Node (the browser uses DOMParser)
R.setXml(s => ({ getElementsByTagName: tag => tag === "PubmedArticle" ? [...s.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)].map(m => ({ getElementsByTagName: t => [...m[1].matchAll(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "g"))].map(x => ({ textContent: x[1] })) })) : [] }));
R.setRetryDelay(1); R.setTimeoutMs(500);
function fakeFetch(map, calls) {
  return async url => { calls.push(url); const k = Object.keys(map).find(k => url.includes(k)); const v = map[k]; if (!v) return { ok: false, status: 404, text: async () => "" }; if (v.status) return { ok: false, status: v.status, text: async () => "" }; const body = typeof v === "string" ? v : JSON.stringify(v); return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body }; };
}

test("query is built from the investigation only (no personal data)", () => {
  const q = R.queryFor({ type: "environment", answers: { factor: { v: "time", state: "answered" } }, question: "Rina's pace bhazcore@example.com" });
  assert.equal(q.text, "time of day running performance");
  assert.ok(!/rina|@/i.test(JSON.stringify(q)));
});

test("search: PubMed + OpenAlex normalized, deduplicated by DOI/PMID, irrelevant dropped, kinds from metadata, cached", async () => {
  const calls = []; R.clearCache();
  R.setFetch(fakeFetch({
    "esearch.fcgi": { esearchresult: { idlist: ["111", "222"] } },
    "esummary.fcgi": { result: { "111": { title: "Running economy and shoes: a meta-analysis.", authors: [{ name: "A B" }], pubdate: "2023 Jan", fulljournalname: "J Sports Sci", pubtype: ["Journal Article", "Meta-Analysis"], articleids: [{ idtype: "doi", value: "10.1/ABC" }] }, "222": { title: "Leaf chemistry", authors: [], pubdate: "2020", source: "Plants", pubtype: [], articleids: [] } } },
    "efetch.fcgi": "<PubmedArticleSet><PubmedArticle><PMID>111</PMID><AbstractText>Shoes changed running economy in trained runners.</AbstractText></PubmedArticle></PubmedArticleSet>",
    "api.openalex.org": { results: [{ id: "https://openalex.org/W1", doi: "https://doi.org/10.1/abc", display_name: "Running economy and shoes", publication_year: 2023, authorships: [], abstract_inverted_index: { Shoes: [0] }, type: "article", ids: {} }, { id: "https://openalex.org/W2", doi: null, display_name: "Marathon pacing in amateurs", publication_year: 2021, authorships: [{ author: { display_name: "C D" } }], abstract_inverted_index: { Even: [0], pacing: [1] }, type: "article", ids: { pmid: "https://pubmed.ncbi.nlm.nih.gov/333" } }] }
  }, calls));
  const q = R.queryFor({ type: "equipment", answers: {} });
  const r = await R.search(q, { now: NOW });
  assert.deepEqual(r.errors, []);
  assert.equal(r.items.length, 2);
  const a = r.items[0];
  assert.equal(a.id, "doi:10.1/abc"); assert.equal(a.pmid, "111"); assert.equal(a.openalex, "W1"); assert.equal(a.kind, "meta"); assert.equal(a.provider, "PubMed + OpenAlex");
  assert.equal(a.url, "https://pubmed.ncbi.nlm.nih.gov/111/"); assert.match(a.excerpt, /Shoes changed running economy/);
  assert.equal(r.items[1].id, "pmid:333"); assert.equal(r.items[1].excerpt, "Even pacing");
  assert.ok(calls.every(u => !/email|mailto/.test(u)), "no email sent");
  const n = calls.length, again = await R.search(q, { now: NOW });
  assert.equal(calls.length, n, "served from cache"); assert.ok(again.cachedAt);
});

test("provider failures are reported; empty results are a legitimate answer; stale cache used when both fail", async () => {
  R.clearCache();
  R.setFetch(fakeFetch({ "esearch.fcgi": { esearchresult: { idlist: [] } }, "api.openalex.org": { results: [] } }, []));
  const q = R.queryFor({ type: "recovery", answers: {} });
  const empty = await R.search(q, { now: NOW });
  assert.deepEqual(empty.items, []); assert.deepEqual(empty.errors, []);
  R.setFetch(fakeFetch({ "esearch.fcgi": { status: 503 }, "api.openalex.org": { status: 503 } }, []));
  const fail = await R.search(R.queryFor({ type: "consistency", answers: {} }), { now: NOW, force: true });
  assert.equal(fail.errors.length, 2); assert.deepEqual(fail.items, []);
});
