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
    const pl = 44, pr = 10, pt = 26, pb = 28, iw = w - pl - pr, ih = h - pt - pb;
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

  /** Two-group comparison: horizontal strips with box (IQR) and median, pace gridlines and a median-difference bracket.
   *  m: compare metrics, s: series {a,b}. Faster is to the right. */
  /** Compare, time view: each run's pace by date, coloured by group, with each group's median as a dashed line.
   *  Same mark indices as the spread view so selection/readout keep working. Lets the runner see whether one
   *  group clusters in a different period (a time confounder). Plots existing values only. */
  function compareTime(m, s, { sel = null, w = 640, h = 250, hide = {} } = {}) {
    const vis = ["a", "b"].filter(k => !hide[k]), pts = vis.flatMap(k => s[k]);
    if (pts.length < 2) return empty("Belum cukup lari di kelompok yang ditampilkan.");
    const pl = 44, pr = 14, pt = 26, pb = 28, ins = 12, iw = w - pl - pr - 2 * ins, ih = h - pt - pb;
    const t = d => new Date(d + "T00:00:00").getTime(), ds = pts.map(p => t(p.date)), t0 = Math.min(...ds), t1 = Math.max(Math.max(...ds), t0 + 864e5);
    const ps = pts.map(p => p.pace), lo = Math.min(...ps) - 10, hi = Math.max(...ps) + 10;
    const x = d => pl + ins + iw * (t(d) - t0) / (t1 - t0), y = v => pt + ih * (v - lo) / (hi - lo);
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, yy = y(v); g += `<line x1="${pl}" x2="${w - pr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="ch-grid"/><text x="${pl - 6}" y="${(yy + 3).toFixed(1)}" class="ch-ax" text-anchor="end">${pace(v)}</text>`; }
    [["a", "sa"], ["b", "sb"]].forEach(([k, c]) => { if (hide[k] || !m[k].n) return; const yy = y(m[k].median); g += `<line x1="${pl}" x2="${w - pr}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" class="ch-medline ${c}"/>`; });
    [["a", "sa"], ["b", "sb"]].forEach(([k, c]) => { if (hide[k]) return; s[k].forEach((p, i) => { const idx = k === "a" ? i : s.a.length + i; g += mark("compare", idx, `${e(m.labels[k])}: ${dlabel(p.date)}, ${km(p.km)} km, ${pace(p.pace)} /km`, `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.pace).toFixed(1)}" r="${sel === idx ? 8 : 5.5}" class="ch-pt ${c}"/>`, sel === idx); }); });
    const d0 = new Date(t0), d1 = new Date(t1), iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    g += `<text x="${pl + ins}" y="${h - 8}" class="ch-ax">${dlabel(iso(d0))}</text><text x="${w - pr}" y="${h - 8}" class="ch-ax" text-anchor="end">${dlabel(iso(d1))}</text><text x="${pl}" y="11" class="ch-ax">↑ lebih cepat (pace /km)</text>`;
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="Pace per tanggal, ${vis.map(k => `${e(m.labels[k])} (n ${m[k].n})`).join(" dan ")}">${g}</svg>
      <div class="ch-legend"><span><i class="lg sa"></i>${e(m.labels.a)}</span><span><i class="lg sb"></i>${e(m.labels.b)}</span><span><i class="lg medd"></i>garis putus = median kelompok</span></div>`;
  }

  function compare(m, s, { sel = null, w = 640, h = 230, view = "spread", hide = {} } = {}) {
    if (!s || (!s.a.length && !s.b.length)) return empty("Belum ada lari yang masuk ke kedua kelompok.");
    if (view === "time") return compareTime(m, s, { sel, w, h, hide });
    const all = (hide.a ? [] : s.a).concat(hide.b ? [] : s.b).map(x => x.pace); if (!all.length) return empty("Semua kelompok disembunyikan.");
    const lo = Math.min(...all) - 10, hi = Math.max(...all) + 10;
    const pl = 12, pr = 12, pt = 8, pb = 34, iw = w - pl - pr, x = v => pl + iw * (hi - v) / (hi - lo);
    const ya = pt + (h - pt - pb) * 0.3, yb = pt + (h - pt - pb) * 0.78;
    let g = "";
    const step = [5, 10, 15, 20, 30, 60].find(st => (hi - lo) / st <= 6) || 60;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${x(v).toFixed(1)}" x2="${x(v).toFixed(1)}" y1="${pt}" y2="${h - pb}" class="ch-grid"/><text x="${x(v).toFixed(1)}" y="${h - pb + 14}" class="ch-ax" text-anchor="middle">${pace(v)}</text>`;
    [["a", ya, "sa"], ["b", yb, "sb"]].forEach(([k, cy, c]) => {
      const st = m[k]; if (hide[k]) { g += `<text x="${pl}" y="${cy}" class="ch-ax">${e(m.labels[k])} disembunyikan</text>`; return; }
      g += `<text x="${pl}" y="${cy - 22}" class="ch-lbl">${e(m.labels[k])} · n ${st.n}${st.n ? ` · median ${pace(st.median)} /km` : ""}</text>`;
      if (st.n) g += `<rect x="${x(st.q3)}" y="${cy - 11}" width="${Math.max(2, x(st.q1) - x(st.q3))}" height="22" rx="4" class="ch-iqr ${c}"/><line x1="${x(st.median)}" x2="${x(st.median)}" y1="${cy - 15}" y2="${cy + 15}" class="ch-med ${c}"/>`;
      s[k].forEach((p, i) => { const idx = k === "a" ? i : s.a.length + i; g += mark("compare", idx, `${e(m.labels[k])}: ${dlabel(p.date)}, ${km(p.km)} km, ${pace(p.pace)} /km`, `<circle cx="${x(p.pace).toFixed(1)}" cy="${cy}" r="${sel === idx ? 8 : 5.5}" class="ch-pt ${c}"/>`, sel === idx); });
    });
    if (m.diff !== null && m.diff !== undefined && m.a.n && m.b.n && !hide.a && !hide.b) {
      const xa = x(m.a.median), xb = x(m.b.median), ym = (ya + yb) / 2;
      g += `<path d="M${xa.toFixed(1)} ${ya + 15} V${ym} H${xb.toFixed(1)} V${yb - 15}" class="ch-bracket"/><text x="${((xa + xb) / 2).toFixed(1)}" y="${ym - 5}" class="ch-lbl ch-diff" text-anchor="middle">${Math.abs(m.diff)} dtk/km</text>`;
    }
    g += `<text x="${pl}" y="${h - 4}" class="ch-ax">← lebih lambat</text><text x="${w - pr}" y="${h - 4}" class="ch-ax" text-anchor="end">lebih cepat → (pace /km)</text>`;
    return `<svg class="ch" viewBox="0 0 ${w} ${h}" role="img" aria-label="Perbandingan pace ${e(m.labels.a)} (n ${m.a.n}) dan ${e(m.labels.b)} (n ${m.b.n})">${g}</svg>
      <div class="ch-legend"><span><i class="lg sa"></i>${e(m.labels.a)}</span><span><i class="lg sb"></i>${e(m.labels.b)}</span><span><i class="lg iqr"></i>kotak = rentang tengah (IQR) · garis = median</span></div>`;
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
