/* WeRunIt race-day intelligence (pure logic; imported by Node tests). Exposes globalThis.WRI_RACE.
 *
 * Honesty rules built in:
 *  - only genuine records (no sample data), outliers and duplicates excluded, every input listed;
 *  - every prediction reports method, data used, confidence, assumptions and limitations;
 *  - no physiology is invented: hydration/fuel/HR outputs need the user's own numbers, otherwise they
 *    return qualitative guidance and say what is missing;
 *  - every pacing strategy is normalised so the splits add up exactly to the target time.
 */
(function (G) {
  "use strict";
  const sum = a => a.reduce((x, y) => x + y, 0);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const DAY = 864e5;

  /** Pick usable performances from the run log. Returns {used, excluded:[{log, reason}]}. */
  function selectData(logs, { now = new Date(), days = 120 } = {}) {
    const from = new Date(now.getTime() - days * DAY).toISOString().slice(0, 10), out = [], excluded = [];
    const seen = new Set();
    for (const l of logs) {
      if (l.sample) { excluded.push({ log: l, reason: "contoh data" }); continue; }
      if (!l.duration || !l.distance) { excluded.push({ log: l, reason: "tanpa waktu" }); continue; }
      if (l.distance < 3) { excluded.push({ log: l, reason: "kurang dari 3 km" }); continue; }
      if (l.date < from) { excluded.push({ log: l, reason: `lebih lama dari ${days} hari` }); continue; }
      const key = l.date + "|" + Math.round(l.distance * 10);
      if (seen.has(key)) { excluded.push({ log: l, reason: "duplikat" }); continue; }
      seen.add(key); out.push(l);
    }
    // outliers: pace far faster than the runner's typical pace (GPS glitch, wrong distance, bike ride)
    const paces = out.map(l => l.duration / l.distance).sort((a, b) => a - b);
    if (paces.length >= 5) {
      const q1 = paces[Math.floor(paces.length * 0.25)], q3 = paces[Math.floor(paces.length * 0.75)], lo = q1 - 1.5 * (q3 - q1);
      for (const l of [...out]) if (l.duration / l.distance < lo) { out.splice(out.indexOf(l), 1); excluded.push({ log: l, reason: "pace tidak wajar (outlier)" }); }
    }
    return { used: out, excluded };
  }

  const riegel = (t1, d1, d2, exp = 1.06) => t1 * Math.pow(d2 / d1, exp);
  const EFFORT_TYPES = new Set(["benchmark", "race", "locked"]);

  /**
   * Transparent finish-time estimate for distance D (km).
   * opts: {exp=1.06, now, targetSec, recent:[{km, sec, date, label}] (user-entered race results)}
   */
  function predict(logs, D, opts = {}) {
    const exp = opts.exp || 1.06, now = opts.now || new Date();
    const sel = selectData(logs, { now });
    const entries = [
      ...sel.used.map(l => ({ id: l.id, date: l.date, km: l.distance, sec: l.duration, effort: EFFORT_TYPES.has(l.type), label: l.type })),
      ...(opts.recent || []).filter(r => r && r.km > 0 && r.sec > 0).map(r => ({ id: "manual:" + r.km, date: r.date || now.toISOString().slice(0, 10), km: r.km, sec: r.sec, effort: true, label: r.label || "hasil race" }))
    ];
    // Only efforts tell you race potential; easy runs are deliberately slow. Long easy runs only inform endurance.
    const cands = entries.filter(e => e.effort);
    const longest = entries.reduce((m, e) => Math.max(m, e.km), 0);
    const limitations = ["Rumus Riegel cuma perkiraan; panas, tanjakan, dan hari H bikin hasil beda.", "Easy run nggak dipakai buat prediksi karena memang sengaja pelan."];
    if (!cands.length) {
      return { seconds: opts.targetSec || null, source: opts.targetSec ? "target" : "none", confidence: "none", used: [], method: "Belum ada sesi usaha (benchmark, race, atau locked-in dengan waktu).",
        assumptions: opts.targetSec ? ["Pakai target waktumu karena belum ada data usaha."] : [], limitations: limitations.concat(["Catat benchmark atau race supaya ada perkiraan."]), excluded: sel.excluded, longest };
    }
    const scored = cands.map(e => {
      const est = riegel(e.sec, e.km, D, exp), ageDays = (now - new Date(e.date)) / DAY;
      const ratio = Math.max(e.km / D, D / e.km);
      const w = Math.exp(-ageDays / 45) / Math.pow(ratio, 1.5);      // recent + similar distance weigh more
      return Object.assign({}, e, { estimate: est, weight: w, ratio });
    });
    const W = sum(scored.map(s => s.weight)), est = sum(scored.map(s => s.estimate * s.weight)) / W;
    const spread = Math.sqrt(sum(scored.map(s => s.weight * (s.estimate - est) ** 2)) / W) / est;
    const near = scored.filter(s => s.ratio <= 2.5 && (now - new Date(s.date)) / DAY <= 60);
    let confidence = near.length >= 2 && spread < 0.05 ? "high" : near.length >= 1 ? "medium" : "low";
    const assumptions = [`Eksponen Riegel ${exp} (umumnya 1,06; dicoba 1,04–1,08 di bawah).`, "Usaha di data = usaha maksimal yang bisa dipertahankan untuk jarak itu."];
    if (longest < D * 0.7) { confidence = confidence === "high" ? "medium" : "low"; limitations.push(`Lari terjauhmu baru ${Math.round(longest * 10) / 10} km. Prediksi untuk ${Math.round(D * 10) / 10} km lebih tidak pasti sebelum long run lebih panjang.`); }
    const sens = [1.04, 1.08].map(x => sum(scored.map(s => riegel(s.sec, s.km, D, x) * s.weight)) / W);
    return { seconds: est, source: "data", confidence, spread, used: scored.sort((a, b) => b.weight - a.weight), method: `Rata-rata berbobot perkiraan Riegel (T₂ = T₁ × (D₂/D₁)^${exp}) dari ${scored.length} sesi usaha; bobot lebih besar untuk sesi baru dan jarak yang mirip.`,
      sensitivity: { low: Math.min(...sens), high: Math.max(...sens) }, assumptions, limitations, excluded: sel.excluded, longest };
  }

  /* ---------------- pacing ---------------- */
  const STRATS = {
    even: "Pace rata", conservative: "Mulai pelan", negative: "Negative split", positive: "Positive split terkontrol", elevation: "Sesuai tanjakan", custom: "Atur sendiri"
  };
  /** Segment lengths for distance D: 1 km pieces, the last one fractional. */
  function segments(D) { const n = Math.ceil(D - 1e-9), out = []; for (let i = 0; i < n; i++) out.push(i < n - 1 ? 1 : Math.round((D - (n - 1)) * 10000) / 10000); return out; }
  /** Scale per-segment raw pace weights so total time equals T exactly. */
  function normalise(raw, segs, T) { const t = sum(raw.map((p, i) => p * segs[i])); return raw.map(p => p * T / t); }
  /**
   * Per-km target paces (s/km) for strategy `kind`, summing exactly to targetSec.
   * opts: {elev:[gain per segment in m], custom:[pace per segment], startDelta (s/km, conservative/negative)}
   */
  function strategy(kind, targetSec, D, opts = {}) {
    const segs = segments(D), base = targetSec / D, n = segs.length;
    let raw;
    if (kind === "conservative") {
      // like the v3 race plan: the first 5 km are exactly `d` s/km slower, the rest is solved to hit the target
      const d = opts.startDelta ?? 15, k = Math.min(5, n - 1), firstKm = sum(segs.slice(0, k)), restKm = sum(segs.slice(k));
      const first = base + d, rest = (targetSec - first * firstKm) / restKm;
      return segs.map((_, i) => i < k ? first : rest);
    }
    else if (kind === "negative") { const d = (opts.splitPct ?? 2) / 100; raw = segs.map((_, i) => (i + 0.5) / n < 0.5 ? base * (1 + d) : base * (1 - d)); }
    else if (kind === "positive") { const d = (opts.splitPct ?? 1.5) / 100; raw = segs.map((_, i) => (i + 0.5) / n < 0.5 ? base * (1 - d) : base * (1 + d)); }
    else if (kind === "elevation" && Array.isArray(opts.elev) && opts.elev.length === n) {
      // equal-effort heuristic: ~6 s per 10 m net climb per km uphill, ~3 s back per 10 m descent (approximation, labelled)
      raw = segs.map((s, i) => base + (opts.elev[i] >= 0 ? 0.6 : 0.3) * opts.elev[i] / s);
    }
    else if (kind === "custom" && Array.isArray(opts.custom) && opts.custom.length === n) raw = opts.custom.slice();
    else raw = segs.map(() => base);
    return normalise(raw, segs, targetSec);
  }
  /**
   * Edit one split and rebalance the remaining (unlocked, later) splits so the total stays the target.
   * Earlier splits are kept as they are (already run or deliberately set).
   */
  function editSplit(paces, D, idx, newPace, locked = []) {
    const segs = segments(D), T = sum(paces.map((p, i) => p * segs[i])), out = paces.slice();
    out[idx] = newPace;
    const fixed = new Set([...locked, idx]), adj = out.map((_, i) => i > idx && !fixed.has(i) ? i : -1).filter(i => i >= 0);
    if (!adj.length) return { paces: out, total: sum(out.map((p, i) => p * segs[i])), balanced: false };
    const fixedT = sum(out.map((p, i) => adj.includes(i) ? 0 : p * segs[i])), adjT = sum(adj.map(i => out[i] * segs[i]));
    const k = (T - fixedT) / adjT;
    if (!(k > 0.5 && k < 1.5)) return { paces: out, total: sum(out.map((p, i) => p * segs[i])), balanced: false, warning: "Perubahan terlalu besar untuk diseimbangkan di sisa jarak." };
    adj.forEach(i => { out[i] *= k; });
    return { paces: out, total: T, balanced: true };
  }
  /** Rows for the split table: km mark, pace, cumulative, remaining km, 5K checkpoint flag. */
  function splitRows(paces, D) {
    const segs = segments(D); let cum = 0, km = 0;
    return segs.map((s, i) => { cum += paces[i] * s; km += s; return { i, km: Math.round(km * 1000) / 1000, pace: paces[i], cum, remaining: Math.max(0, Math.round((D - km) * 1000) / 1000), five: Math.abs(km % 5) < 1e-6 || i === segs.length - 1 }; });
  }
  /** Elevation gain per 1 km segment from a course profile [[km, ele], ...] (measured course data only). */
  function elevPerSegment(points, D) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const segs = segments(D), out = segs.map(() => 0);
    for (let i = 1; i < points.length; i++) { const k = Math.min(segs.length - 1, Math.floor(points[i][0])); out[k] += points[i][1] - points[i - 1][1]; }
    return out.map(x => Math.round(x));
  }

  /* ---------------- hydration ---------------- */
  /**
   * opts: {durationSec, sweatRateLph (measured), stations:[{km, verified}], paces, D, tempC, humidity}
   * Only gives a litre range when the runner supplied a measured sweat rate; never above 0.8 L/h.
   */
  function hydration(opts) {
    const hrs = opts.durationSec / 3600, notes = [], out = { checkpoints: [], perHour: null, total: null, notes };
    if (opts.sweatRateLph > 0) {
      const lo = clamp(opts.sweatRateLph * 0.5, 0.3, 0.8), hi = clamp(opts.sweatRateLph * 0.8, 0.35, 0.8);
      out.perHour = [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100];
      out.total = [Math.round(lo * hrs * 100) / 100, Math.round(hi * hrs * 100) / 100];
      notes.push("Rentang dari sweat rate yang kamu ukur: ganti sebagian keringat, jangan semuanya. Maksimal 0,8 L/jam.");
    } else notes.push("Belum ada sweat rate, jadi nggak ada angka liter. Minum sesuai haus dan sesuai yang udah kamu latih saat long run. Bisa ukur sweat rate: timbang sebelum & sesudah lari 1 jam.");
    if (opts.tempC >= 28 || (opts.tempC >= 25 && opts.humidity >= 70)) notes.push("Cuaca panas/lembap: kebutuhan cairan biasanya naik, pace juga perlu diturunkan.");
    notes.push("Jangan minum jauh melebihi haus: terlalu banyak air juga berbahaya (hiponatremia).");
    if (opts.paces && opts.D) {
      const rows = splitRows(opts.paces, opts.D);
      for (const st of opts.stations || []) {
        const r = rows.find(x => x.km >= st.km - 1e-6) || rows[rows.length - 1];
        const t = r.cum - r.pace * (r.km - st.km);
        out.checkpoints.push({ km: st.km, at: t, verified: !!st.verified, label: st.label || "", sip: out.perHour ? `${Math.round(out.perHour[0] * 1000 * 0.25)}–${Math.round(out.perHour[1] * 1000 * 0.25)} ml` : "beberapa teguk" });
      }
    }
    return out;
  }

  /* ---------------- fuel & energy ---------------- */
  /** opts: {durationSec, carbsPerServing (g, from the product label), massKg, D, gph (target g/h, optional)} */
  function fuel(opts) {
    const mins = opts.durationSec / 60, notes = [], out = { gph: null, servings: 0, schedule: [], energy: null, notes };
    if (mins < 60) { notes.push("Di bawah 60 menit biasanya nggak perlu makan saat race; sarapan yang biasa udah cukup."); out.gph = [0, 0]; }
    else { out.gph = mins <= 150 ? [30, 60] : [60, 90]; notes.push(`Panduan umum untuk durasi ini: ${out.gph[0]}–${out.gph[1]} g karbohidrat per jam, kalau perutmu udah terbiasa.`); }
    const target = opts.gph || (out.gph ? out.gph[0] : 0);
    if (target > 0 && opts.carbsPerServing > 0) {
      const fuelMins = Math.max(0, mins - 30), total = target * fuelMins / 60;
      out.servings = Math.max(1, Math.round(total / opts.carbsPerServing));
      const every = fuelMins / out.servings;
      for (let i = 0; i < out.servings; i++) out.schedule.push({ min: Math.round(30 + every * (i + 0.5)), grams: opts.carbsPerServing });
      notes.push(`Berdasarkan ${opts.carbsPerServing} g karbohidrat per sajian (dari label produkmu).`);
    } else if (target > 0) notes.push("Isi gram karbohidrat per sajian dari label produkmu supaya jumlah dan jadwalnya bisa dihitung.");
    if (opts.massKg > 0 && opts.D > 0) out.energy = [Math.round(0.9 * opts.massKg * opts.D), Math.round(1.1 * opts.massKg * opts.D)];
    notes.push("Latih strategi makan ini saat long run. Jangan coba produk baru di hari race.");
    if (out.energy) notes.push("Energi = perkiraan kasar ~0,9–1,1 kkal per kg per km, bukan pengukuran.");
    return out;
  }

  /* ---------------- heart rate ---------------- */
  /** Zones only from a user-confirmed HRmax. history: logs with real hrAvg values. */
  function hrGuidance({ hrMax, history = [], D, tempC }) {
    if (!(hrMax >= 120 && hrMax <= 230)) return { configured: false, notes: ["Isi HR maksimal yang benar-benar pernah kamu ukur supaya zona bisa dihitung. Rumus umur nggak dipakai karena sering meleset."] };
    const z = [[0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1]].map(([a, b]) => [Math.round(a * hrMax), Math.round(b * hrMax)]);
    const race = D <= 10.5 ? [0.88, 0.95] : D <= 22.5 ? [0.83, 0.9] : [0.75, 0.84];
    const notes = ["Ini panduan effort, bukan penilaian medis. Kalau pusing, nyeri dada, atau sesak tidak biasa: berhenti."];
    if (tempC >= 27) notes.push("Saat panas, detak jantung naik di pace yang sama (cardiac drift). Patokan effort, jangan paksa pace.");
    const real = history.filter(l => l.hrAvg && !l.sample);
    return { configured: true, zones: z, raceRange: race.map(f => Math.round(f * hrMax)), history: real.map(l => ({ date: l.date, hrAvg: l.hrAvg, hrMax: l.hrMax || null, pace: l.duration && l.distance ? l.duration / l.distance : null })), notes };
  }

  G.WRI_RACE = { selectData, riegel, predict, STRATS, segments, strategy, editSplit, splitRows, elevPerSegment, hydration, fuel, hrGuidance };
})(typeof globalThis !== "undefined" ? globalThis : this);
