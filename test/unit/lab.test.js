import { test } from "node:test";
import assert from "node:assert/strict";
import { H, defaults, run, ci } from "./helpers.js";
import "../../public/js/lab/lab.js";
const L = globalThis.WRI_LAB;
const T0 = "2026-11-18T10:00:00.000Z";

test("classification is transparent: matched words shown, no diagnosis type, unknown → guess", () => {
  const a = L.classify("Kenapa pace-ku nggak membaik padahal lari lebih banyak?");
  assert.equal(a.type, "performance"); assert.ok(a.matched.includes("pace"));
  assert.equal(L.classify("Apakah aku lebih efisien lari pagi atau malam?").type, "environment");
  assert.equal(L.classify("Do I run differently in these two shoes?").type, "equipment");
  assert.equal(L.classify("Tidurku setelah long run").type, "recovery");
  assert.deepEqual(L.classify("halo").guess, true);
  assert.ok(!Object.keys(L.TYPES).some(t => /diagnos|injur|cedera/i.test(t)));
});

test("one question at a time; skip and unknown stay null and are never inferred; correction reopens only that question", () => {
  let inv = L.newInvestigation("Kenapa pace-ku nggak membaik?", T0, "labx");
  assert.equal(L.nextQuestion(inv).k, "window"); assert.ok(L.nextQuestion(inv).why);
  inv = L.answer(inv, "window", 56, "answered", T0);
  assert.equal(L.nextQuestion(inv).k, "meaning");
  inv = L.answer(inv, "meaning", "ignored", "unknown", T0);
  assert.deepEqual(inv.answers.meaning, { v: null, state: "unknown", at: T0 });
  inv = L.answer(inv, "runs", "easy", "skipped", T0);
  assert.equal(inv.answers.runs.v, null); assert.equal(L.nextQuestion(inv), null);
  inv = L.reopen(inv, "window", T0);
  assert.equal(L.nextQuestion(inv).k, "window"); assert.ok(inv.answers.meaning && inv.answers.runs, "other answers kept");
});

test("scope: window, exclusions with reasons, sample never included, field coverage and missing needed fields", () => {
  const S = Object.assign(defaults(), {
    logs: [run("a", { date: "2026-11-10", distance: 5, duration: 1800, hrAvg: 150, rpe: 4 }), run("b", { date: "2026-11-15", distance: 8, duration: null, type: "long" }),
      run("old", { date: "2026-08-01" }), run("s", { date: "2026-11-12", sample: true }), run("f", { date: "2026-12-01" }), run("st", { date: "2026-11-14", src: "Strava", extId: "strava:1" })],
    checkins: [ci("2026-11-12"), ci("2026-11-13", { sample: true })]
  });
  let inv = L.answer(L.newInvestigation("pace membaik?", T0, "l1"), "window", 28, "answered", T0);
  const sc = L.scope(inv, S, "2026-11-18");
  assert.deepEqual(sc.window, { from: "2026-10-22", to: "2026-11-18", days: 28 });
  assert.deepEqual(sc.included.sort(), ["a", "b", "st"]);
  assert.deepEqual(Object.fromEntries(sc.excluded.map(e => [e.id, e.reason])), { old: "di luar periode", s: "contoh data", f: "tanggal di masa depan" });
  const cov = Object.fromEntries(sc.coverage.map(c => [c.k, c.n]));
  assert.equal(cov.pace, 2); assert.equal(cov.hr, 1); assert.equal(cov.cadence, 0, "cadence is never stored, so never claimed");
  assert.equal(sc.checkins.n, 1, "sample check-in excluded"); assert.equal(sc.strava.n, 1);
  inv = L.answer(inv, "runs", "long", "answered", T0);
  const sc2 = L.scope(inv, S, "2026-11-18");
  assert.deepEqual(sc2.included, ["b"]); assert.deepEqual(sc2.missingNeeded, ["Durasi", "Pace (dihitung dari jarak + durasi)"]);
  const noWin = L.scope(L.answer(L.newInvestigation("pace", T0, "l2"), "window", null, "unknown", T0), S, "2026-11-18");
  assert.equal(noWin.window.from, null, "unknown window = all data, not a guessed range");
});

