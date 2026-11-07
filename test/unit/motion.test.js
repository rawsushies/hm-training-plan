import { test } from "node:test";
import assert from "node:assert/strict";
import "../../public/js/motion.js";
const M = globalThis.WRI_MOTION;

test("springF converges to the target; underdamped springs overshoot, the trailing end less", () => {
  const run = (sp, secs) => { const st = { x: 0, v: 0 }; let peak = 0; for (let t = 0; t < secs; t += 1 / 60) { sp.step(st, 1, 1 / 60); peak = Math.max(peak, st.x); } return { st, peak }; };
  const lead = run(M.LEAD, 2), trail = run(M.TRAIL, 3);
  assert.ok(Math.abs(lead.st.x - 1) < 1e-3 && Math.abs(trail.st.x - 1) < 1e-3, "both settle");
  assert.ok(lead.peak > 1.1, "leading end (ζ=0.55) overshoots noticeably");
  assert.ok(trail.peak > 1 && trail.peak < lead.peak, "trailing end (ζ=0.72) overshoots less");
  // the leading end is faster: further along after 120 ms
  const a = { x: 0, v: 0 }, b = { x: 0, v: 0 }; M.LEAD.step(a, 1, 0.12); M.TRAIL.step(b, 1, 0.12);
  assert.ok(a.x > b.x);
});

test("spring step is frame-rate independent (sub-stepped)", () => {
  const a = { x: 0, v: 0 }, b = { x: 0, v: 0 };
  for (let i = 0; i < 30; i++) M.LEAD.step(a, 1, 1 / 30);
  for (let i = 0; i < 120; i++) M.LEAD.step(b, 1, 1 / 120);
  assert.ok(Math.abs(a.x - b.x) < 1e-3);
});

test("pill geometry follows the reference formulas", () => {
  const g = M.pillGeometry(Object.assign({}, M.DEMO, { lpos: 0, rpos: 0, lvel: 0, rvel: 0 }));
  assert.equal(g.left, 38); assert.equal(g.w, 86); assert.equal(g.h, 64); assert.equal(g.cy, 148);
  assert.equal(g.blur, 1.5); assert.equal(g.frost, 0);
  const s = M.pillGeometry(Object.assign({}, M.DEMO, { lpos: 0, rpos: 3, lvel: 10, rvel: 10 }));
  assert.equal(s.right, 432, "clamped to the stage");
  assert.ok(Math.abs(s.h - 64 * 0.9) < 1e-9, "fully stretched pill is 10% thinner");
  assert.equal(s.blur, 8, "max speed → blur 1.5 + 6.5"); assert.ok(Math.abs(s.frost - 0.14) < 1e-9);
});

test("demo time model: taps at u = 0..3 select SEL = [3,1,2,0] and loop seamlessly every 4 s (12 s video)", () => {
  // u = (T + 0.25) mod 4 → a tap lands at T = 3.75, 0.75, 1.75, 2.75
  assert.equal(M.demoStateAt(3.75 + 1e-6).to, 3);
  assert.equal(M.demoStateAt(0.75 + 1e-6).to, 1);
  assert.equal(M.demoStateAt(1.75 + 1e-6).to, 2);
  assert.equal(M.demoStateAt(2.75 + 1e-6).to, 0);
  assert.equal(M.demoStateAt(0.75 + 1e-6).from, 3, "from = SEL[(k+3) mod 4]");
  // travel distances 3,2,1,2 tabs
  const dist = [0, 1, 2, 3].map(k => { const s = M.demoStateAt(k - 0.25 + 1e-6); return Math.abs(s.to - s.from); });
  assert.deepEqual(dist.sort(), [1, 2, 2, 3]);
  for (const T of [0.1, 1.3, 2.9, 3.6]) { const a = M.demoStateAt(T), b = M.demoStateAt(T + 12); for (const k of ["left", "w", "h", "blur", "frost"]) assert.ok(Math.abs(a[k] - b[k]) < 1e-6, `12 s loop is seamless (${k} @${T})`); }
  // mid-move the pill is stretched, frosted and blurred; at rest it is clear
  const mid = M.demoStateAt(3.75 + 0.12), rest = M.demoStateAt(3.75 + 0.98);
  assert.ok(mid.w > 86 && mid.sn > 0.2 && mid.blur > 2.5);
  assert.ok(rest.sn < 0.05 && Math.abs(rest.w - 86) < 3);
});
