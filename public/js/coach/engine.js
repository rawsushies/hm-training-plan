/* WeRunIt coach engine (pure, deterministic; no DOM, no network, no AI). Exposes globalThis.WRI_COACH.
 * assess(sessions, opts) → { window, n, coverage, observations[], unanswerable[], key }
 * Every observation keeps three layers apart:
 *   fact (what was measured) · interpretation (what it may mean, never causal) · recommendation (one change + what to watch)
 * and carries measures, window, n, coverage and confidence. A dimension with too little data returns kind "insufficient"
 * with what is missing; it never guesses. No readiness score, no safety labels, no injury prediction.
 * Method version: coach-1. Definitions: docs/COACH_METHOD.md.
 */
(function (G) {
  "use strict";
  const VERSION = "coach-1", DAY = 864e5;
  const p2 = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const monday = s => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  const r1 = v => Math.round(v * 10) / 10;
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  const km = v => r1(v).toString().replace(".", ",");
  const pace = s => s === null ? "–" : `${Math.floor(s / 60)}:${p2(Math.round(s % 60))}`;
  const BANDS = [[3, 6, "3–6 km"], [6, 10, "6–10 km"], [10, 16, "10–16 km"], [16, 22, "16–22 km"], [22, 60, "22+ km"]];
  const conf = (n, cov) => n >= 12 && cov >= .8 ? "tinggi" : n >= 6 && cov >= .5 ? "sedang" : "rendah";

  /** Deterministic permutation test on the difference of medians (same as the analysis engine; seeded from the data). */
  function permP(a, b, it = 2000) {
    const all = a.concat(b), obs = Math.abs(median(a) - median(b));
    let seed = all.reduce((h, v) => (h * 31 + Math.round(v)) >>> 0, 7) || 1, hit = 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let k = 0; k < it; k++) { const s = all.slice(); for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; } if (Math.abs(median(s.slice(0, a.length)) - median(s.slice(a.length))) >= obs - 1e-9) hit++; }
    return (hit + 1) / (it + 1);
  }

  function obs(o) { return Object.assign({ kind: "neutral", measures: [], confidence: "rendah", interpretation: "", recommendation: "", monitor: "" }, o); }
  const insufficient = (dim, title, missing, w, n) => obs({ id: dim, dim, kind: "insufficient", title, fact: missing, window: w, n, confidence: "rendah", interpretation: "", recommendation: "", monitor: "" });

  /* ---------- dimensions ---------- */
  function consistency(S, w) {
    const weeks = [];
    for (let i = 0; i < 8; i++) { const a = addDays(monday(w.to), -7 * (7 - i)), b = addDays(a, 6); const ss = S.filter(s => s.date >= a && s.date <= b); weeks.push({ start: a, runs: ss.length, km: r1(sum(ss, s => s.distanceKm || 0)) }); }
    const active = weeks.filter(x => x.runs).length, n = S.length;
    if (n < 4) return insufficient("consistency", "Konsistensi", `Baru ${n} lari dalam 8 minggu; butuh minimal 4 untuk menilai pola.`, w, n);
    let gap = 0; const ds = S.map(s => s.date); for (let i = 1; i < ds.length; i++) gap = Math.max(gap, diffDays(ds[i - 1], ds[i]));
    gap = Math.max(gap, diffDays(ds[ds.length - 1], w.to));
    const perWk = r1(n / 8);
    const kind = active >= 7 && perWk >= 3 ? "strength" : active <= 4 || gap >= 14 ? "limitation" : "neutral";
    return obs({ id: "consistency", dim: "consistency", kind, title: "Konsistensi",
      fact: `${active} dari 8 minggu ada lari; rata-rata ${km(perWk)} lari per minggu; jeda terpanjang ${gap} hari.`,
      interpretation: kind === "strength" ? "Frekuensi stabil memberi dasar yang baik untuk menambah beban secara bertahap." : kind === "limitation" ? "Minggu tanpa lari dan jeda panjang membuat adaptasi sulit menumpuk; ini sering lebih berpengaruh daripada isi sesinya." : "Frekuensi cukup teratur, dengan beberapa minggu lebih sepi.",
      recommendation: kind === "limitation" ? "Utamakan jumlah hari lari yang realistis tiap minggu (misal 3) sebelum menambah jarak." : kind === "strength" ? "Pertahankan frekuensi ini; perubahan berikutnya cukup satu variabel." : "Coba kunci hari lari tetap supaya minggu sepi berkurang.",
      monitor: "Jumlah minggu yang ada lari, dalam 4 minggu ke depan.",
      measures: [{ label: "Minggu aktif", value: `${active}/8` }, { label: "Lari/minggu", value: km(perWk) }, { label: "Jeda terpanjang", value: `${gap} hari` }],
      window: w, n, coverage: { have: n, total: n, field: "tanggal" }, confidence: conf(n, 1), series: weeks.map(x => ({ label: x.start, v: x.runs })) });
  }

  function volume(S, w) {
    const mid = addDays(w.to, -27), early = S.filter(s => s.date < mid && s.distanceKm), late = S.filter(s => s.date >= mid && s.distanceKm);
    if (early.length < 3 || late.length < 3) return insufficient("volume", "Tren volume", `Butuh minimal 3 lari berjarak di tiap 4 minggu (sekarang ${early.length} lalu ${late.length}).`, w, early.length + late.length);
    const a = sum(early, s => s.distanceKm), b = sum(late, s => s.distanceKm), ch = Math.round((b - a) / a * 100);
    const kind = ch >= 30 ? "opportunity" : ch <= -30 ? "limitation" : "neutral";
    return obs({ id: "volume", dim: "volume", kind, title: "Tren volume",
      fact: `4 minggu terakhir ${km(b)} km (${late.length} lari) vs 4 minggu sebelumnya ${km(a)} km (${early.length} lari): ${ch > 0 ? "+" : ""}${ch}%.`,
      interpretation: kind === "opportunity" ? "Volume naik cepat. Kenaikan besar dalam waktu singkat sering lebih sulit diserap; ini bukan prediksi cedera." : kind === "limitation" ? "Volume turun banyak. Bisa karena istirahat yang disengaja, sakit, atau sibuk; data tidak menunjukkan sebabnya." : "Volume relatif stabil.",
      recommendation: kind === "opportunity" ? "Tahan volume di level sekarang 1–2 minggu sebelum menambah lagi." : kind === "limitation" ? "Kalau turunnya tidak disengaja, kembali bertahap dari sekitar volume sekarang, bukan langsung ke level lama." : "Kalau mau naik, tambah sedikit dan satu hal saja (jarak atau frekuensi).",
      monitor: "Total km per minggu dan rasa berat (RPE) di lari santai.",
      measures: [{ label: "4 mgg terakhir", value: `${km(b)} km` }, { label: "4 mgg sebelumnya", value: `${km(a)} km` }, { label: "Perubahan", value: `${ch > 0 ? "+" : ""}${ch}%` }],
      window: w, n: early.length + late.length, coverage: { have: early.length + late.length, total: S.length, field: "jarak" }, confidence: conf(early.length + late.length, (early.length + late.length) / Math.max(1, S.length)) });
  }

  function longRun(S, w) {
    const withKm = S.filter(s => s.distanceKm);
    if (withKm.length < 6) return insufficient("longrun", "Long run", `Butuh minimal 6 lari berjarak (sekarang ${withKm.length}).`, w, withKm.length);
    const med = median(withKm.map(s => s.distanceKm)), thr = Math.max(8, med * 1.5);
    const longs = withKm.filter(s => s.distanceKm >= thr), mid = addDays(w.to, -27);
    const wk = new Set(longs.map(s => monday(s.date))).size;
    const maxE = Math.max(0, ...longs.filter(s => s.date < mid).map(s => s.distanceKm)), maxL = Math.max(0, ...longs.filter(s => s.date >= mid).map(s => s.distanceKm));
    const kind = wk >= 5 ? "strength" : wk <= 2 ? "opportunity" : "neutral";
    return obs({ id: "longrun", dim: "longrun", kind, title: "Long run",
      fact: `${longs.length} lari ≥ ${km(thr)} km (1,5× median ${km(med)} km, minimal 8 km) di ${wk} dari 8 minggu. Terpanjang: ${maxE ? km(maxE) : "–"} km (4 mgg sebelumnya) → ${maxL ? km(maxL) : "–"} km (4 mgg terakhir).`,
      interpretation: kind === "opportunity" ? "Lari panjang jarang muncul. Untuk tujuan 10K ke atas, lari panjang rutin biasanya jadi tulang punggung daya tahan." : kind === "strength" ? "Lari panjang rutin hampir tiap minggu." : "Lari panjang ada, tapi belum rutin.",
      recommendation: kind === "opportunity" ? "Jadwalkan satu lari panjang santai per minggu, mulai dari jarak terpanjangmu yang sekarang." : "Naikkan jarak lari panjang pelan-pelan, dengan minggu yang lebih ringan sesekali.",
      monitor: "Jarak lari panjang per minggu dan apakah pace santainya tetap nyaman.",
      measures: [{ label: "Batas long run", value: `${km(thr)} km` }, { label: "Minggu dengan long run", value: `${wk}/8` }, { label: "Terpanjang (4 mgg)", value: maxL ? `${km(maxL)} km` : "–" }],
      window: w, n: withKm.length, coverage: { have: withKm.length, total: S.length, field: "jarak" }, confidence: conf(withKm.length, withKm.length / S.length) });
  }

  function intensity(S, w, opts) {
    const rp = S.filter(s => s.rpe !== null), cov = S.length ? rp.length / S.length : 0;
    const hrOK = opts.hrMaxMeasured > 0, hr = hrOK ? S.filter(s => s.hrAvg) : [];
    if (rp.length >= 6 && cov >= .5) {
      const easy = rp.filter(s => s.rpe <= 4).length, mod = rp.filter(s => s.rpe >= 5 && s.rpe <= 6).length, hard = rp.filter(s => s.rpe >= 7).length, ep = Math.round(easy / rp.length * 100);
      const kind = ep < 60 ? "limitation" : ep >= 75 ? "strength" : "neutral";
      return obs({ id: "intensity", dim: "intensity", kind, title: "Distribusi intensitas",
        fact: `Dari ${rp.length} lari dengan RPE: santai (1–4) ${easy}, sedang (5–6) ${mod}, berat (7–10) ${hard}. Santai = ${ep}%.`,
        interpretation: kind === "limitation" ? "Sebagian besar lari terasa sedang atau berat. Lari santai yang terlalu keras bisa membuat sesi berat kurang berkualitas dan pemulihan lebih lama." : kind === "strength" ? "Mayoritas lari santai, dengan sedikit sesi berat: pola yang umum dipakai untuk membangun daya tahan." : "Campuran santai dan sedang cukup seimbang.",
        recommendation: kind === "limitation" ? "Buat lari santai benar-benar santai (bisa ngobrol, RPE 3–4), dan simpan effort tinggi untuk 1–2 sesi per minggu." : "Pertahankan; catat RPE di tiap lari supaya polanya tetap terbaca.",
        monitor: "Persentase lari dengan RPE ≤ 4 dalam 4 minggu ke depan.",
        measures: [{ label: "Santai", value: `${easy}` }, { label: "Sedang", value: `${mod}` }, { label: "Berat", value: `${hard}` }, { label: "RPE tercatat", value: `${rp.length}/${S.length}` }],
        window: w, n: rp.length, coverage: { have: rp.length, total: S.length, field: "RPE" }, confidence: conf(rp.length, cov), basis: "RPE",
        series: [{ label: "Santai", v: easy }, { label: "Sedang", v: mod }, { label: "Berat", v: hard }] });
    }
    return insufficient("intensity", "Distribusi intensitas", `RPE tercatat di ${rp.length} dari ${S.length} lari (butuh minimal 6 dan ≥ 50%).${hrOK ? "" : " Detak jantung tidak dipakai karena HR maks terukur belum diisi."}${hrOK && hr.length < 6 ? ` Detak jantung ada di ${hr.length} lari.` : ""}`, w, rp.length);
  }

  function paceTrend(S, w) {
    const runs = S.filter(s => s.paceSecPerKm && s.paceSecPerKm >= 150 && s.paceSecPerKm <= 1200 && s.distanceKm);
    let best = null;
    for (const [lo, hi, label] of BANDS) {
      const b = runs.filter(s => s.distanceKm >= lo && s.distanceKm < hi); if (b.length < 6) continue;
      const half = Math.floor(b.length / 2), e = b.slice(0, half), l = b.slice(half);
      if (!best || Math.min(e.length, l.length) > Math.min(best.e.length, best.l.length)) best = { label, e, l };
    }
    if (!best) return insufficient("pace", "Tren pace (jarak sebanding)", `Butuh minimal 6 lari dengan jarak dan waktu di satu rentang jarak yang sama (sekarang ${runs.length} lari dengan pace).`, w, runs.length);
    const me = median(best.e.map(s => s.paceSecPerKm)), ml = median(best.l.map(s => s.paceSecPerKm)), d = Math.round(me - ml), p = permP(best.e.map(s => s.paceSecPerKm), best.l.map(s => s.paceSecPerKm));
    const supported = p < .05 && Math.min(best.e.length, best.l.length) >= 6 && Math.abs(d) >= 5;
    const kind = supported ? (d > 0 ? "strength" : "limitation") : "neutral";
    const n = best.e.length + best.l.length;
    return obs({ id: "pace", dim: "pace", kind, title: "Tren pace (jarak sebanding)",
      fact: `Lari ${best.label}: median ${pace(me)} /km (paruh awal, ${best.e.length} lari) → ${pace(ml)} /km (paruh akhir, ${best.l.length} lari), ${d > 0 ? `${d} dtk/km lebih cepat` : d < 0 ? `${-d} dtk/km lebih lambat` : "sama"}. Uji permutasi p = ${p.toFixed(3)}.`,
      interpretation: supported ? `Perubahan ini cukup besar dan konsisten untuk tidak dianggap kebetulan, tapi bisa ikut dipengaruhi rute, cuaca, atau effort yang berbeda.` : "Perbedaannya bisa saja kebetulan (sampel kecil atau variasi rute/effort).",
      recommendation: supported && d > 0 ? "Tren membaik: pertahankan struktur latihan sekarang." : supported ? "Pace melambat di jarak sebanding: cek apakah volume, kelelahan, atau kondisi lari berubah sebelum menambah intensitas." : "Belum ada kesimpulan; catat effort (RPE) supaya perbandingan lebih adil.",
      monitor: "Median pace di rentang jarak ini, bersama RPE.",
      measures: [{ label: "Rentang", value: best.label }, { label: "Awal", value: `${pace(me)} /km` }, { label: "Akhir", value: `${pace(ml)} /km` }, { label: "p", value: p.toFixed(3) }],
      window: w, n, coverage: { have: runs.length, total: S.length, field: "pace" }, confidence: supported ? conf(n, runs.length / S.length) : "rendah",
      series: best.e.concat(best.l).map(s => ({ id: s.id, label: s.date, v: s.paceSecPerKm, late: best.l.includes(s) })) });
  }

  function recovery(S, w) {
    const rp = S.filter(s => s.rpe !== null);
    if (rp.length < 6) return insufficient("recovery", "Jarak antar sesi berat", `Butuh RPE di minimal 6 lari (sekarang ${rp.length}).`, w, rp.length);
    const hard = rp.filter(s => s.rpe >= 7); let back = 0; const pairs = [];
    for (let i = 1; i < hard.length; i++) if (diffDays(hard[i - 1].date, hard[i].date) <= 1) { back++; pairs.push(hard[i].date); }
    const kind = back >= 2 ? "limitation" : hard.length ? "neutral" : "neutral";
    return obs({ id: "recovery", dim: "recovery", kind, title: "Jarak antar sesi berat",
      fact: `${hard.length} sesi berat (RPE ≥ 7); ${back} kali sesi berat di hari berurutan.`,
      interpretation: back >= 2 ? "Sesi berat beruntun memberi waktu pemulihan yang sedikit; kualitas sesi berikutnya bisa turun." : "Sesi berat umumnya berjarak.",
      recommendation: back >= 2 ? "Beri minimal satu hari santai atau istirahat di antara sesi berat." : "Pertahankan jarak ini.",
      monitor: "Jumlah sesi berat beruntun per bulan.",
      measures: [{ label: "Sesi berat", value: String(hard.length) }, { label: "Beruntun", value: String(back) }],
      window: w, n: rp.length, coverage: { have: rp.length, total: S.length, field: "RPE" }, confidence: conf(rp.length, rp.length / S.length) });
  }

  function strength(St, w) {
    const inW = St.filter(r => r.date >= w.from && r.date <= w.to);
    if (!inW.length) return insufficient("strength", "Latihan kekuatan", "Tidak ada latihan kekuatan yang tercatat. Coach tidak tahu apakah kamu melakukannya, jadi tidak menilai ini.", w, 0);
    const perWk = r1(inW.length / 8);
    return obs({ id: "strength", dim: "strength", kind: perWk >= 1.5 ? "strength" : "opportunity", title: "Latihan kekuatan",
      fact: `${inW.length} sesi kekuatan tercatat dalam 8 minggu (${km(perWk)} per minggu).`,
      interpretation: perWk >= 1.5 ? "Latihan kekuatan rutin." : "Latihan kekuatan tercatat, tapi jarang.",
      recommendation: perWk >= 1.5 ? "Pertahankan." : "Kalau mau, tambahkan 2 sesi singkat per minggu (kaki satu-satu, posterior chain, core) di hari santai.",
      monitor: "Sesi kekuatan per minggu.", measures: [{ label: "Sesi", value: String(inW.length) }, { label: "Per minggu", value: km(perWk) }],
      window: w, n: inW.length, coverage: { have: inW.length, total: inW.length, field: "catatan kekuatan" }, confidence: conf(inW.length, 1) });
  }

  /** Questions the data cannot answer yet, with the reason. */
  function unanswerable(S, opts) {
    const out = [], n = S.length, hr = S.filter(s => s.hrAvg).length, el = S.filter(s => s.elevGainM !== null).length;
    if (!(opts.hrMaxMeasured > 0) || hr < 6) out.push({ q: "Hubungan pace dan detak jantung", why: !(opts.hrMaxMeasured > 0) ? "HR maks terukur belum diisi di profil." : `Detak jantung hanya ada di ${hr} dari ${n} lari.` });
    if (n && el / n < .5) out.push({ q: "Pengaruh tanjakan", why: `Elevasi hanya ada di ${el} dari ${n} lari.` });
    out.push({ q: "Tidur, pegal, dan pemulihan", why: "Tidak ada sumber data tidur/pemulihan yang tersambung; coach tidak menebaknya." });
    out.push({ q: "Cuaca saat lari", why: "Cuaca per lari tidak tercatat; prakiraan hanya dipakai untuk sesi berikutnya." });
    return out;
  }

  const RANK = { limitation: 0, opportunity: 1, strength: 2, neutral: 3, insufficient: 4 }, CR = { tinggi: 0, sedang: 1, rendah: 2 };
  /** Main entry. opts: {today:"YYYY-MM-DD", hrMaxMeasured:number|null, strength:[{date}]} */
  function assess(sessions, opts = {}) {
    const to = opts.today, from = addDays(monday(to), -49), w = { from, to };
    const S = (sessions || []).filter(s => s.date >= from && s.date <= to);
    const list = [consistency(S, w), volume(S, w), longRun(S, w), intensity(S, w, opts), paceTrend(S, w), recovery(S, w), strength(opts.strength || [], w)];
    const ranked = list.filter(o => o.kind !== "insufficient").sort((a, b) => RANK[a.kind] - RANK[b.kind] || CR[a.confidence] - CR[b.confidence]);
    return { version: VERSION, window: w, n: S.length, observations: list, key: ranked.find(o => o.kind !== "neutral") || ranked[0] || null, unanswerable: unanswerable(S, opts) };
  }

  /* ---------- Ask the coach: keyword routing to dimensions; answers built only from observations ---------- */
  const ROUTES = [
    ["pain", /nyeri|sakit|cedera|cidera|pain|injur|bengkak|kram/i],
    ["intensity", /santai|terlalu keras|easy|intensitas|terlalu cepat|zona|zone/i],
    ["longrun", /long ?run|lari panjang|jarak jauh/i],
    ["pace", /pace|cepat|lambat|membaik|improv|progres|stagn/i],
    ["volume", /volume|jarak|km|lebih banyak|tambah|naik/i],
    ["consistency", /konsisten|rutin|jarang|frekuensi|bolong/i],
    ["recovery", /pulih|recovery|istirahat|capek|lelah|fatigue/i],
    ["strength", /kekuatan|strength|gym|beban|core/i],
    ["hr", /detak|jantung|heart|hr\b/i],
    ["weakness", /kelemahan|lemah|weakness|paling perlu|fokus|ubah|4 minggu|empat minggu/i]
  ];
  function classify(q) { const t = String(q || ""); const hit = ROUTES.filter(([, re]) => re.test(t)).map(([k]) => k); return hit.length ? hit : ["weakness"]; }
  const SUGGEST = ["Apa kelemahan terbesarku sekarang?", "Apakah lari santaiku terlalu keras?", "Apakah long run-ku berkembang?", "Kenapa pace-ku tidak membaik padahal lari lebih banyak?", "Apa yang perlu kuubah 4 minggu ke depan?", "Apakah latihan kekuatanku cukup?"];
  function answer(q, A) {
    const dims = classify(q), byId = Object.fromEntries(A.observations.map(o => [o.id, o]));
    if (dims.includes("pain")) return { dims, direct: "Coach tidak bisa menilai nyeri atau cedera. Kalau nyeri menetap, makin parah, atau muncul tiba-tiba saat lari, berhenti dulu dan periksa ke dokter atau fisioterapis.", evidence: [], uncertainty: "Data lari tidak bisa menunjukkan penyebab nyeri.", actions: ["Kurangi atau hentikan lari yang memicu nyeri sampai diperiksa."], followups: ["Apa yang perlu kuubah 4 minggu ke depan?"], safety: true };
    if (dims.includes("hr")) { const u = A.unanswerable.find(x => /detak/i.test(x.q)); if (u) return { dims, direct: `Belum bisa dijawab: ${u.why}`, evidence: [], uncertainty: "Tanpa detak jantung yang andal, coach tidak menebak respons jantung.", actions: ["Isi HR maks terukur di Pengaturan, dan catat detak jantung rata-rata di lari berikutnya."], followups: SUGGEST.slice(0, 2) }; }
    let pick = dims.filter(d => byId[d]).map(d => byId[d]);
    if (dims.includes("weakness") || !pick.length) pick = [A.key].filter(Boolean);
    if (dims.includes("pace") && dims.includes("volume")) pick = [byId.pace, byId.volume, byId.intensity].filter(Boolean);
    const ok = pick.filter(o => o.kind !== "insufficient"), miss = pick.filter(o => o.kind === "insufficient");
    if (!ok.length) return { dims, direct: miss.length ? `Belum cukup data: ${miss.map(o => o.fact).join(" ")}` : "Belum cukup data untuk menjawab ini.", evidence: miss, uncertainty: "Coach tidak menebak saat data kurang.", actions: ["Catat jarak, waktu, dan effort (RPE) di setiap lari."], followups: SUGGEST.filter(s => s !== q).slice(0, 2) };
    const lead = ok[0];
    const direct = `${lead.title}: ${lead.interpretation || lead.fact}`;
    return { dims, direct, evidence: ok.concat(miss), uncertainty: `Keyakinan ${lead.confidence} (n = ${lead.n}, ${lead.window.from} – ${lead.window.to}). Ini pola dari catatanmu, bukan bukti sebab-akibat.`,
      actions: ok.map(o => o.recommendation).filter(Boolean).slice(0, 2), followups: SUGGEST.filter(s => s !== q).slice(0, 3) };
  }

  G.WRI_COACH = { VERSION, assess, classify, answer, SUGGEST, permP };
})(typeof globalThis !== "undefined" ? globalThis : this);
