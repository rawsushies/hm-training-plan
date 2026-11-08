/* WeRunIt 4.0 companion layer.
 *  - Kiki, redesigned as a small sporty bot: visor face, orange headband, race bib. Blinks, bobs, cheers.
 *  - Coach card: the tutorial is a card docked above the tab bar with Kiki peeking over its edge.
 *    Swipe left = next, swipe right = back. Replaces the side-tab speech bubble.
 *  - Drum wheels: every <select> in the app is shown as a swipeable wheel. The real <select> stays in the DOM
 *    (invisible) so values, ids, forms and handlers keep working; the wheel writes to it and fires change/input.
 *  - Week dial: day pickers are seven days around a ring instead of a row of boxes.
 * Loaded after app4.js, before startApp().
 */
(function (G) {
  "use strict";

  /* ---------- Kiki ---------- */
  mascot = function (cls = "mascot", mood = "") {
    return `<svg class="${cls} kiki ${mood}" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse class="k-sh" cx="32" cy="61" rx="15" ry="2.4"/>
      <g class="k-bob">
        <path class="k-arm" d="M15 46 q-6 -2 -7 -9"/><circle class="k-fist" cx="8" cy="36" r="3.6"/>
        <path class="k-arm" d="M49 46 q5 1 6 6"/><circle class="k-fist" cx="55" cy="53" r="3.6"/>
        <rect class="k-body" x="16" y="39" width="32" height="19" rx="9"/>
        <rect class="k-bib" x="24" y="43" width="16" height="11" rx="2.5"/><text class="k-no" x="32" y="51.6" text-anchor="middle">21</text>
        <path class="k-ant" d="M32 9 V4"/><circle class="k-tip" cx="32" cy="3.4" r="2.4"/>
        <rect class="k-head" x="11" y="8" width="42" height="33" rx="14"/>
        <path class="k-band" d="M11.4 17 Q32 12 52.6 17 L52.6 22 Q32 17 11.4 22 Z"/>
        <path class="k-tail" d="M52 18 q6 -1 9 -5 M52 21 q6 1 10 -1"/>
        <rect class="k-visor" x="16" y="23" width="32" height="13" rx="6.5"/>
        <g class="k-eyes"><rect x="22" y="26" width="6" height="7" rx="3"/><rect x="36" y="26" width="6" height="7" rx="3"/></g>
      </g></svg>`;
  };

  /* ---------- Coach card (tutorial) ---------- */
  tutBubble = function () {
    const t = S.ui.tut, d = tourDef(t.id); if (!d || !d.steps[t.i]) return "";
    const st = d.steps[t.i], n = d.steps.length, last = t.i === n - 1;
    const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
    const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
    return `<div class="tour coachcard" id="tour" role="dialog" aria-live="polite" aria-label="Tutorial ${esc(d.title)}">
      <div class="bubble">
        <div class="cc-bot">${mascot("cc-kiki", last ? "cheer" : "")}</div>
        <div class="prog" aria-hidden="true">${d.steps.map((_, i) => `<i class="${i < t.i ? "on" : i === t.i ? "cur" : ""}"></i>`).join("")}</div>
        <p class="cap cc-cap">${esc(d.title)} · ${t.i + 1}/${n}</p>
        <h3>${esc(st.t)}</h3><p class="sm">${esc(st.b)}</p>
        <p class="xs mu" id="tour-miss" hidden>Muncul setelah ada data</p>
        <div class="cc-ctl">
          <button class="cc-skip" data-act="tutClose">${last ? "Tutup" : "Lewati"}</button>
          <span class="cc-swipe" aria-hidden="true">geser</span>
          ${t.i > 0 ? `<button class="cc-round ghost" data-act="tutPrev" aria-label="Balik"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6"/></svg></button>` : ""}
          <button class="cc-round" data-act="tutNext" aria-label="${last ? "Selesai" : "Lanjut"}">${last ? check : arrow}</button>
        </div>
      </div></div>`;
  };
  // swipe on the card: left = next, right = back
  let sx = null, sy = 0;
  document.addEventListener("pointerdown", e => { const b = e.target.closest && e.target.closest("#tour .bubble"); if (b && !e.target.closest("button")) { sx = e.clientX; sy = e.clientY; } }, { passive: true });
  document.addEventListener("pointerup", e => {
    if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) ACT.tutNext(); else if (S.ui.tut && S.ui.tut.i > 0) ACT.tutPrev();
  }, { passive: true });

  /* ---------- Week dial ---------- */
  dayChips = function (sel, act, extra = "") {
    const R = 74;
    return `<div class="wdial" role="group"><div class="wd-core"><b class="num">${sel.length}</b><span class="cap">hari</span></div>${DAYS_SHORT.map((d, i) => {
      const a = (-90 + i * 360 / 7) * Math.PI / 180, x = Math.round(Math.cos(a) * R), y = Math.round(Math.sin(a) * R);
      return `<button class="wd-d ${sel.includes(i) ? "on" : ""}" style="--x:${x}px;--y:${y}px" data-act="${act}" data-d="${i}" aria-pressed="${sel.includes(i)}" ${extra}>${d}</button>`;
    }).join("")}</div>`;
  };

  /* ---------- Drum wheels for every <select> ---------- */
  const ITEM = 40;
  function wheel(sel) {
    if (sel.dataset.whl || sel.multiple) return;
    sel.dataset.whl = "1"; sel.classList.add("whl-src"); sel.tabIndex = -1;
    const w = document.createElement("div");
    w.className = "whl"; w.setAttribute("role", "listbox"); w.tabIndex = 0;
    if (sel.id) w.setAttribute("aria-labelledby", sel.id);
    const tr = document.createElement("div"); tr.className = "whl-track";
    tr.innerHTML = [...sel.options].map((o, i) => `<div class="whl-i" role="option" data-i="${i}">${esc(o.text)}</div>`).join("");
    w.appendChild(tr); w.insertAdjacentHTML("beforeend", '<div class="whl-lens" aria-hidden="true"></div>');
    sel.after(w);
    const items = [...tr.children];
    let ours = false, t = 0, live = 0;
    const paint = () => {
      const top = tr.scrollTop;
      items.forEach((el, i) => {
        const d = Math.max(-3, Math.min(3, (i * ITEM - top) / ITEM));
        el.style.transform = `rotateX(${(-d * 24).toFixed(1)}deg) scale(${(1 - Math.abs(d) * .08).toFixed(3)})`;
        el.style.opacity = (1 - Math.abs(d) * .32).toFixed(2);
        el.classList.toggle("on", Math.abs(d) < .5);
      });
    };
    const commit = () => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(tr.scrollTop / ITEM)));
      if (i !== sel.selectedIndex) {
        sel.selectedIndex = i; ours = true;
        sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true }));
        ours = false; if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) {}
      }
    };
    const go = (i, smooth) => { live = smooth ? Date.now() : live; tr.scrollTo({ top: Math.max(0, i) * ITEM, behavior: smooth ? "smooth" : "auto" }); };
    tr.addEventListener("scroll", () => { live = Date.now(); requestAnimationFrame(paint); clearTimeout(t); t = setTimeout(commit, 140); }, { passive: true });
    tr.addEventListener("click", e => { const it = e.target.closest(".whl-i"); if (it) { live = Date.now(); go(+it.dataset.i, true); } });
    w.addEventListener("keydown", e => {
      const k = { ArrowDown: 1, ArrowUp: -1 }[e.key]; if (!k) return;
      e.preventDefault(); go(Math.max(0, Math.min(items.length - 1, sel.selectedIndex + k)), true);
    });
    sel.addEventListener("change", () => { if (!ours) go(sel.selectedIndex, false); });
    if (sel.disabled) w.classList.add("off");
    w._sync = () => { if (Date.now() - live > 600 && Math.round(tr.scrollTop / ITEM) !== sel.selectedIndex) go(sel.selectedIndex, true); };
    const sync = () => { if (tr.clientHeight) { go(sel.selectedIndex, false); paint(); } };
    if (G.ResizeObserver) new ResizeObserver(sync).observe(tr);
    requestAnimationFrame(sync);
  }
  const enhance = root => (root || document).querySelectorAll("select:not([data-whl])").forEach(wheel);
  // code that sets select.value directly fires no event: re-check wheels after every tap or edit
  const resync = () => document.querySelectorAll(".whl").forEach(w => w._sync && w._sync());
  ["click", "change", "input"].forEach(ev => document.addEventListener(ev, () => setTimeout(resync, 0), true));
  const _afterPaintC = afterPaint;
  afterPaint = function () { _afterPaintC(); enhance(document.getElementById("app")); };
  let q = 0;
  if (G.MutationObserver) new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; enhance(document.getElementById("app")); }); })
    .observe(document.getElementById("app"), { childList: true, subtree: true });

  G.WRI_COMPANION = { wheel, enhance };
})(typeof globalThis !== "undefined" ? globalThis : this);
