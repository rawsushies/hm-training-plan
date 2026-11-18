import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, run } from "./helpers.js";
import "../../public/js/lab/analysis.js";
const A = globalThis.WRI_ANALYSIS;
const NOW = "2026-11-18T00:00:00.000Z";
const W = { from: "2026-10-01", to: "2026-11-18" };
const S = o => Object.assign(defaults(), o);
const keys = ["analysisId", "methodVersion", "createdAt", "window", "includedRecordIds", "excluded", "n", "metrics", "units", "method", "assumptions", "limitations", "missingFields", "adequacy"];

test("every result has the typed shape and is reproducible (same input → same output)", () => {
  const st = S({ logs: [run("a", { date: "2026-10-05", distance: 5, duration: 1800 }), run("b", { date: "2026-11-10", distance: 5, duration: 1700 })] });
  for (const id of ["weekly", "trend", "compare", "quality"]) {
    const r1 = A.run(id, st, W, {}, NOW), r2 = A.run(id, st, W, {}, NOW);
    for (const k of keys) assert.ok(k in r1, `${id} has ${k}`);
    assert.deepEqual(r1, r2, id + " deterministic");
    assert.ok(["adequate", "limited", "insufficient"].includes(r1.adequacy));
  }
});

test("weekly: Monday–Sunday sums, empty weeks marked 'none' (not zero activity), strength separate, sample excluded", () => {
  const st = S({ logs: [run("a", { date: "2026-11-02", distance: 5, duration: 1800 }), run("b", { date: "2026-11-04", distance: 7, duration: null }), run("s", { date: "2026-11-03", sample: true }), run("c", { date: "2026-11-16", distance: 10, duration: 3600 })], strength: [{ id: "st1", date: "2026-11-05", kind: "A", sets: 2 }] });
  const r = A.weekly(st, { from: "2026-11-02", to: "2026-11-18" }, NOW);
  assert.deepEqual(r.series.map(w => [w.start, w.runs, w.km, w.logged, w.strength]), [["2026-11-02", 2, 12, "partial", 1], ["2026-11-09", 0, 0, "none", 0], ["2026-11-16", 1, 10, "complete", 0]]);
  assert.equal(r.series[0].minutes, 30, "minutes only from runs with a duration");
  assert.equal(r.metrics.strengthSessions, 1); assert.equal(r.metrics.emptyWeeks, 1);
  assert.deepEqual(r.excluded, [{ id: "s", reason: "contoh data" }]);
  assert.ok(/bukan dianggap nol/.test(r.method));
});

test("trend: missing duration excluded (never estimated), implausible pace flagged, median + IQR per band, minimum sample rule", () => {
  const logs = [];
  ["2026-10-02", "2026-10-06", "2026-10-09", "2026-10-13"].forEach((d, i) => logs.push(run("e" + i, { date: d, distance: 5, duration: 5 * (420 + i) })));
  ["2026-11-02", "2026-11-05", "2026-11-09", "2026-11-12"].forEach((d, i) => logs.push(run("l" + i, { date: d, distance: 5, duration: 5 * (400 + i) })));
  logs.push(run("nod", { date: "2026-11-01", distance: 5, duration: null }), run("crazy", { date: "2026-11-03", distance: 5, duration: 300 }), run("short", { date: "2026-11-04", distance: 2, duration: 700 }));
  const r = A.trend(S({ logs }), W, {}, NOW);
  const reasons = Object.fromEntries(r.excluded.map(e => [e.id, e.reason]));
  assert.equal(reasons.nod, "durasi tidak tercatat"); assert.equal(reasons.crazy, "pace tidak wajar, perlu dicek"); assert.equal(reasons.short, "jarak di bawah 3 km");
  const b = r.metrics.bands.find(x => x.band === "3–6 km");
  assert.equal(b.early.n, 4); assert.equal(b.late.n, 4); assert.equal(b.verdict, "faster"); assert.ok(b.diff < 0);
  assert.equal(b.early.median, 422); assert.ok(b.early.q1 <= b.early.median && b.early.median <= b.early.q3);
  const thin = A.trend(S({ logs: logs.slice(0, 3) }), W, {}, NOW);
  assert.equal(thin.adequacy, "insufficient"); assert.equal(thin.metrics.bands[0].verdict, "insufficient");
  assert.deepEqual(r.missingFields, ["durasi"]);
});

