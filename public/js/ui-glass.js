/* WeRunIt shared glass segmented control. Same frosted spring pill as the bottom nav (WRI_MOTION.GlassPill:
 * leading end springF(19, 0.55), trailing springF(11, 0.72), stretch, frost + blur from speed).
 * The pill only moves when the selection changes; re-renders with the same selection keep it still.
 */
"use strict";
const PILL_PREV = {};
/** items: [[value, label], ...]; act: ACT name receiving data-v. Returns markup. */
function segPill(key, items, cur, act, extra = ""){
  return `<div class="rtabs glass seg-glass" role="tablist" data-pill="${esc(key)}" ${extra}><div class="glass-pill"><i class="lens"></i></div>${items.map(([v, l]) => `<button role="tab" aria-selected="${v === cur}" class="${v === cur ? "on" : ""}" data-act="${esc(act)}" data-v="${esc(v)}">${l}</button>`).join("")}</div>`;
}
/** Upgrade the classic single-select `.seg` controls (v3 screens + v4 editors) to the same glass pill. */
function upgradeSegs(root = document){
  const seen = {};
  root.querySelectorAll(".seg:not([data-pill])").forEach(seg => {
    const btns = [...seg.querySelectorAll(":scope > button")];
    if(btns.length < 2 || btns.length > 8 || seg.querySelectorAll(":scope > button.on").length > 1) return;
    const b0 = btns[0].dataset, id = [b0.act, b0.k || "", seg.dataset.tour || ""].join(":");
    seen[id] = (seen[id] || 0) + 1;
    seg.dataset.pill = "seg:" + (S.ui.tab || "") + ":" + id + ":" + seen[id];
    seg.classList.add("rtabs", "glass", "seg-glass");
    seg.setAttribute("role", "tablist");
    btns.forEach(b => b.setAttribute("aria-pressed", String(b.classList.contains("on"))));
    seg.insertAdjacentHTML("afterbegin", `<div class="glass-pill"><i class="lens"></i></div>`);
  });
}
function mountSegPills(root = document){
  upgradeSegs(root);
  root.querySelectorAll("[data-pill]").forEach(bar => {
    const btns = [...bar.querySelectorAll("button")], i = btns.findIndex(b => b.classList.contains("on")), key = bar.dataset.pill;
    if(i < 0) return;
    const r = bar.getBoundingClientRect(); if(!r.width) return;
    const q = btns.map(b => { const x = b.getBoundingClientRect(); return [x.left - r.left + bar.scrollLeft, x.width]; });
    const tabX = k => { const a = Math.max(0, Math.min(q.length - 1, Math.floor(k))), b = Math.min(q.length - 1, a + 1), f = k - a; return (q[a][0] + q[a][1] / 2) * (1 - f) + (q[b][0] + q[b][1] / 2) * f; };
    const prev = PILL_PREV[key] ?? i;
    const p = new WRI_MOTION.GlassPill(bar.querySelector(".glass-pill"), {tabX, half:Math.max(28, q[i][1] / 2), minX:2, maxX:bar.scrollWidth - 2, baseH:36, cy:r.height / 2, start:prev});
    p.go(i); PILL_PREV[key] = i;
    if(btns[i] && bar.scrollWidth > bar.clientWidth) btns[i].scrollIntoView({block:"nearest", inline:"center"});
  });
}
const _afterPaintG = afterPaint;
afterPaint = function(){ _afterPaintG(); mountSegPills(); };

// Page intros are clamped to two lines; tapping toggles the rest.
document.addEventListener("click", e => { const l = e.target.closest && e.target.closest(".lead"); if(!l || e.target.closest("a,button")) return; l.classList.toggle("open"); l.setAttribute("aria-expanded", String(l.classList.contains("open"))); });
