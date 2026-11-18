/* RUNLAB design system, "Instrument" (v5). Pure SVG/HTML primitives: no app state, no DOM access.
 * Rule: a number or a shape carries the meaning; a label is two or three words. Every primitive takes real values only.
 * If a value is missing it draws an empty track, never an assumed value.
 * Colour roles: --acc (orange) = action / current, --pos (teal) = done / positive, --warn (amber), --bad (red), --mu = context.
 */
(function (G) {
  "use strict";
  const e = s => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** A figure: big value, small unit, short label. size: xl | l | m | s. */
  function fig(value, unit, label, { size = "l", tone = "", roll = null, cls = "" } = {}) {
    return `<div class="ds-fig ${size}${tone ? " t-" + tone : ""}${cls ? " " + cls : ""}"><span class="ds-v"${roll !== null ? ` data-roll="${roll}"` : ""}>${e(value)}</span>${unit ? `<span class="ds-u">${e(unit)}</span>` : ""}${label ? `<span class="ds-l">${e(label)}</span>` : ""}</div>`;
  }

  /** Progress ring. v / max; inner slot is HTML (usually a fig). tone: acc | pos | warn. */
  function ring(v, max, inner = "", { size = 168, stroke = 12, tone = "acc", label = "", over = false } = {}) {
    const r = (size - stroke) / 2, C = 2 * Math.PI * r, p = max > 0 ? clamp(v / max, 0, 1) : 0;
    return `<div class="ds-ring" style="--sz:${size}px" role="img" aria-label="${e(label)}"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ds-ring-trk" stroke-width="${stroke}"/>
      ${p > 0 ? "" : "<!--"}<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ds-ring-v t-${tone}" stroke-width="${stroke}" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${p > 0 ? "" : "-->"}
      ${over ? `<circle cx="${size / 2}" cy="${stroke / 2}" r="${stroke / 2 + 2}" class="ds-ring-over"/>` : ""}</svg><div class="ds-ring-in">${inner}</div></div>`;
  }

  /** Bars with an optional plan outline per bar. items: [{v, plan?, label?, hi?, ghost?, act?, tip}] */
  function bars(items, { h = 120, w = 320, gap = 6, labels = true, axis = false, unit = "" } = {}) {
    if (!items.length) return "";
    const max = Math.max(1, ...items.map(x => Math.max(x.v || 0, x.plan || 0))), lh = labels ? 16 : 0, ih = h - lh, bw = (w - gap * (items.length - 1)) / items.length;
    let g = "";
    if (axis) { [0.5, 1].forEach(k => { const y = ih - ih * k; g += `<line x1="0" x2="${w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="ds-grid"/><text x="${w}" y="${(y - 3).toFixed(1)}" class="ds-ax" text-anchor="end">${f1(max * k)}${unit ? " " + unit : ""}</text>`; }); }
    items.forEach((it, i) => {
      const x = i * (bw + gap), vh = it.v ? Math.max(3, ih * it.v / max) : 0, ph = it.plan ? ih * it.plan / max : 0;
      const inner = `${ph ? `<rect x="${x.toFixed(1)}" y="${(ih - ph).toFixed(1)}" width="${bw.toFixed(1)}" height="${ph.toFixed(1)}" rx="3" class="ds-bar-plan"/>` : ""}
        ${vh ? `<rect x="${x.toFixed(1)}" y="${(ih - vh).toFixed(1)}" width="${bw.toFixed(1)}" height="${vh.toFixed(1)}" rx="3" class="ds-bar${it.hi ? " hi" : ""}${it.tone ? " t-" + it.tone : ""}"/>` : `<rect x="${x.toFixed(1)}" y="${ih - 2}" width="${bw.toFixed(1)}" height="2" rx="1" class="ds-bar-none"/>`}
        ${labels && it.label ? `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 3}" class="ds-ax${it.hi ? " hi" : ""}" text-anchor="middle">${e(it.label)}</text>` : ""}`;
      g += it.act ? `<g class="ds-hit" tabindex="0" role="button" data-act="${e(it.act.a)}" ${Object.entries(it.act).filter(([k]) => k !== "a").map(([k, v]) => `data-${k}="${e(v)}"`).join(" ")} aria-label="${e(it.tip || "")}"><rect x="${x.toFixed(1)}" y="0" width="${bw.toFixed(1)}" height="${ih}" class="ds-hitbox"/>${inner}<title>${e(it.tip || "")}</title></g>`
        : `<g><title>${e(it.tip || "")}</title>${inner}</g>`;
    });
    return `<svg class="ds-bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="${e(items.map(x => x.tip).filter(Boolean).join("; "))}">${g}</svg>`;
  }

  /** Sparkline of values (higher = better when invert is false). Marks the last point. */
  function spark(vals, { w = 300, h = 64, invert = false, label = "" } = {}) {
    const v = vals.filter(x => x !== null && x !== undefined);
    if (v.length < 2) return `<svg class="ds-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" class="ds-grid"/></svg>`;
    const lo = Math.min(...v), hi = Math.max(...v), span = Math.max(1e-9, hi - lo), pad = 6;
    const X = i => pad + i * (w - pad * 2) / (v.length - 1), Y = x => pad + (h - pad * 2) * (invert ? (x - lo) / span : 1 - (x - lo) / span);
    const d = v.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(x).toFixed(1)}`).join(" ");
    return `<svg class="ds-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${e(label)}"><path d="${d}" class="ds-spark-l"/><circle cx="${X(v.length - 1).toFixed(1)}" cy="${Y(v[v.length - 1]).toFixed(1)}" r="4.5" class="ds-spark-end"/></svg>`;
  }

  /** Linear meter v/max with optional marker (e.g. plan). */
  function meter(v, max, { tone = "acc", mark = null, label = "" } = {}) {
    const p = max > 0 ? clamp(v / max * 100, 0, 100) : 0, m = mark !== null && max > 0 ? clamp(mark / max * 100, 0, 100) : null;
    return `<span class="ds-meter" role="img" aria-label="${e(label)}"><i class="t-${tone}" style="width:${p.toFixed(1)}%"></i>${m !== null ? `<b style="left:${m.toFixed(1)}%"></b>` : ""}</span>`;
  }

  /** Day grid (heat map), GitHub-style: one column per week, rows Mon..Sun. cells: [{d, v, today?, future?, act?, tip}] oldest first, length = 7 * weeks. */
  function heat(cells, { max = null, cell = 18, gap = 4, rowLabels = ["S", "", "R", "", "J", "", "M"] } = {}) {
    const mx = max || Math.max(1, ...cells.map(c => c.v || 0)), cols = Math.ceil(cells.length / 7), lw = rowLabels ? 14 : 0;
    const w = lw + cols * cell + (cols - 1) * gap, h = 7 * cell + 6 * gap;
    let g = rowLabels ? rowLabels.map((l, i) => l ? `<text x="0" y="${i * (cell + gap) + cell * .72}" class="ds-ax">${l}</text>` : "").join("") : "";
    g += cells.map((c, i) => {
      const x = lw + Math.floor(i / 7) * (cell + gap), y = (i % 7) * (cell + gap), lv = c.v ? clamp(Math.ceil(c.v / mx * 4), 1, 4) : 0;
      const r = `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" class="ds-heat l${lv}${c.today ? " today" : ""}${c.future ? " fut" : ""}"/>`;
      return c.act ? `<g class="ds-hit" tabindex="0" role="button" data-act="${e(c.act.a)}" data-d="${e(c.d)}" aria-label="${e(c.tip)}">${r}<title>${e(c.tip)}</title></g>` : `<g><title>${e(c.tip)}</title>${r}</g>`;
    }).join("");
    return `<svg class="ds-heatmap" viewBox="0 0 ${w} ${h}" role="img" aria-label="Kalender lari, ${cols} minggu">${g}</svg>`;
  }

  /** Section head: tiny caps kicker + optional trailing control. */
  const head = (kicker, trail = "") => `<div class="ds-head"><h2 class="ds-k">${e(kicker)}</h2>${trail}</div>`;

  /** Small inline icons (stroke). */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
    runs: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    lab: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7 15h10"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    shoe: '<path d="M3 16c0-3 1-7 3-8l3 2 3-1c1 3 4 4 7 4 1.5 0 2 1 2 2v1H3z"/><path d="M3 19h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h8"/>'
  };
  const ic = (k, cls = "") => `<svg class="ds-ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${P[k] || P.info}</svg>`;

  /** Chart width in SVG units that matches the space it will get, so 10 px axis text stays ~10 px on every screen. */
  function cw(max = 720, inset = 36) {
    const vw = (typeof window !== "undefined" && window.innerWidth) || 390, avail = vw >= 900 ? Math.min(vw - 208 - 80, 1080) : vw - 32;
    return Math.round(clamp(avail - inset, 260, max));
  }

  G.WRI_DS = { cw, fig, ring, bars, spark, meter, heat, head, ic, esc: e, f1 };
})(typeof globalThis !== "undefined" ? globalThis : this);
