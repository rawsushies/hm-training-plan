/* WeRunIt 4.0 companion layer.
 *  - Kiki, redesigned as a small sporty bot: visor face, orange headband, race bib. Blinks, bobs, cheers.
 *  - Kiki chat: the tutorial and the help sheets are a chat with Kiki (typing dots, words landing one by one,
 *    reply chips). Swipe left = next, swipe right = back. Replaces the side-tab speech bubble.
 *  - Drum wheels: every <select> in the app is shown as a swipeable wheel. The real <select> stays in the DOM
 *    (invisible) so values, ids, forms and handlers keep working; the wheel writes to it and fires change/input.
 *  - Week dial: day pickers are seven days around a ring instead of a row of boxes.
 * Loaded after app4.js, before startApp().
 */
(function (G) {
  "use strict";

  /* ---------- Kiki ----------
   * A small sporty bot. Moods change the face and the arms:
   *  wave  = right arm waves (hello)      point = right arm points up-right (look here)
   *  cheer = both fists up, happy ^^ eyes  think = head tilt, eyes look aside
   * Blinks, bobs and glances on its own; everything stops under reduced motion. */
  const EYES = {
    cheer: '<path d="M21 31 q4 -5 8 0 M35 31 q4 -5 8 0"/>',
    think: '<rect x="25" y="27" width="5" height="6" rx="2.5"/><rect x="39" y="27" width="5" height="6" rx="2.5"/>',
    "": '<rect x="22" y="26" width="6" height="7" rx="3"/><rect x="36" y="26" width="6" height="7" rx="3"/>'
  };
  mascot = function (cls = "mascot", mood = "") {
    const eyes = EYES[mood] || EYES[""];
    return `<svg class="${cls} kiki ${mood}" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse class="k-sh" cx="32" cy="61" rx="15" ry="2.4"/>
      <g class="k-bob">
        <g class="k-armL"><path class="k-arm" d="M17 47 q-6 -1 -8 -8"/><circle class="k-fist" cx="9" cy="38" r="3.8"/></g>
        <g class="k-armR"><path class="k-arm" d="M47 47 q6 -1 8 -8"/><circle class="k-fist" cx="55" cy="38" r="3.8"/></g>
        <rect class="k-body" x="17" y="39" width="30" height="19" rx="9"/>
        <rect class="k-bib" x="24.5" y="43" width="15" height="11" rx="2.5"/><text class="k-no" x="32" y="51.6" text-anchor="middle">21</text>
        <g class="k-headg">
          <path class="k-ant" d="M32 9 V4"/><circle class="k-tip" cx="32" cy="3.4" r="2.4"/>
          <rect class="k-head" x="11" y="8" width="42" height="33" rx="14"/>
          <path class="k-band" d="M11.4 17 Q32 12 52.6 17 L52.6 22 Q32 17 11.4 22 Z"/>
          <path class="k-tail" d="M52 18 q6 -1 9 -5 M52 21 q6 1 10 -1"/>
          <rect class="k-visor" x="16" y="23" width="32" height="13" rx="6.5"/>
          <g class="k-eyes">${eyes}</g>
        </g>
      </g></svg>`;
  };

  /* ---------- Kiki chat (tutorial) ----------
   * One message per step: a headline Kiki says, then a short line. The message "types": three dots, then the words
   * land one by one. Replies are chips. Swipe left = next, right = back. */
  const words = (txt, start) => esc(txt).split(/\s+/).map((w, i) => `<span class="kw" style="--i:${start + i}">${w}</span>`).join(" ");
  const MOODS = ["wave"];
  tutBubble = function () {
    const t = S.ui.tut, d = tourDef(t.id); if (!d || !d.steps[t.i]) return "";
    const st = d.steps[t.i], n = d.steps.length, last = t.i === n - 1;
    const mood = last ? "cheer" : t.i === 0 ? MOODS[0] : st.sel ? "point" : "think";
    const hl = st.t.split(/\s+/).length;
    const reply = last ? "Siap" : t.i === 0 ? "Ayo" : "Oke, lanjut";
    return `<div class="tour kchat" id="tour" role="dialog" aria-live="polite" aria-label="Tutorial ${esc(d.title)}">
      <div class="bubble">
        <div class="kc-top">
          <span class="kc-av">${mascot("kc-kiki", mood)}</span>
          <span class="kc-who"><b>Kiki</b><span class="cap">${esc(d.title)} · ${t.i + 1}/${n}</span></span>
          <button class="kc-x" data-act="tutClose" aria-label="Tutup tutorial">×</button>
        </div>
        <div class="kc-prog" aria-hidden="true">${d.steps.map((_, i) => `<i class="${i < t.i ? "on" : i === t.i ? "cur" : ""}"></i>`).join("")}</div>
        <div class="kc-msg" data-step="${t.i}">
          <span class="kc-typing" aria-hidden="true"><i></i><i></i><i></i></span>
          <p class="kc-hl">${words(st.t, 0)}</p>
          <p class="kc-sub">${words(st.b, hl + 1)}</p>
          <p class="kc-miss" id="tour-miss" hidden>Bagian ini muncul setelah ada data</p>
        </div>
        <div class="kc-replies">
          ${t.i > 0 ? `<button class="kc-chip ghost" data-act="tutPrev" aria-label="Balik">‹</button>` : ""}
          <button class="kc-chip pri" data-act="tutNext">${reply}</button>
          ${last ? "" : `<button class="kc-chip ghost" data-act="tutClose">Lewati</button>`}
          <span class="kc-swipe" aria-hidden="true">geser ‹ ›</span>
        </div>
      </div></div>`;
  };
  // swipe on the chat: left = next, right = back
  let sx = null, sy = 0;
  document.addEventListener("pointerdown", e => { const b = e.target.closest && e.target.closest("#tour .bubble"); if (b && !e.target.closest("button")) { sx = e.clientX; sy = e.clientY; } }, { passive: true });
  document.addEventListener("pointerup", e => {
    if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) ACT.tutNext(); else if (S.ui.tut && S.ui.tut.i > 0) ACT.tutPrev();
  }, { passive: true });

  /* ---------- Kiki help sheet: same chat voice ---------- */
  mHelp = function () {
    const h = TUT.HELP[M.k]; if (!h) return mHead("Bantuan");
    const d = h.tour ? tourDef(h.tour) : null;
    return `<div class="kc-sheet">
      <div class="kc-top"><span class="kc-av">${mascot("kc-kiki", "wave")}</span><span class="kc-who"><b>Kiki</b><span class="cap">${esc(h.title)}</span></span></div>
      <div class="kc-msg"><span class="kc-typing" aria-hidden="true"><i></i><i></i><i></i></span>
        <p class="cap kc-k">Apa ini?</p><p class="kc-hl">${words(h.what.split(/(?<=\.)\s/)[0], 0)}</p></div>
      <p class="cap kc-k" style="margin-top:14px">Cara pakai</p>
      <ol class="kc-steps">${h.how.map((x, i) => `<li style="--i:${i}"><span class="num">${i + 1}</span>${esc(x)}</li>`).join("")}</ol>
      ${d ? `<div class="kc-replies"><button class="kc-chip pri" data-act="tutStart" data-id="${h.tour}">Tunjukin aku · ${d.steps.length}</button></div>` : ""}
    </div>`;
  };

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

  /* ---------- Swipe dials for button rows (.seg with 3+ options) ----------
   * The row becomes a horizontal drum: the chosen option sits in the orange lens in the middle, the others curve
   * away. Swipe to roll it; when it settles, the option in the lens is tapped for you (same data-act as before).
   * Tapping an option still works. Nothing is chosen until the person actually touches the dial. */
  function dial(seg) {
    const bs = [...seg.children].filter(b => b.tagName === "BUTTON");
    if (seg.dataset.swd || bs.length < 3 || seg.closest(".tour,.dock,.wdial")) return;
    seg.dataset.swd = "1"; seg.classList.add("swd");
    const wrap = document.createElement("div"); wrap.className = "swd-wrap";
    seg.parentNode.insertBefore(wrap, seg); wrap.appendChild(seg);
    wrap.insertAdjacentHTML("beforeend", '<i class="swd-lens" aria-hidden="true"></i>');
    let touched = false, t = 0;
    const centre = () => { const mid = seg.scrollLeft + seg.clientWidth / 2; let best = null, bd = 1e9; bs.forEach(b => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = b; } }); return best; };
    const paint = () => {
      const mid = seg.scrollLeft + seg.clientWidth / 2;
      bs.forEach(b => { const d = Math.max(-3, Math.min(3, (b.offsetLeft + b.offsetWidth / 2 - mid) / b.offsetWidth));
        b.style.transform = `rotateY(${(d * 28).toFixed(1)}deg) scale(${(1 - Math.abs(d) * .1).toFixed(3)})`; b.style.opacity = (1 - Math.abs(d) * .26).toFixed(2); });
    };
    const to = (b, smooth) => b && seg.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - seg.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
    seg.addEventListener("click", e => { const b = e.target.closest("button"); touched = false; clearTimeout(t); if (b) to(b, true); });
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(ev => seg.addEventListener(ev, () => { touched = true; }, { passive: true }));
    seg.addEventListener("scroll", () => {
      requestAnimationFrame(paint); clearTimeout(t);
      t = setTimeout(() => { const b = centre(); if (touched && b && !b.classList.contains("on") && !b.disabled) { touched = false; b.click(); } }, 180);
    }, { passive: true });
    const sync = () => { if (seg.clientWidth) { to(seg.querySelector("button.on") || bs[Math.floor(bs.length / 2)], false); paint(); } };
    if (G.ResizeObserver) new ResizeObserver(sync).observe(seg);
    requestAnimationFrame(sync);
  }

  /* ---------- Long text → headline, sub-headline, context ----------
   * A paragraph or note longer than ~18 words is split: first sentence becomes the headline, the second the
   * sub-headline, the rest folds behind "Detail". The words stay in the page; only the shape changes. */
  const SENT = /(?<=[.!?])\s+(?=[A-Z0-9“"(])/;
  function chunk(el) {
    if (el.dataset.ch || el.closest(".tour,.kc-sheet,.gate,.whl,.swd-wrap,label,button,td,th,.kv,.hsc")) return;
    if (el.querySelector("button,a,input,select,textarea,svg,img,code,b.num")) return;
    const txt = el.textContent.trim(); el.dataset.ch = "1";
    if (txt.split(/\s+/).length < 19) return;
    const parts = txt.split(SENT); if (parts.length < 2) return;
    const [h, sub, ...rest] = parts;
    el.classList.add("hsc");
    el.innerHTML = `<b class="hsc-h">${esc(h)}</b><span class="hsc-s">${esc(sub)}</span>${rest.length ? `<details class="hsc-c"><summary>Detail</summary><span>${esc(rest.join(" "))}</span></details>` : ""}`;
  }
  const chunkAll = root => root.querySelectorAll("main p, main .note, .sheet p, .sheet .note, main .hint").forEach(chunk);
  const enhance = root => { root = root || document; root.querySelectorAll("select:not([data-whl])").forEach(wheel); root.querySelectorAll(".seg:not([data-swd])").forEach(dial); chunkAll(root); };
  // code that sets select.value directly fires no event: re-check wheels after every tap or edit
  const resync = () => document.querySelectorAll(".whl").forEach(w => w._sync && w._sync());
  ["click", "change", "input"].forEach(ev => document.addEventListener(ev, () => setTimeout(resync, 0), true));
  const _afterPaintC = afterPaint;
  afterPaint = function () { _afterPaintC(); enhance(document.getElementById("app")); };
  let q = 0;
  if (G.MutationObserver) new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; enhance(document.getElementById("app")); }); })
    .observe(document.getElementById("app"), { childList: true, subtree: true });

  G.WRI_COMPANION = { wheel, dial, chunk, enhance };
})(typeof globalThis !== "undefined" ? globalThis : this);
