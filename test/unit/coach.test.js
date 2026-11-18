// Coach engine + provider model. All data here is SYNTHETIC (generated in this file); it is never shown as real history.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/coach/model.js";
import "../../public/js/coach/engine.js";
const M = globalThis.WRI_COACH_MODEL, C = globalThis.WRI_COACH;
const TODAY = "2026-11-18";
const day = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/** SYNTHETIC: n runs, every `step` days ending today. f(i) → overrides. */
function synth(n, step, f = () => ({})) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(Object.assign({ id: "syn" + i, date: day(TODAY, -(n - 1 - i) * step), type: "easy", distance: 6, duration: 6 * 390, rpe: 3, hrAvg: null, elev: null }, f(i)));
  return out;
}
const sess = logs => M.sessionsFrom({ logs }).sessions;

test("model: missing values stay null (no defaults), pace only when distance and duration are recorded", () => {
  const s = M.toSession({ id: "a", date: TODAY, distance: 5, duration: null, rpe: null, hrAvg: 0 });
  assert.equal(s.durationSec, null); assert.equal(s.paceSecPerKm, null); assert.equal(s.rpe, null); assert.equal(s.hrAvg, null);
  assert.equal(M.toSession({ id: "b", date: TODAY, distance: 5, duration: 1500 }).paceSecPerKm, 300);
});

test("model: sample and Strava-origin runs never reach the coach; Strava is display-only and off until the server is enabled", () => {
  const r = M.sessionsFrom({ logs: [{ id: "x", date: TODAY, distance: 5, sample: true }, { id: "y", date: TODAY, distance: 5, src: "Strava" }, { id: "z", date: TODAY, distance: 5 }] });
  assert.deepEqual(r.sessions.map(s => s.id), ["z"]);
  assert.match(r.excluded.find(e => e.id === "y").reason, /Strava/);
  const sv = M.providers().find(p => p.id === "strava");
  assert.equal(sv.status, "unavailable"); assert.equal(sv.displayOnly, true); assert.match(sv.note, /tidak dianalisis coach/);
  assert.equal(M.providers({ strava: "connected" }).find(p => p.id === "strava").status, "connected");
});

test("no history → every dimension is 'insufficient' with what is missing; no key insight is invented", () => {
  const A = C.assess([], { today: TODAY });
  assert.equal(A.n, 0); assert.equal(A.key, null);
  assert.ok(A.observations.every(o => o.kind === "insufficient" && o.fact.length > 10));
});

test("consistency: regular running is a strength; long gaps are a limitation", () => {
  const good = C.assess(sess(synth(28, 2)), { today: TODAY }).observations.find(o => o.id === "consistency");
  assert.equal(good.kind, "strength"); assert.match(good.fact, /8 dari 8 minggu/);
  const gappy = C.assess(sess(synth(5, 15)), { today: TODAY }).observations.find(o => o.id === "consistency");
  assert.equal(gappy.kind, "limitation");
  for (const k of ["fact", "interpretation", "recommendation", "monitor"]) assert.ok(good[k], k);
  assert.ok(good.window.from && good.n >= 24 && good.confidence);
});

test("intensity uses only recorded RPE; partial RPE below 50% coverage → insufficient, never filled", () => {
  const hardEasy = sess(synth(20, 2, i => ({ rpe: i % 3 === 0 ? 3 : 7 })));
  const o = C.assess(hardEasy, { today: TODAY }).observations.find(x => x.id === "intensity");
  assert.equal(o.kind, "limitation"); assert.equal(o.basis, "RPE"); assert.match(o.recommendation, /santai/);
  const partial = sess(synth(20, 2, i => ({ rpe: i < 4 ? 3 : null })));
  const p = C.assess(partial, { today: TODAY }).observations.find(x => x.id === "intensity");
  assert.equal(p.kind, "insufficient"); assert.match(p.fact, /4 dari 20/);
});

test("pace trend compares like with like and is graded; noise is not called an improvement", () => {
  const faster = sess(synth(20, 2, i => ({ distance: 6, duration: Math.round(6 * (420 - i * 3)) })));
  const o = C.assess(faster, { today: TODAY }).observations.find(x => x.id === "pace");
  assert.equal(o.kind, "strength"); assert.match(o.fact, /6–10 km/); assert.ok(/p = 0\.0/.test(o.fact));
  const noise = sess(synth(16, 3, i => ({ duration: 6 * (390 + (i % 2 ? 4 : -4)) })));
  assert.equal(C.assess(noise, { today: TODAY }).observations.find(x => x.id === "pace").kind, "neutral");
});

test("strength is never inferred from absent records; heart rate is unanswerable without measured HR max", () => {
  const A = C.assess(sess(synth(20, 2)), { today: TODAY, strength: [] });
  assert.equal(A.observations.find(o => o.id === "strength").kind, "insufficient");
  assert.ok(A.unanswerable.some(u => /detak jantung/i.test(u.q)));
  const B = C.assess(sess(synth(20, 2)), { today: TODAY, strength: [{ date: day(TODAY, -3) }, { date: day(TODAY, -10) }] });
  assert.notEqual(B.observations.find(o => o.id === "strength").kind, "insufficient");
});

test("volume jump is flagged as an opportunity to hold, without injury or safety language", () => {
  const logs = synth(20, 2, i => ({ distance: i < 10 ? 4 : 9, duration: (i < 10 ? 4 : 9) * 390 }));
  const o = C.assess(sess(logs), { today: TODAY }).observations.find(x => x.id === "volume");
  assert.equal(o.kind, "opportunity");
  assert.ok(!/aman|bahaya|risiko cedera|injury/i.test(JSON.stringify(o).replace("bukan prediksi cedera", "")));
});

test("ask: answers come from observations with n and window; pain questions get a safety answer; insufficient data is said plainly", () => {
  const A = C.assess(sess(synth(20, 2, i => ({ rpe: i % 3 === 0 ? 3 : 7 }))), { today: TODAY });
  const a = C.answer("Apakah lari santaiku terlalu keras?", A);
  assert.deepEqual(a.dims, ["intensity"]); assert.match(a.direct, /Distribusi intensitas/); assert.match(a.uncertainty, /n = 20/);
  assert.ok(a.actions.length >= 1 && a.actions.length <= 2);
  const p = C.answer("Lututku nyeri setelah long run", A);
  assert.equal(p.safety, true); assert.match(p.direct, /dokter atau fisioterapis/);
  const e = C.answer("Apakah long run-ku berkembang?", C.assess([], { today: TODAY }));
  assert.match(e.direct, /Belum cukup data/);
  assert.match(C.answer("Kenapa detak jantungku naik?", A).direct, /Belum bisa dijawab/);
});

test("deterministic: same input → same assessment", () => {
  const s = sess(synth(20, 2, i => ({ duration: Math.round(6 * (420 - i * 2)) })));
  assert.deepEqual(C.assess(s, { today: TODAY }), C.assess(s, { today: TODAY }));
});
