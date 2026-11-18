/* RUNLAB deterministic analysis engine (pure; no DOM, no network). Exposes globalThis.WRI_ANALYSIS.
 * Every result has the same typed shape:
 *   {analysisId, methodVersion, createdAt, window:{from,to}, includedRecordIds, excluded:[{id,reason}], n,
 *    metrics, units, method, assumptions, limitations, missingFields, adequacy:"adequate"|"limited"|"insufficient", series}
 * Rules: only recorded values are used (missing duration → excluded from pace, never estimated); sample/demo runs
 * are excluded; implausible readings are flagged for review, never corrected or deleted; association ≠ causation.
 */
(function (G) {
  "use strict";
  const V = { weekly: "weekly-1", trend: "trend-1", compare: "compare-1", quality: "quality-1" };
  const DAY = 864e5;
  const p2 = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const monday = s => { const d = parse(s), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); };
  const r1 = v => Math.round(v * 10) / 10;
  const sorted = a => [...a].sort((x, y) => x - y);
  function quantile(a, q) { const s = sorted(a); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
  const median = a => quantile(a, 0.5);
  const PACE_MIN = 150, PACE_MAX = 1200;           // 2:30–20:00 /km outside this → flagged, excluded from pace
  const BANDS = [[3, 6, "3–6 km"], [6, 10, "6–10 km"], [10, 16, "10–16 km"], [16, 22, "16–22 km"], [22, 60, "22+ km"]];
  const bandOf = km => { const b = BANDS.find(([lo, hi]) => km >= lo && km < hi); return b ? b[2] : null; };
  const paceOf = l => l.distance > 0 && l.duration > 0 ? l.duration / l.distance : null;
  const startTime = l => { const m = /^t:(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(l.extId || ""); return m ? Number(m[2]) * 60 + Number(m[3]) : null; };
  const isStrava = l => /strava/i.test(l.src || "") || /^strava:/.test(l.extId || "");

  /** Shared record selection: real runs inside the window. Returns {runs, excluded}. */
  function select(state, { from = null, to }) {
    const runs = [], excluded = [];
    for (const l of state.logs || []) {
      if (l.sample) { excluded.push({ id: l.id, reason: "contoh data" }); continue; }
      if (l.date > to) { excluded.push({ id: l.id, reason: "tanggal di masa depan" }); continue; }
      if (from && l.date < from) continue;                  // outside the window: not part of this analysis at all
      runs.push(l);
    }
    return { runs, excluded };
  }
  const base = (id, v, w, now) => ({ analysisId: id, methodVersion: v, createdAt: now, window: { from: w.from || null, to: w.to } });

  /** A. Weekly volume: runs, km and recorded minutes per Monday–Sunday week. Strength counted separately. */
  function weekly(state, w, now = new Date().toISOString()) {
    const { runs, excluded } = select(state, w);
    const first = w.from || (runs.length ? runs.map(l => l.date).sort()[0] : w.to);
    const weeks = [];
    for (let m = monday(first); m <= w.to; m = addDays(m, 7)) weeks.push({ start: m, end: addDays(m, 6), runs: 0, km: 0, minutes: 0, durKnown: 0, strength: 0, ids: [] });
    const at = d => weeks.find(x => d >= x.start && d <= x.end);
    for (const l of runs) { const x = at(l.date); if (!x) continue; x.runs++; x.km += l.distance || 0; x.ids.push(l.id); if (l.duration > 0) { x.minutes += l.duration / 60; x.durKnown++; } }
    for (const s of state.strength || []) if (!s.sample) { const x = at(s.date); if (x && (!w.from || s.date >= w.from)) x.strength++; }
    weeks.forEach(x => { x.km = r1(x.km); x.minutes = Math.round(x.minutes); x.logged = x.runs ? (x.durKnown === x.runs ? "complete" : "partial") : "none"; });
    const active = weeks.filter(x => x.runs), kms = active.map(x => x.km);
    const n = runs.length;
    return Object.assign(base("weekly", V.weekly, w, now), {
      includedRecordIds: runs.map(l => l.id), excluded, n,
      metrics: { weeks: weeks.length, activeWeeks: active.length, emptyWeeks: weeks.length - active.length, totalKm: r1(kms.reduce((a, b) => a + b, 0)), medianWeekKm: kms.length ? r1(median(kms)) : null, medianRuns: active.length ? median(active.map(x => x.runs)) : null, strengthSessions: weeks.reduce((a, x) => a + x.strength, 0) },
      units: { km: "km", minutes: "menit (hanya lari yang ada durasinya)" },
      method: "Lari dijumlahkan per minggu Senin–Minggu. Minggu tanpa lari tercatat ditandai “tidak ada catatan”, bukan dianggap nol aktivitas. Strength dihitung terpisah, tidak dicampur ke km.",
      assumptions: ["Jarak sesuai yang tercatat (manual atau file)."],
      limitations: ["Lari yang tidak dicatat tidak terlihat.", "Menit hanya dari lari yang punya durasi."],
      missingFields: runs.some(l => !(l.duration > 0)) ? ["durasi (sebagian lari)"] : [],
      adequacy: active.length >= 4 ? "adequate" : active.length >= 2 ? "limited" : "insufficient",
      series: weeks
    });
  }

  /** B. Performance trend: pace per distance band, earlier half vs later half of the window, median + IQR. */
  function trend(state, w, opts = {}, now = new Date().toISOString()) {
    const { runs, excluded } = select(state, w), pts = [];
    const types = opts.types || null, minN = opts.minN || 3;
    for (const l of runs) {
      if (types && !types.includes(l.type)) { excluded.push({ id: l.id, reason: "jenis sesi lain" }); continue; }
      if (!(l.duration > 0)) { excluded.push({ id: l.id, reason: "durasi tidak tercatat" }); continue; }
      const p = paceOf(l), band = bandOf(l.distance);
      if (!band) { excluded.push({ id: l.id, reason: "jarak di bawah 3 km" }); continue; }
      if (p < PACE_MIN || p > PACE_MAX) { excluded.push({ id: l.id, reason: "pace tidak wajar, perlu dicek" }); continue; }
      pts.push({ id: l.id, date: l.date, pace: Math.round(p), km: l.distance, band, type: l.type, strava: isStrava(l) });
    }
    const dates = pts.map(p => p.date).sort(), mid = dates.length ? dates[Math.floor((dates.length - 1) / 2)] : null;
    const bands = BANDS.map(([, , label]) => {
      const all = pts.filter(p => p.band === label);
      if (!all.length) return null;
      const early = all.filter(p => p.date <= mid).map(p => p.pace), late = all.filter(p => p.date > mid).map(p => p.pace);
      const s = a => a.length ? { n: a.length, median: Math.round(median(a)), q1: Math.round(quantile(a, .25)), q3: Math.round(quantile(a, .75)) } : { n: 0 };
      const E = s(early), L = s(late), ok = E.n >= minN && L.n >= minN;
      return { band: label, n: all.length, early: E, late: L, diff: ok ? L.median - E.median : null, verdict: ok ? (Math.abs(L.median - E.median) < 5 ? "flat" : L.median < E.median ? "faster" : "slower") : "insufficient" };
    }).filter(Boolean);
    const enough = bands.filter(b => b.verdict !== "insufficient");
    return Object.assign(base("trend", V.trend, w, now), {
      includedRecordIds: pts.map(p => p.id), excluded, n: pts.length,
      metrics: { bands, splitDate: mid, comparableBands: enough.length },
      units: { pace: "detik per km (ditampilkan mm:dd /km)", km: "km" },
      method: `Hanya lari dengan jarak dan durasi tercatat. Dikelompokkan per rentang jarak; tiap rentang dibagi paruh awal vs paruh akhir periode (tanggal tengah ${mid || "–"}). Dibandingkan median pace dan rentang antar-kuartil (IQR). Minimal ${minN} lari per paruh.`,
      assumptions: ["Pace = durasi ÷ jarak (dihitung, bukan diukur langsung).", "Selisih < 5 detik/km dianggap sama."],
      limitations: ["Rute, tanjakan, cuaca dan effort bisa berbeda antar lari.", "Ini asosiasi waktu, bukan sebab-akibat.", "Lari tanpa durasi tidak ikut."],
      missingFields: excluded.some(e => e.reason === "durasi tidak tercatat") ? ["durasi"] : [],
      adequacy: enough.length ? (enough.some(b => b.early.n >= 5 && b.late.n >= 5) ? "adequate" : "limited") : "insufficient",
      series: pts
    });
  }

  /** C. Session comparison between two transparently defined groups. by: "time" | "type" | "period" | "shoe". */
  const GROUPS = {
    time: { a: "Pagi (sebelum 10:00)", b: "Sore/malam (setelah 15:00)", of: l => { const t = startTime(l); return t === null ? "?" : t < 600 ? "a" : t >= 900 ? "b" : "-"; }, missing: "jam mulai tidak tercatat" },
    type: { a: "Easy / recovery", b: "Long run", of: l => ["easy", "recovery"].includes(l.type) ? "a" : l.type === "long" ? "b" : "-" },
    period: { a: "Paruh awal periode", b: "Paruh akhir periode", of: null },
    shoe: { a: "Sepatu A", b: "Sepatu B", of: null }
  };
  function compare(state, w, opts = {}, now = new Date().toISOString()) {
    const by = GROUPS[opts.by] ? opts.by : "type", G0 = GROUPS[by], { runs, excluded } = select(state, w), minN = opts.minN || 3;
    const mid = w.from ? addDays(w.from, Math.floor((parse(w.to) - parse(w.from)) / DAY / 2)) : null;
    const groupOf = l => by === "period" ? (mid ? (l.date <= mid ? "a" : "b") : "-") : by === "shoe" ? (l.shoeId && l.shoeId === opts.shoeA ? "a" : l.shoeId && l.shoeId === opts.shoeB ? "b" : "-") : G0.of(l);
    const A = [], B = [];
    for (const l of runs) {
      const g = groupOf(l);
      if (g === "?") { excluded.push({ id: l.id, reason: G0.missing }); continue; }
      if (g === "-") { excluded.push({ id: l.id, reason: "di luar kedua kelompok" }); continue; }
      if (!(l.duration > 0)) { excluded.push({ id: l.id, reason: "durasi tidak tercatat" }); continue; }
      const p = paceOf(l); if (p < PACE_MIN || p > PACE_MAX) { excluded.push({ id: l.id, reason: "pace tidak wajar, perlu dicek" }); continue; }
      if (opts.matchKm && (l.distance < opts.matchKm[0] || l.distance > opts.matchKm[1])) { excluded.push({ id: l.id, reason: "jarak di luar rentang pencocokan" }); continue; }
      (g === "a" ? A : B).push({ id: l.id, date: l.date, pace: Math.round(p), km: l.distance, rpe: l.rpe || null });
    }
    const s = arr => arr.length ? { n: arr.length, median: Math.round(median(arr.map(x => x.pace))), q1: Math.round(quantile(arr.map(x => x.pace), .25)), q3: Math.round(quantile(arr.map(x => x.pace), .75)), medianKm: r1(median(arr.map(x => x.km))) } : { n: 0 };
    const sa = s(A), sb = s(B), ok = sa.n >= minN && sb.n >= minN;
    const labels = by === "shoe" ? { a: opts.shoeAName || G0.a, b: opts.shoeBName || G0.b } : { a: G0.a, b: G0.b };
    return Object.assign(base("compare", V.compare, w, now), {
      includedRecordIds: A.concat(B).map(x => x.id), excluded, n: A.length + B.length,
      metrics: { by, labels, a: sa, b: sb, diff: ok ? sb.median - sa.median : null, distanceGap: ok ? r1(sb.medianKm - sa.medianKm) : null },
      units: { pace: "detik per km", km: "km" },
      method: `Dua kelompok: “${labels.a}” vs “${labels.b}”. Hanya lari dengan durasi tercatat${opts.matchKm ? `, jarak ${opts.matchKm[0]}–${opts.matchKm[1]} km` : ""}. Dibandingkan median pace dan IQR. Minimal ${minN} lari per kelompok.`,
      assumptions: by === "time" ? ["Jam mulai hanya dari file import (lari manual tidak punya jam mulai)."] : [],
      limitations: ["Kelompok bisa berbeda jarak, rute, cuaca, dan effort.", "Selisih bukan bukti sebab-akibat."],
      missingFields: excluded.some(e => e.reason === GROUPS.time.missing) ? ["jam mulai"] : [],
      adequacy: ok ? (sa.n >= 6 && sb.n >= 6 ? "adequate" : "limited") : "insufficient",
      series: { a: A, b: B }
    });
  }

  /** D. Data quality: coverage per field with provenance, plus implausible-value and duplicate flags (review only). */
  function quality(state, w, now = new Date().toISOString()) {
    const { runs, excluded } = select(state, w), n = runs.length;
    const src = l => l.src ? (/strava/i.test(l.src) ? "import Strava (CSV)" : /health connect/i.test(l.src) ? "Health Connect" : l.src === "cepat" ? "✓ Selesai (jarak rencana)" : "file import") : "input manual";
    const F = [
      ["distance", "Jarak", l => l.distance > 0, "dicatat / diimport"],
      ["duration", "Durasi", l => l.duration > 0, "dicatat / diimport"],
      ["pace", "Pace", l => l.distance > 0 && l.duration > 0, "dihitung (durasi ÷ jarak)"],
      ["hr", "Detak jantung", l => l.hrAvg > 0, "dari perangkat (file) atau manual"],
      ["elev", "Elevasi naik", l => l.elev !== null && l.elev !== undefined && l.elev >= 0, "dari file atau manual"],
      ["rpe", "Rasa berat (RPE)", l => l.rpe >= 1, "dilaporkan sendiri"],
      ["shoe", "Sepatu", l => !!l.shoeId, "dipilih sendiri"],
      ["weather", "Cuaca (teks)", l => !!(l.weather && String(l.weather).trim()), "catatan sendiri, bukan pengukuran"],
      ["start", "Jam mulai", l => startTime(l) !== null, "dari file import"],
      ["cadence", "Kadens", () => false, "tidak disimpan aplikasi ini"]
    ];
    const coverage = F.map(([k, l, has, prov]) => ({ k, label: l, n: runs.filter(has).length, total: n, provenance: prov }));
    const flags = [];
    for (const l of runs) {
      const p = paceOf(l);
      if (p !== null && (p < PACE_MIN || p > PACE_MAX)) flags.push({ id: l.id, field: "pace", note: "pace di luar 2:30–20:00 /km" });
      if (l.distance > 100) flags.push({ id: l.id, field: "distance", note: "jarak di atas 100 km" });
      if (l.duration > 12 * 3600) flags.push({ id: l.id, field: "duration", note: "durasi di atas 12 jam" });
      if (l.hrAvg && (l.hrAvg < 60 || l.hrAvg > 220)) flags.push({ id: l.id, field: "hr", note: "HR rata-rata di luar 60–220" });
      if (l.elev > 3000) flags.push({ id: l.id, field: "elev", note: "elevasi naik di atas 3000 m" });
      if (l.src === "cepat" && !(l.duration > 0)) flags.push({ id: l.id, field: "distance", note: "jarak dari rencana (✓ Selesai), belum dikonfirmasi" });
    }
    for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i], b = runs[j];
      if (a.date === b.date && Math.abs(a.distance - b.distance) <= Math.max(0.1, 0.01 * a.distance)) flags.push({ id: b.id, field: "duplicate", note: `mungkin duplikat dari lari lain di tanggal yang sama (${a.id})` });
    }
    const sources = {}; runs.forEach(l => { const k = src(l); sources[k] = (sources[k] || 0) + 1; });
    const latest = runs.length ? runs.map(l => l.date).sort().pop() : null, earliest = runs.length ? runs.map(l => l.date).sort()[0] : null;
    return Object.assign(base("quality", V.quality, w, now), {
      includedRecordIds: runs.map(l => l.id), excluded, n,
      metrics: { coverage, flags, sources, latest, earliest, checkins: (state.checkins || []).filter(c => !c.sample && (!w.from || c.date >= w.from) && c.date <= w.to).length },
      units: {}, method: "Menghitung berapa lari yang punya tiap jenis data, asal datanya, dan menandai nilai yang tidak wajar untuk dicek. Tidak ada nilai yang diubah atau dihapus.",
      assumptions: [], limitations: ["Tanda hanya saran untuk dicek; nilainya bisa saja benar."],
      missingFields: coverage.filter(c => c.n === 0).map(c => c.label),
      adequacy: n >= 5 ? "adequate" : n ? "limited" : "insufficient",
      series: coverage
    });
  }

  /** Which analyses answer which investigation type, with options derived from the answers. */
  function plan(inv) {
    const a = k => inv.answers && inv.answers[k] && inv.answers[k].state === "answered" ? inv.answers[k].v : null;
    const runs = a("runs");
    const types = runs === "easy" ? ["easy", "recovery"] : runs === "long" ? ["long"] : null;
    switch (inv.type) {
      case "performance": return [["trend", { types }], ["quality", {}]];
      case "consistency": return [["weekly", {}], ["quality", {}]];
      case "comparison": { const g = a("groups"); return [["compare", { by: g || "type" }], ["quality", {}]]; }
      case "environment": { const f = a("factor"); return f === "time" ? [["compare", { by: "time" }], ["quality", {}]] : f === "elev" ? [["trend", {}], ["quality", {}]] : [["quality", {}]]; }
      case "equipment": return [["compare", { by: "shoe", shoeA: a("shoeA"), shoeB: a("shoeB") }], ["quality", {}]];
      default: return [["weekly", {}], ["quality", {}]];
    }
  }
  function run(id, state, w, opts, now) {
    return id === "weekly" ? weekly(state, w, now) : id === "trend" ? trend(state, w, opts, now) : id === "compare" ? compare(state, w, opts, now) : quality(state, w, now);
  }
  /** Bounded snapshot for saving into an investigation (exact record ids, method version, metrics). */
  function snapshot(r) {
    const m = JSON.parse(JSON.stringify(r.metrics));
    if (m.flags) m.flags = m.flags.slice(0, 30);
    return { analysisId: r.analysisId, methodVersion: r.methodVersion, createdAt: r.createdAt, window: r.window, n: r.n, adequacy: r.adequacy, includedRecordIds: r.includedRecordIds.slice(0, 400), excludedCount: r.excluded.length, metrics: m };
  }
  const fmtPace = s => s === null || s === undefined ? "–" : `${Math.floor(s / 60)}:${p2(Math.round(s % 60))}`;

  G.WRI_ANALYSIS = { V, BANDS, PACE_MIN, PACE_MAX, weekly, trend, compare, quality, plan, run, snapshot, median, quantile, monday, addDays, fmtPace, startTime };
})(typeof globalThis !== "undefined" ? globalThis : this);