test("compare: time-of-day needs a recorded start time (manual runs excluded with a reason); shoes; insufficient below the minimum", () => {
  const t = (id, hh, sec) => run(id, { date: "2026-11-1" + id.slice(-1), distance: 6, duration: sec, extId: `t:2026-11-10T${hh}:00` });
  const logs = [t("m1", "06", 2400), t("m2", "06", 2460), t("m3", "07", 2430), t("n1", "19", 2520), t("n2", "20", 2580), t("n3", "19", 2550), run("man", { date: "2026-11-15", distance: 6, duration: 2400 })];
  const r = A.compare(S({ logs }), W, { by: "time" }, NOW);
  assert.equal(r.metrics.a.n, 3); assert.equal(r.metrics.b.n, 3); assert.ok(r.metrics.diff > 0);
  assert.deepEqual(r.excluded.find(e => e.id === "man"), { id: "man", reason: "jam mulai tidak tercatat" });
  assert.deepEqual(r.missingFields, ["jam mulai"]);
  const shoes = S({ logs: [run("x", { date: "2026-11-01", shoeId: "A", duration: 1800 }), run("y", { date: "2026-11-02", shoeId: "B", duration: 1800 })] });
  const rs = A.compare(shoes, W, { by: "shoe", shoeA: "A", shoeB: "B", shoeAName: "Biru", shoeBName: "Merah" }, NOW);
  assert.equal(rs.adequacy, "insufficient"); assert.equal(rs.metrics.diff, null); assert.deepEqual(rs.metrics.labels, { a: "Biru", b: "Merah" });
});

test("quality: coverage with provenance, flags for review (nothing changed), duplicates, sources", () => {
  const logs = [run("a", { date: "2026-11-01", distance: 5, duration: 1800, hrAvg: 250 }), run("b", { date: "2026-11-01", distance: 5, duration: 1810 }), run("c", { date: "2026-11-03", distance: 4, duration: null, src: "cepat" }), run("d", { date: "2026-11-04", src: "Strava", extId: "strava:9" })];
  const before = JSON.stringify(logs);
  const r = A.quality(S({ logs }), W, NOW);
  assert.equal(JSON.stringify(logs), before, "input never modified");
  const cov = Object.fromEntries(r.metrics.coverage.map(c => [c.k, c.n]));
  assert.equal(cov.duration, 3); assert.equal(cov.cadence, 0);
  assert.ok(r.metrics.flags.some(f => f.id === "a" && f.field === "hr"));
  assert.ok(r.metrics.flags.some(f => f.id === "b" && f.field === "duplicate"));
  assert.ok(r.metrics.flags.some(f => f.id === "c" && /rencana/.test(f.note)));
  assert.equal(r.metrics.sources["import Strava (CSV)"], 1); assert.equal(r.metrics.sources["✓ Selesai (jarak rencana)"], 1);
  assert.ok(r.missingFields.includes("Kadens"));
});

test("plan maps investigation answers to analyses; snapshot is bounded and keeps exact record ids + method version", () => {
  const inv = { type: "environment", answers: { factor: { v: "time", state: "answered" } } };
  assert.deepEqual(A.plan(inv).map(x => x[0]), ["compare", "quality"]);
  assert.deepEqual(A.plan({ type: "environment", answers: { factor: { v: "heat", state: "answered" } } }).map(x => x[0]), ["quality"], "no measured temperature → no fake heat analysis");
  const logs = Array.from({ length: 500 }, (_, i) => run("r" + i, { date: "2026-11-01" }));
  const snap = A.snapshot(A.quality(S({ logs }), W, NOW));
  assert.equal(snap.includedRecordIds.length, 400); assert.equal(snap.methodVersion, "quality-1"); assert.ok(snap.metrics.flags.length <= 30);
});

test("grade: descriptive / insufficient / observation / supported, deterministic p", async () => {
  const A = globalThis.WRI_ANALYSIS;
  assert.equal(A.grade({ analysisId: "weekly" }).grade, "descriptive");
  const mk = (pa, pb) => ({ analysisId: "compare", metrics: { diff: A.median(pb) - A.median(pa), a: { n: pa.length }, b: { n: pb.length } }, series: { a: pa.map(pace => ({ pace })), b: pb.map(pace => ({ pace })) } });
  assert.equal(A.grade({ analysisId: "compare", metrics: { diff: null, a: { n: 2 }, b: { n: 1 } }, series: { a: [], b: [] } }).grade, "insufficient");
  const clear = mk([400, 402, 405, 398, 401, 403, 399], [360, 362, 358, 361, 359, 363, 360]);
  const g1 = A.grade(clear), g2 = A.grade(clear);
  assert.equal(g1.grade, "supported"); assert.ok(g1.p < 0.05); assert.equal(g1.p, g2.p, "same data → same p");
  assert.equal(A.grade(mk([400, 380, 420, 390, 410, 395], [398, 385, 415, 392, 405, 400])).grade, "observation", "overlapping groups are not 'supported'");
  assert.equal(A.grade(mk([400, 402, 405], [360, 362, 358])).grade, "observation", "fewer than 6 per group never 'supported'");
});

test("leadBand: the comparable band with the most runs in its smaller half; grade reports which band it tested", () => {
  const A = globalThis.WRI_ANALYSIS, b = (band, e, l, verdict = "faster") => ({ band, verdict, diff: -10, early: { n: e }, late: { n: l } });
  const r = { analysisId: "trend", metrics: { bands: [b("3–6 km", 3, 3), b("6–10 km", 9, 9), b("10–16 km", 2, 1, "insufficient")], splitDate: "2026-10-01" }, series: [] };
  assert.equal(A.leadBand(r).band, "6–10 km");
  assert.equal(A.grade(r).band, "6–10 km");
  assert.equal(A.leadBand({ metrics: { bands: [b("x", 1, 1, "insufficient")] } }), null);
});
