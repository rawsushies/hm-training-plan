/* RUNLAB chart components: pure SVG string builders (no DOM, no dependencies). Exposes globalThis.WRI_CHARTS.
 * Every chart: axis labels with units, a legend, an accessible text summary (role="img" + aria-label, plus a
 * readout element), selectable marks (data-act="chartSel" data-chart data-i, keyboard focusable) and an empty state.
 * Nothing here invents values: empty input renders an explicit empty state.
 */
(function (G) {
  "use strict";
  const e = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const p2 = n => String(n).padStart(2, "0");
  const pace = s => s === null || s === undefined ? "–" : `${Math.floor(s / 60)}:${p2(Math.round(s % 60))}`;
  const km = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const dlabel = s => { const [, m, d] = s.split("-").map(Number); return `${d} ${MON[m - 1]}`; };
  const empty = (msg, h = 140) => `<div class="ch-empty" style="min-height:${h}px"><span>${e(msg)}</span></div>`;
  const nice = v => { if (v <= 0) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
  const mark = (chart, i, label, inner, sel) => `<g class="ch-mark${sel ? " sel" : ""}" data-act="chartSel" data-chart="${chart}" data-i="${i}" tabindex="0" role="button" aria-pressed="${!!sel}" aria-label="${e(label)}">${inner}</g>`;

  /** Weekly distance bars + run-count markers. series: [{start, km, runs, logged}] */
  function weekly(series, { sel = null, w = 640, h = 220 } = {}) {
    if (!series || !series.length || !series.some(x => x.runs)) return empty("Belum ada lari tercatat di periode ini.");
    const pl = 34, pr = 10, pt = 22, pb = 28, iw = w - pl - pr, ih = h - pt - pb, n = series.length;
    const maxKm = nice(Math.max(...series.map(x => x.km), 1)), bw = iw / n, y = v => pt + ih * (1 - v / maxKm);
    let g = "";
    for (let t = 0; t <= 4; t++) { const v = maxKm * t / 4, yy = y(v); g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}" class="ch-grid"/><text x="${pl - 6}" y="${yy + 3}" class="ch-ax" text-anchor="end">${km(v)}</text>`; }
    series.forEach((x, i) => {
      const bx = pl + i * bw + bw * .16, bwid = bw * .68, bh = Math.max(x.runs ? 2 : 0, ih * x.km / maxKm);
      const label = `Minggu ${dlabel(x.start)}: ${x.runs ? `${km(x.km)} km, ${x.runs} lari` : "tidak ada lari tercatat"}`;
      const inner = x.runs ? `<rect x="${bx.toFixed(1)}" y="${(pt + ih - bh).toFixed(1)}" width="${bwid.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" class="ch-bar${x.logged === "partial" ? " part" : ""}"/>` + `<circle cx="${(bx + bwid / 2).toFixed(1)}" cy="${(pt + ih - bh - 7).toFixed(1)}" r="${Math.min(5, 2 + x.runs)}" class="ch-dot"/>`
        : `<rect x="${bx.toFixed(1)}" y="${pt + ih - 3}" width="${bwid.toFixed(1)}" height="3" rx="1.5" class="ch-none"/>`;
      g += mark("weekly", i, label, `<rect x="${(pl + i * bw).toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${ih}" class="ch-hit"/>` + inner, sel === i);
    });
    const ticks = n <= 8 ? series.map((_, i) => i) : [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1];
    ticks.forEach(i => { g += `<text x="${(pl + i * bw + bw / 2).toFixed(1)}" y="${h - 8}" class="ch-ax" text-anchor="middle">${dlabel(series[i].start)}</text>`; });
    const tot = series.reduce((a, x) => a + x.km, 0);
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="Km per minggu, ${n} minggu, total ${km(tot)} km"><text x="${pl - 6}" y="9" class="ch-ax" text-anchor="end">km</text>${g}</svg>
      <div class="ch-legend"><span><i class="lg bar"></i>km per minggu</span><span><i class="lg dot"></i>jumlah lari (ukuran titik)</span><span><i class="lg part"></i>sebagian tanpa durasi</span><span><i class="lg none"></i>tidak ada catatan</span></div>`;
  }

  /** Pace trend dot plot for one band: x = date, y = pace (faster = higher), early/late halves, median line + IQR band. */
  function trend(points, band, { sel = null, w = 640, h = 240 } = {}) {
    const pts = (points || []).filter(p => !band || p.band === band.band);
    if (pts.length < 2) return empty("Belum cukup lari dengan jarak + durasi di rentang jarak ini.");
    const pl = 44, pr = 10, pt = 14, pb = 28, iw = w - pl - pr, ih = h - pt - pb;
    const t = s => new Date(s + "T00:00:00").getTime(), t0 = t(pts[0].date), t1 = Math.max(t(pts[pts.length - 1].date), t0 + 864e5);
    const ps = pts.map(p => p.pace), lo = Math.min(...ps) - 10, hi = Math.max(...ps) + 10;
    const x = d => pl + iw * (t(d) - t0) / (t1 - t0), y = v => pt + ih * (v - lo) / (hi - lo);   // faster (smaller) is higher
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, yy = y(v); g += `<line x1="${pl}" x2="${w - pr}" y1="${yy}" y2="${yy}" class="ch-grid"/><text x="${pl - 6}" y="${yy + 3}" class="ch-ax" text-anchor="end">${pace(v)}</text>`; }
    if (band && band.early.n && band.late.n) {
      const mid = pts.find(p => p.date > (band.splitDate || "")) || null;
      const xm = mid ? x(mid.date) - 4 : pl + iw / 2;
      [["early", pl, xm, "sa"], ["late", xm, w - pr, "sb"]].forEach(([k, x0, x1, c]) => {
        const s = band[k]; if (!s.n) return;
        g += `<rect x="${x0}" y="${y(s.q1)}" width="${x1 - x0}" height="${Math.max(1, y(s.q3) - y(s.q1))}" class="ch-iqr ${c}"/><line x1="${x0}" x2="${x1}" y1="${y(s.median)}" y2="${y(s.median)}" class="ch-med ${c}"/>`;
      });
      g += `<line x1="${xm}" x2="${xm}" y1="${pt}" y2="${pt + ih}" class="ch-split"/>`;
    }
    pts.forEach((p, i) => {
      const late = band && band.splitDate ? p.date > band.splitDate : false;
      g += mark("trend", i, `${dlabel(p.date)}: ${km(p.km)} km, pace ${pace(p.pace)} /km`, `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.pace).toFixed(1)}" r="${sel === i ? 7 : 5}" class="ch-pt ${late ? "sb" : "sa"}"/>`, sel === i);
    });
    g += `<text x="${pl}" y="${h - 8}" class="ch-ax">${dlabel(pts[0].date)}</text><text x="${w - pr}" y="${h - 8}" class="ch-ax" text-anchor="end">${dlabel(pts[pts.length - 1].date)}</text>`;
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="Pace ${pts.length} lari ${band ? band.band : ""}; ${band && band.early.n ? `median awal ${pace(band.early.median)}, akhir ${band.late.n ? pace(band.late.median) : "–"} per km` : ""}"><text x="4" y="10" class="ch-ax">/km ↑ lebih cepat</text>${g}</svg>
      <div class="ch-legend"><span><i class="lg sa"></i>paruh awal</span><span><i class="lg sb"></i>paruh akhir</span><span><i class="lg med"></i>median</span><span><i class="lg iqr"></i>rentang tengah (IQR)</span></div>`;
  }

  /** Two-group comparison: horizontal strips with box (IQR) and median. m: compare metrics, s: series {a,b}. */
  function compare(m, s, { sel = null, w = 640, h = 170 } = {}) {
    if (!s || (!s.a.length && !s.b.length)) return empty("Belum ada lari yang masuk ke kedua kelompok.");
    const all = s.a.concat(s.b).map(x => x.pace), lo = Math.min(...all) - 10, hi = Math.max(...all) + 10;
    const pl = 12, pr = 12, iw = w - pl - pr, x = v => pl + iw * (hi - v) / (hi - lo);       // faster to the right
    let g = "";
    [["a", 46, "sa"], ["b", 112, "sb"]].forEach(([k, cy, c]) => {
      const st = m[k];
      g += `<text x="${pl}" y="${cy - 22}" class="ch-lbl">${e(m.labels[k])} · n ${st.n}${st.n ? ` · median ${pace(st.median)} /km` : ""}</text>`;
      if (st.n) g += `<rect x="${x(st.q3)}" y="${cy - 10}" width="${Math.max(2, x(st.q1) - x(st.q3))}" height="20" rx="4" class="ch-iqr ${c}"/><line x1="${x(st.median)}" x2="${x(st.median)}" y1="${cy - 13}" y2="${cy + 13}" class="ch-med ${c}"/>`;
      s[k].forEach((p, i) => { const idx = k === "a" ? i : s.a.length + i; g += mark("compare", idx, `${e(m.labels[k])}: ${dlabel(p.date)}, ${km(p.km)} km, ${pace(p.pace)} /km`, `<circle cx="${x(p.pace).toFixed(1)}" cy="${cy}" r="${sel === idx ? 7 : 4.5}" class="ch-pt ${c}"/>`, sel === idx); });
    });
    g += `<text x="${pl}" y="${h - 8}" class="ch-ax">${pace(hi)} /km (lebih lambat)</text><text x="${w - pr}" y="${h - 8}" class="ch-ax" text-anchor="end">${pace(lo)} /km (lebih cepat) →</text>`;
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="Perbandingan pace ${e(m.labels.a)} (n ${m.a.n}) dan ${e(m.labels.b)} (n ${m.b.n})">${g}</svg>
      <div class="ch-legend"><span><i class="lg sa"></i>${e(m.labels.a)}</span><span><i class="lg sb"></i>${e(m.labels.b)}</span><span><i class="lg iqr"></i>IQR · garis = median</span></div>`;
  }

  /** Coverage bars: how many of the included runs carry each field. coverage: [{k,label,n,total,need?,provenance?}] */
  function coverage(cov, { need = [] } = {}) {
    if (!cov || !cov.length || !cov[0].total) return empty("Belum ada lari di periode ini.", 80);
    return `<div class="cov" role="list">${cov.map(c => { const pct = Math.round(c.n / c.total * 100), req = need.includes(c.k) || c.need; return `<div class="cov-row${req && !c.n ? " miss" : ""}" role="listitem" aria-label="${e(c.label || c.l)}: ${c.n} dari ${c.total}${req ? ", dibutuhkan" : ""}">
      <span class="cov-l">${e(c.label || c.l)}${req ? '<b class="cov-need">perlu</b>' : ""}</span><span class="cov-bar"><i style="width:${pct}%"></i></span><span class="cov-n num">${c.n}/${c.total}</span></div>`; }).join("")}</div>`;
  }

  /** Hero trace: the runner's own recent paces as a waveform (decorative but real). */
  function trace(paces, { w = 600, h = 120 } = {}) {
    if (!paces || paces.length < 3) return `<svg class="hero-trace" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M0 ${h * .62} H${w}" class="lane"/><path d="M0 ${h * .82} H${w}" class="lane"/></svg>`;
    const lo = Math.min(...paces), hi = Math.max(...paces) || lo + 1, n = paces.length;
    const pts = paces.map((p, i) => [w * i / (n - 1), h * .2 + h * .6 * (p - lo) / Math.max(1, hi - lo)]);
    const d = pts.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
    return `<svg class="hero-trace" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M0 ${h * .9} H${w}" class="lane"/><path d="${d}" class="trace"/><circle cx="${pts[n - 1][0]}" cy="${pts[n - 1][1]}" r="5" class="trace-end"/></svg>`;
  }

  G.WRI_CHARTS = { weekly, trend, compare, coverage, trace, pace, km, dlabel };
})(typeof globalThis !== "undefined" ? globalThis : this);
