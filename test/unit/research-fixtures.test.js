// Offline tests for the PubMed (E-utilities) and OpenAlex adapters using SYNTHETIC fixtures in test/fixtures/research/.
// No test here touches the network. Live-API behaviour is listed as unverified in docs/RUNLAB_RESEARCH.md.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
await import("../../public/js/lab/research.js");
const R = globalThis.WRI_RESEARCH;
const fx = f => readFileSync(new URL(`../fixtures/research/${f}`, import.meta.url), "utf8");
const NOW = "2026-11-18T00:00:00.000Z";
const Q = () => R.queryFor({ type: "environment", answers: { factor: { v: "time", state: "answered" } } });

/** Fake fetch routed by URL substring. A route value may be: string/object body, {status}, "hang", "neterr", or a function. */
function route(map, calls = []) {
  return (url, opts = {}) => {
    calls.push(url);
    const k = Object.keys(map).find(k => url.includes(k)); let v = map[k];
    if (typeof v === "function") v = v(calls.filter(u => u.includes(k)).length);
    if (v === undefined) return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
    if (v === "hang") return new Promise((_, rej) => { if (opts.signal) opts.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))); });
    if (v === "neterr") return Promise.reject(new TypeError("Failed to fetch"));
    if (v && v.status) return Promise.resolve({ ok: false, status: v.status, json: async () => ({}), text: async () => "" });
    const body = typeof v === "string" ? v : JSON.stringify(v);
    return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body });
  };
}
const FULL = () => ({ "esearch.fcgi": fx("pubmed-esearch.json"), "esummary.fcgi": fx("pubmed-esummary.json"), "efetch.fcgi": fx("pubmed-efetch.xml"), "api.openalex.org/works": fx("openalex-works.json") });
beforeEach(() => { R.clearCache(); R.setTimeoutMs(200); R.setRetryDelay(1); });

test("PubMed XML parser: labelled abstract sections joined, entities decoded, one entry per PMID", () => {
  const abs = R.parsePubmedXml(fx("pubmed-efetch.xml"));
  assert.deepEqual(Object.keys(abs), ["99999901", "99999902"]);
  assert.match(abs["99999901"], /^BACKGROUND: \[FIXTURE\] Synthetic abstract for offline tests\. RESULTS: \[FIXTURE\] Running time-trial/);
  assert.match(abs["99999902"], /pace & perceived effort/);
  assert.deepEqual(R.parsePubmedXml("not xml at all"), {});
});

test("adapters normalize documented fields: ids, authors, year, journal, kind, url, excerpt; nothing invented", async () => {
  R.setFetch(route(FULL()));
  const pm = await R.pubmed(Q(), NOW);
  assert.equal(pm.length, 3);
  const a = pm[0];
  assert.equal(a.id, "doi:10.0000/werunit-fixture.1"); assert.equal(a.pmid, "99999901"); assert.equal(a.doi, "10.0000/werunit-fixture.1");
  assert.equal(a.year, 2024); assert.equal(a.journal, "Fixture Journal of Running"); assert.equal(a.kind, "meta");
  assert.equal(a.url, "https://pubmed.ncbi.nlm.nih.gov/99999901/"); assert.deepEqual(a.authors, ["Fixture A", "Testcase B", "Sample C", "Mock D"]);
  assert.equal(pm[1].kind, "rct"); assert.equal(pm[1].doi, null, "no DOI in the record → null, not guessed");
  const oa = await R.openalex(Q(), NOW);
  assert.equal(oa.length, 2, "record without a title is dropped");
  assert.equal(oa[0].doi, "10.0000/WERUNIT-FIXTURE.1"); assert.equal(oa[0].pmid, "99999901"); assert.equal(oa[0].kind, "review");
  assert.equal(oa[0].excerpt, "[FIXTURE] Synthetic abstract."); assert.equal(oa[1].journal, "", "missing source stays empty");
});

