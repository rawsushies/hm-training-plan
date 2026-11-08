/* WeRunIt liquid score vessels.
 * A score is a glass vessel of living liquid: it fills to the value, the surface carries two travelling waves,
 * fine metal flake drifts and catches the light, the liquid levels with the phone when it tilts (where the browser
 * allows device orientation), and a tap splashes it. Charts elsewhere stay crisp; only gauges are liquid.
 * Inspired by the "Liquid Metal" score vessels described by NOOP (github.com/ryanbr/noop, v8.0.0 release notes);
 * written from scratch for WeRunIt's web stack (Canvas 2D, one shared animation loop).
 * Markup: <canvas class="vessel" data-v="72" data-c="#2fd47a"></canvas> inside any sized box.
 * Exposes globalThis.WRI_VESSEL = { mount(root) }.
 */
(function (G) {
  "use strict";
  const list = new Set();
  let raf = 0, tilt = 0, tiltT = 0, listening = false, last = 0;
  const reduced = () => !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches) || (G.document && document.documentElement.dataset.motion === "reduced");

  function hexRgb(c) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return [255, 90, 31];
    const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (c, w, t) => c.map((v, i) => Math.round(v + (w[i] - v) * t));

  function setup(cv) {
    if (cv._v) return cv._v;
    const box = cv.parentElement, size = Math.max(40, Math.min(box.clientWidth || cv.clientWidth || 120, box.clientHeight || 9999)) || 120;
    const dpr = Math.min(2, G.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px";
    const flakes = Array.from({ length: Math.round(size / 3) }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.4, s: Math.random() * 0.25 + 0.05, p: Math.random() * 6.28 }));
    const v = cv._v = { cv, ctx: cv.getContext("2d"), size, dpr, level: reduced() ? 1 : 0, amp: 0, phase: Math.random() * 6, flakes,
      target: Math.max(0, Math.min(100, +cv.dataset.v || 0)) / 100, col: hexRgb(cv.dataset.c), empty: cv.dataset.v === "" || cv.dataset.v === undefined };
    box.addEventListener("pointerdown", () => { v.amp = Math.min(14, v.amp + 7); kick(); }, { passive: true });
    return v;
  }

  function draw(v, dt) {
    const { ctx, size, dpr } = v, r = size / 2 - 2, cx = size / 2, cy = size / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
    // glass
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.035)"; ctx.fillRect(0, 0, size, size);
    if (!v.empty) {
      const fill = v.level * v.target, surf = cy + r - fill * 2 * r;
      const k1 = Math.PI * 2 / (size * 0.9), k2 = Math.PI * 2 / (size * 0.55), a1 = 2.2 + v.amp, a2 = 1.2 + v.amp * 0.5;
      const slope = Math.tan(tilt) ;
      ctx.beginPath(); ctx.moveTo(0, size);
      for (let x = 0; x <= size; x += 3) {
        const y = surf + slope * (x - cx) + a1 * Math.sin(x * k1 + v.phase) + a2 * Math.sin(x * k2 - v.phase * 1.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(size, size); ctx.closePath();
      const g = ctx.createLinearGradient(0, surf - 6, 0, cy + r);
      g.addColorStop(0, rgba(mix(v.col, [255, 255, 255], 0.35), 0.95));
      g.addColorStop(0.35, rgba(v.col, 0.9));
      g.addColorStop(1, rgba(mix(v.col, [0, 0, 0], 0.45), 0.95));
      ctx.fillStyle = g; ctx.fill();
      // metal flake suspended in the liquid
      ctx.save(); ctx.clip();
      for (const f of v.flakes) {
        f.y -= f.s * dt * 0.02; f.x += Math.sin(v.phase * 0.7 + f.p) * 0.0006 * dt;
        if (f.y < 0) { f.y = 1; f.x = Math.random(); }
        const tw = 0.25 + 0.75 * Math.abs(Math.sin(v.phase * 1.7 + f.p));
        ctx.fillStyle = `rgba(255,255,255,${(0.18 + 0.5 * tw).toFixed(2)})`;
        ctx.beginPath(); ctx.arc(f.x * size, f.y * size, f.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // meniscus highlight
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let x = 0; x <= size; x += 3) { const y = surf + slope * (x - cx) + a1 * Math.sin(x * k1 + v.phase) + a2 * Math.sin(x * k2 - v.phase * 1.35); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    // rim and a glint
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = v.empty ? "rgba(255,255,255,0.10)" : rgba(v.col, 0.55); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (v.empty ? 0 : v.level * v.target)); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r - 5, Math.PI * 1.12, Math.PI * 1.38); ctx.stroke();
  }

  function frame(t) {
    const dt = Math.min(64, last ? t - last : 16); last = t;
    tilt += (tiltT - tilt) * Math.min(1, dt / 220);
    let alive = 0;
    for (const v of list) {
      if (!v.cv.isConnected) { list.delete(v); continue; }
      alive++;
      v.level += (1 - v.level) * Math.min(1, dt / 520);
      v.amp *= Math.pow(0.5, dt / 380);
      v.phase += dt * 0.0022;
      draw(v, dt);
    }
    if (alive && !document.hidden) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
  }
  function kick() { if (!raf && !reduced()) { last = 0; raf = requestAnimationFrame(frame); } }

  function onTilt(e) {
    if (e.gamma === null || e.gamma === undefined) return;
    const deg = Math.max(-25, Math.min(25, e.gamma));
    tiltT = -deg * Math.PI / 180 * 0.6;
    kick();
  }

  function mount(root) {
    for (const v of list) if (!v.cv.isConnected) list.delete(v);
    (root || document).querySelectorAll("canvas.vessel").forEach(cv => {
      const v = setup(cv);
      list.add(v);
      if (reduced()) { v.level = 1; v.amp = 0; draw(v, 16); }
    });
    if (!listening && G.addEventListener) { G.addEventListener("deviceorientation", onTilt, { passive: true }); listening = true; document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); }); }
    kick();
  }
  G.WRI_VESSEL = { mount, _list: list };
})(typeof globalThis !== "undefined" ? globalThis : this);
