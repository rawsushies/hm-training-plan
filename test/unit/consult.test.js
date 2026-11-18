import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/lab/consult.js";
const C = globalThis.WRI_CONSULT;
const good = () => ({ schemaVersion: 1, question: "q", conciseSummary: "s", observations: [{ statement: "x", source: "calculation" }], research: [{ sourceId: "pmid:1", claim: "c", relevance: "r", limitations: [] }], hypotheses: [{ explanation: "e", support: [], counterpoints: [], confidence: "low" }], unknowns: [], confounders: [] });

test("not configured unless an https endpoint exists; no network in this module", () => {
  assert.equal(C.status(null), "not-configured"); assert.equal(C.status({ endpoint: "http://x" }), "not-configured");
  assert.equal(C.status({ endpoint: "https://asia-southeast2-we-run-it.cloudfunctions.net/runlabConsult" }), "configured");
});

test("validator rejects unverified citations, bad shapes and diagnostic/clearance language", () => {
  assert.equal(C.validateFinding(good(), ["pmid:1"]).ok, true);
  const fake = good(); fake.research[0].sourceId = "doi:10.9/invented";
  assert.match(C.validateFinding(fake, ["pmid:1"]).errors.join(), /not returned by the research layer/);
  const diag = good(); diag.conciseSummary = "Kamu mengalami stress fracture, tapi aman untuk lari.";
  assert.match(C.validateFinding(diag, ["pmid:1"]).errors.join(), /diagnostic/);
  assert.equal(C.validateFinding({}, []).ok, false);
});

test("consent payload: only chosen categories, no notes/ids/Strava runs", () => {
  const inv = { type: "performance", question: "q", answers: { window: { v: 28, state: "answered" }, runs: { v: null, state: "unknown" } }, sources: [{ id: "pmid:1", title: "T", year: 2024, kind: "rct" }] };
  const state = { logs: [{ id: "a", date: "2026-11-01", distance: 5, duration: 1800, type: "easy", notes: "lutut nyeri", hrAvg: 150 }, { id: "s", date: "2026-11-02", distance: 5, duration: 1800, type: "easy", src: "Strava", extId: "strava:1" }] };
  const results = [{ analysisId: "trend", methodVersion: "trend-1", n: 2, adequacy: "insufficient", metrics: { bands: [], ids: ["a"] }, includedRecordIds: ["a", "s"], limitations: [] }];
  const { payload, excluded } = C.buildPayload(inv, state, results, ["question", "results", "runs"]);
  assert.equal(excluded.strava, 1); assert.equal(payload.runs.length, 1);
  assert.ok(!JSON.stringify(payload).includes("lutut"), "notes never included");
  assert.ok(!("hrAvg" in payload.runs[0]), "HR only when the user allows it");
  assert.ok(!JSON.stringify(payload.results).includes('"ids"'), "no record ids in results");
  assert.equal(payload.sources, undefined);
  assert.deepEqual(payload.question.answers, { window: 28, runs: "unknown" });
});