test("search pipeline: DOI dedupe across providers (case-insensitive), relevance filter, provenance + 'live' origin", async () => {
  const calls = []; R.setFetch(route(FULL(), calls));
  const r = await R.search(Q(), { now: NOW });
  assert.equal(r.origin, "live"); assert.deepEqual(r.errors, []);
  assert.deepEqual(r.items.map(x => x.id), ["doi:10.0000/werunit-fixture.1", "pmid:99999902", "doi:10.0000/werunit-fixture.4"]);
  assert.equal(r.items[0].provider, "PubMed + OpenAlex"); assert.equal(r.items[0].openalex, "W9999990001");
  assert.ok(!r.items.some(x => /leaf movement/i.test(x.title)), "irrelevant plant paper filtered out");
  assert.ok(r.items.every(x => x.retrievedAt === NOW && x.title.startsWith("[FIXTURE]")));
  assert.ok(calls.every(u => /^https:\/\/(eutils\.ncbi\.nlm\.nih\.gov|api\.openalex\.org)\//.test(u)), "only the two documented hosts");
  assert.ok(calls.every(u => !/email|mailto|api_key/.test(u)), "no email or key sent");
  assert.ok(calls.some(u => /tool=werunit/.test(u)));
});

test("empty result is a legitimate answer (not an error)", async () => {
  R.setFetch(route({ "esearch.fcgi": fx("pubmed-esearch-empty.json"), "api.openalex.org/works": { meta: { count: 0 }, results: [] } }));
  const r = await R.search(Q(), { now: NOW });
  assert.deepEqual(r.items, []); assert.deepEqual(r.errors, []); assert.equal(r.origin, "live");
});

test("timeouts abort hung requests; one provider failing still returns the other with an error note", async () => {
  R.setFetch(route(Object.assign(FULL(), { "esearch.fcgi": "hang" })));
  const t0 = Date.now(), r = await R.search(Q(), { now: NOW });
  assert.ok(Date.now() - t0 < 2000, "did not wait forever");
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /PubMed.*waktu habis/);
  assert.equal(r.items.length, 2, "OpenAlex results still shown"); assert.equal(r.origin, "live");
});

test("retry with backoff on 429/5xx and network errors; malformed JSON reported, not crashed", async () => {
  const calls = [];
  R.setFetch(route(Object.assign(FULL(), { "esearch.fcgi": n => (n === 1 ? { status: 429 } : fx("pubmed-esearch.json")), "api.openalex.org/works": n => (n === 1 ? "neterr" : fx("openalex-works.json")) }), calls));
  const r = await R.search(Q(), { now: NOW });
  assert.deepEqual(r.errors, []); assert.equal(r.items.length, 3);
  assert.equal(calls.filter(u => u.includes("esearch")).length, 2, "retried once");
  R.clearCache(); R.setFetch(route(Object.assign(FULL(), { "api.openalex.org/works": "{not json", "esearch.fcgi": { status: 500 } })));
  const bad = await R.search(Q(), { now: NOW, force: true });
  assert.equal(bad.errors.length, 2); assert.ok(bad.errors.some(e => /OpenAlex.*tidak valid/.test(e)));
  assert.deepEqual(bad.items, []); assert.equal(bad.origin, "none");
});

test("cache: fresh hit avoids the network; offline uses cache only; both providers down → stale cache, labelled", async () => {
  const calls = []; R.setFetch(route(FULL(), calls));
  await R.search(Q(), { now: NOW });
  const n = calls.length;
  const hit = await R.search(Q(), { now: NOW });
  assert.equal(calls.length, n); assert.equal(hit.origin, "cache"); assert.equal(hit.cachedAt, NOW);
  const off = await R.search(Q(), { now: NOW, offline: true, force: true });
  assert.equal(calls.length, n, "offline never fetches"); assert.equal(off.origin, "stale-cache"); assert.equal(off.items.length, 3);
  const offEmpty = await R.search(R.queryFor({ type: "recovery", answers: {} }), { offline: true });
  assert.equal(offEmpty.origin, "none"); assert.match(offEmpty.errors[0], /offline/i);
  R.setFetch(route({ "esearch.fcgi": { status: 503 }, "api.openalex.org/works": { status: 503 } }));
  const down = await R.search(Q(), { now: NOW, force: true });
  assert.equal(down.origin, "stale-cache"); assert.equal(down.items.length, 3); assert.equal(down.errors.length, 2);
});

test("provider text is data: markup in titles/abstracts is stripped, never kept as HTML", async () => {
  const sum = JSON.parse(fx("pubmed-esummary.json")); sum.result["99999902"].title = "[FIXTURE] <img src=x onerror=alert(1)>Running <b>study</b>";
  R.setFetch(route(Object.assign(FULL(), { "esummary.fcgi": JSON.stringify(sum) })));
  const pm = await R.pubmed(Q(), NOW);
  assert.equal(pm[1].title, "[FIXTURE] Running study");
});