test("sanitizer bounds every field and drops junk; export is self-describing and says nothing was analysed", () => {
  assert.equal(L.cleanInvestigation({ id: "bad id!", question: "x" }), null);
  assert.equal(L.cleanInvestigation({ id: "ok", question: "   " }), null);
  const c = L.cleanInvestigation({ id: "ok", question: "q".repeat(900), type: "diagnosis", status: "hacked", answers: { window: { v: 28, state: "answered" }, "bad key": { v: 1, state: "answered" }, meaning: { v: "x", state: "weird" }, runs: { v: "easy", state: "skipped" } }, extra: 1 });
  assert.equal(c.question.length, 500); assert.equal(c.type, "performance"); assert.equal(c.status, "draft");
  assert.deepEqual(Object.keys(c.answers).sort(), ["runs", "window"]); assert.equal(c.answers.runs.v, null);
  assert.ok(!("extra" in c));
  const e = L.exportJson(c, null, T0);
  assert.equal(e.kind, "werunit-lab-investigation"); assert.equal(e.methods.analysis, null); assert.match(e.note, /not available/);
});

test("lab records sync additively; v3/v4 users without Lab data get identical records", () => {
  const base = H.sanitizeState(defaults(), defaults);
  assert.deepEqual(base.lab, {});
  assert.ok(!Object.keys(H.stateToRecords(base)).some(k => k.startsWith("lab/")));
  const inv = L.newInvestigation("pace?", T0, "lab1");
  const S = H.sanitizeState(Object.assign(defaults(), { lab: { lab1: inv, junk: { id: "junk" } } }), defaults);
  assert.deepEqual(Object.keys(S.lab), ["lab1"]);
  const recs = H.stateToRecords(S);
  assert.ok(recs["lab/lab1"]);
  const back = H.recordsToState(recs, defaults(), defaults);
  assert.equal(back.lab.lab1.question, "pace?");
  const m = H.mergeStates(S, H.sanitizeState(Object.assign(defaults(), { lab: { lab2: L.newInvestigation("tidur?", T0, "lab2") } }), defaults), defaults);
  assert.deepEqual(Object.keys(m.state.lab).sort(), ["lab1", "lab2"]);
});

test("quick body check is a separate coarse signal: no invented check-in answers; full check-ins untouched; synced as plan/quick_*", () => {
  const full = ci("2026-11-17");
  const S = H.sanitizeState(Object.assign(defaults(), { checkins: [full], quickChecks: { "2026-11-18": { v: "capek" }, "bad": { v: "capek" }, "2026-11-16": { v: "segar banget" } } }), defaults);
  assert.deepEqual(S.quickChecks, { "2026-11-18": { v: "capek" } });
  assert.deepEqual(S.checkins, [full], "no six-field check-in created from a tap");
  const recs = H.stateToRecords(S);
  assert.deepEqual(recs["plan/quick_2026-11-18"], { v: "capek" });
  assert.deepEqual(recs["checkins/2026-11-17"], full);
  assert.deepEqual(H.recordsToState(recs, defaults(), defaults).quickChecks, { "2026-11-18": { v: "capek" } });
  const base = H.sanitizeState(defaults(), defaults);
  assert.ok(!Object.keys(H.stateToRecords(base)).some(k => k.startsWith("plan/quick_")), "users without quick checks: records unchanged");
});

test("correcting an answer removes dependent answers transitively; stages and snapshot freshness follow the answers", () => {
  let inv = L.newInvestigation("Apakah aku lebih efisien lari pagi atau malam?", T0, "env1");
  assert.equal(L.stage(inv), "draft");
  inv = L.answer(inv, "window", 56, "answered", T0); assert.equal(L.stage(inv), "context");
  inv = L.answer(inv, "factor", "time", "answered", T0); inv = L.answer(inv, "measure", "pace", "answered", T0);
  assert.equal(L.stage(inv), "ready");
  inv = Object.assign({}, inv, { snapshots: [{ analysisId: "compare", methodVersion: "compare-1", createdAt: T0, answersKey: L.answersKey(inv), n: 6, adequacy: "limited", includedRecordIds: ["a"], excludedCount: 0, metrics: {} }] });
  assert.equal(L.stage(inv), "findings");
  const re = L.reopen(inv, "factor", T0);
  assert.equal(re.answers.measure, undefined, "measure depends on factor"); assert.ok(re.answers.window, "unrelated answer kept");
  assert.equal(L.stage(re), "context"); assert.equal(L.snapshotFresh(re, re.snapshots[0]), false);
  const cleaned = L.cleanInvestigation(Object.assign({}, inv, { snapshots: [{ analysisId: "evil", methodVersion: "x", createdAt: T0 }, inv.snapshots[0]], sources: [{ id: "pmid:1", title: "T", url: "javascript:alert(1)" }, { id: "pmid:2", title: "Run study", url: "https://pubmed.ncbi.nlm.nih.gov/2/", year: 2024, kind: "rct" }] }));
  assert.equal(cleaned.snapshots.length, 1); assert.deepEqual(cleaned.sources.map(s => s.id), ["pmid:2"]);
  assert.equal(L.archived, undefined); assert.equal(L.stage(Object.assign({}, inv, { status: "closed" })), "archived");
});
