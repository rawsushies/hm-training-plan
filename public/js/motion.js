/* WeRunIt motion system (classic script; spring math is also imported by Node unit tests).
 * Exposes globalThis.WRI_MOTION.
 *
 *  springF(omega, zeta)  damped spring: omega = natural frequency (rad/s), zeta = damping ratio.
 *                        step(state, target, dt) integrates x'' = -ω²(x - target) - 2ζω·x'.
 *  GlassPill             frosted tab indicator with independently sprung leading/trailing ends
 *                        (leading springF(19, 0.55), trailing springF(11, 0.72)), stretch, frost and blur
 *                        driven by speed. Moves only when told to (real navigation); the demo stage
 *                        drives it with the reference 12-second time model.
 *  rollNumber, reveal    kinetic number roll and staggered entrance (respect reduced motion).
 */
(function (G) {
  "use strict";
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const reduced = () => !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches) || (G.document && G.document.documentElement.dataset.motion === "reduced");

  function springF(omega, zeta) {
    return {
      omega, zeta,
      /** Advance one spring end. Sub-steps keep it stable for long frames (tab switch, slow phones). */
      step(st, target, dt) {
        let t = dt;
        const h = 1 / 240;
        while (t > 1e-9) {
          const d = Math.min(h, t);
          const a = -omega * omega * (st.x - target) - 2 * zeta * omega * st.v;
          st.v += a * d; st.x += st.v * d; t -= d;
        }
        return st;
      },
      settled: (st, target) => Math.abs(st.x - target) < 1e-3 && Math.abs(st.v) < 1e-3
    };
  }
  const LEAD = springF(19, 0.55), TRAIL = springF(11, 0.72);

  /**
   * Pure geometry of the pill for given end positions (in tab units) — used by both the app nav and the
   * demo, and unit-tested. tabX(i) maps a tab index (float) to a pixel centre.
   */
  function pillGeometry({ lpos, rpos, lvel, rvel, tabX, half = 43, minX = 38, maxX = 432, baseH = 64, cy = 148, lead = "r" }) {
    const left = Math.max(minX, tabX(lpos) - half), right = Math.min(maxX, tabX(rpos) + half);
    const w = right - left, base = half * 2;
    const s = clamp((w - base) / base);
    const h = baseH * (1 - 0.1 * s);
    const velLead = lead === "r" ? rvel : lvel, velTrail = lead === "r" ? lvel : rvel;
    const sn = clamp(Math.abs((velLead + velTrail) / 2) / 7);
    return { left, right, w, h, s, cx: (left + right) / 2, cy, sn, blur: 1.5 + 6.5 * sn, frost: 0.14 * sn };
  }

  /** Frosted glass tab indicator bound to a DOM element. */
  class GlassPill {
    /** el: the pill element; opts: {tabX(i)→px, half, minX, maxX, baseH, cy, onFrame} */
    constructor(el, opts) {
      this.el = el; this.o = opts;
      this.l = { x: opts.start || 0, v: 0 }; this.r = { x: opts.start || 0, v: 0 };
      this.target = opts.start || 0; this.lead = "r"; this.raf = 0; this.last = 0;
      this.paint();
    }
    /** Jump without animation (first render, resize, reduced motion). */
    snap(i) { this.target = i; this.l = { x: i, v: 0 }; this.r = { x: i, v: 0 }; this.paint(); }
    go(i) {
      if (i === this.target) return;
      if (reduced()) { this.snap(i); return; }
      this.lead = i > this.target ? "r" : "l";            // the end moving toward the new tab leads
      this.target = i;
      if (!this.raf) { this.last = 0; this.raf = requestAnimationFrame(t => this.frame(t)); }
    }
    frame(t) {
      const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 1 / 60); this.last = t;   // cap long frames
      const [ls, rs] = this.lead === "r" ? [TRAIL, LEAD] : [LEAD, TRAIL];
      ls.step(this.l, this.target, dt); rs.step(this.r, this.target, dt);
      this.paint();
      const done = ls.settled(this.l, this.target) && rs.settled(this.r, this.target);
      if (done || document.hidden) { this.snap(this.target); this.raf = 0; return; }
      this.raf = requestAnimationFrame(x => this.frame(x));
    }
    geometry() {
      const lo = Math.min(this.l.x, this.r.x), hi = Math.max(this.l.x, this.r.x);
      const lv = this.l.x <= this.r.x ? this.l.v : this.r.v, rv = this.l.x <= this.r.x ? this.r.v : this.l.v;
      return pillGeometry(Object.assign({}, this.o, { lpos: lo, rpos: hi, lvel: lv, rvel: rv, lead: this.lead }));
    }
    paint() {
      const g = this.geometry(), s = this.el.style;
      s.transform = `translate(${(g.left).toFixed(2)}px, ${(g.cy - g.h / 2).toFixed(2)}px)`;
      s.width = g.w.toFixed(2) + "px"; s.height = g.h.toFixed(2) + "px";
      s.setProperty("--blur", g.blur.toFixed(2) + "px");
      s.setProperty("--frost", `rgba(225,225,245,${g.frost.toFixed(3)})`);
      if (this.o.onFrame) this.o.onFrame(g);
    }
  }

  /**
   * Reference demo: stage 470×222, 4 tabs, 12 s seamless loop.
   * u = (T + 0.25) mod 4; a tap at u = 0,1,2,3; SEL = [3,1,2,0]; to = SEL[k], from = SEL[(k+3) mod 4].
   * Each tap restarts both ends from the previous tab; the ends then spring independently.
   */
  const DEMO = { W: 470, H: 222, SEL: [3, 1, 2, 0], tabX: i => 81 + i * (308 / 3), half: 43, minX: 38, maxX: 432, baseH: 64, cy: 148 };
  function demoStateAt(T) {
    const u = ((T + 0.25) % 4 + 4) % 4, k = Math.floor(u), dt = u - k;
    const to = DEMO.SEL[k], from = DEMO.SEL[(k + 3) % 4];
    const lead = to > from ? "r" : "l";
    const lEnd = { x: from, v: 0 }, rEnd = { x: from, v: 0 };
    const [ls, rs] = lead === "r" ? [TRAIL, LEAD] : [LEAD, TRAIL];
    ls.step(lEnd, to, dt); rs.step(rEnd, to, dt);       // deterministic: same T → same frame (seamless loop)
    const lo = Math.min(lEnd.x, rEnd.x), hi = Math.max(lEnd.x, rEnd.x);
    const lv = lEnd.x <= rEnd.x ? lEnd.v : rEnd.v, rv = lEnd.x <= rEnd.x ? rEnd.v : lEnd.v;
    return Object.assign(pillGeometry(Object.assign({}, DEMO, { lpos: lo, rpos: hi, lvel: lv, rvel: rv, lead })), { to, from, k, dt });
  }
  /** Mounts the self-playing reference demo into `host`. Stops when hidden / removed. */
  function mountDemo(host) {
    host.innerHTML = `<div class="pill-demo" role="img" aria-label="Demo animasi indikator tab kaca">
      ${[0, 1, 2, 3].map(i => `<span class="pd-ico" style="left:${DEMO.tabX(i) - 14}px">${["◎", "◇", "△", "▢"][i]}</span>`).join("")}
      <div class="glass-pill pd-pill"><i class="lens"></i></div></div>`;
    const pill = host.querySelector(".pd-pill"), t0 = performance.now();
    let raf = 0;
    const draw = now => {
      if (!host.isConnected) return;
      const g = demoStateAt(reduced() ? 0.9 : ((now - t0) / 1000) % 12);
      pill.style.transform = `translate(${g.left}px, ${g.cy - g.h / 2}px)`; pill.style.width = g.w + "px"; pill.style.height = g.h + "px";
      pill.style.setProperty("--blur", g.blur + "px"); pill.style.setProperty("--frost", `rgba(225,225,245,${g.frost})`);
      if (!reduced()) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }

  /** Roll a number from its previous value (stored on the element) to `to`. fmt formats the value. */
  function rollNumber(el, to, fmt = v => Math.round(v), ms = 700) {
    const from = parseFloat(el.dataset.rolled ?? "NaN");
    el.dataset.rolled = String(to);
    if (reduced() || isNaN(from) || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const tick = now => {
      const p = clamp((now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  /** Staggered entrance for [data-reveal] children — once per element, only when visible. */
  function reveal(root) {
    if (reduced() || !G.IntersectionObserver) return;
    const els = [...root.querySelectorAll("[data-reveal]:not(.revealed)")];
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("revealed"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    els.forEach((el, i) => { el.style.setProperty("--d", Math.min(i, 8) * 45 + "ms"); el.classList.add("rv"); io.observe(el); });
    // Safety: never leave content hidden (print/export, observers that never fire).
    setTimeout(() => els.forEach(el => el.classList.add("revealed")), 2500);
  }

  G.WRI_MOTION = { springF, LEAD, TRAIL, pillGeometry, GlassPill, DEMO, demoStateAt, mountDemo, rollNumber, reveal, reduced, clamp };
})(typeof globalThis !== "undefined" ? globalThis : this);
