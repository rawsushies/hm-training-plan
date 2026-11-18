/* RUNLAB core (pure, no DOM, no network). Exposes globalThis.WRI_LAB; imported by Node unit tests.
 * Milestone 1: classify a question (transparent keyword rules), ask one follow-up at a time (skip / unknown never
 * inferred), and define the analysis scope: window, included/excluded records with reasons, field coverage,
 * planned comparisons and confounders. No analysis results, research or AI are produced here yet.
 */
(function (G) {
  "use strict";
  const SCHEMA = 1, METHOD = "scope-1";
  const TYPES = {
    performance: { l: "Tren performa", d: "Apakah pace/durasi berubah di jarak yang sebanding" },
    consistency: { l: "Konsistensi latihan", d: "Frekuensi dan volume dari minggu ke minggu" },
    comparison: { l: "Perbandingan sesi", d: "Membandingkan dua kelompok lari yang mirip" },
    environment: { l: "Konteks lingkungan", d: "Cuaca, tanjakan, atau jam lari" },
    equipment: { l: "Perlengkapan", d: "Sepatu atau perlengkapan lain" },
    recovery: { l: "Observasi pemulihan", d: "Tidur, pegal, capek dari check-in (bukan diagnosis)" },
    experiment: { l: "Eksperimen pribadi", d: "Menguji satu perubahan secara terencana" }
  };
  // Transparent rules: the matched words are shown to the user. Order = priority when several types match.
  const RULES = [
    ["experiment", ["eksperimen", "experiment", "coba ganti", "uji", "test whether", "kalau aku ganti", "what if i"]],
    ["equipment", ["sepatu", "shoe", "shoes", "sneaker", "insole", "jam tangan", "watch", "carbon"]],
    ["environment", ["panas", "lembap", "lembab", "hujan", "cuaca", "suhu", "heat", "humid", "weather", "tanjakan", "elevasi", "elevation", "climb", "hill", "bukit", "pagi", "malam", "sore", "morning", "evening", "night"]],
    ["recovery", ["tidur", "sleep", "pegal", "sore", "capek", "lelah", "fatigue", "pulih", "recovery", "istirahat", "rest day"]],
    ["consistency", ["konsisten", "consistent", "frekuensi", "frequency", "seminggu", "per week", "volume", "mileage", "jarang", "bolong", "skip"]],
    ["comparison", ["bandingkan", "dibanding", "compare", "versus", " vs ", "beda", "lebih cepat mana", "which is"]],
    ["performance", ["pace", "cepat", "lambat", "improve", "membaik", "naik", "stuck", "mentok", "progress", "kemajuan", "faster", "slower", "efisien", "efficient", "cadence", "kadens"]]
  ];
  /** Classify a free-text question. Returns {type, matched}; "performance" when nothing matches (shown as a guess). */
  function classify(q) {
    const t = " " + String(q || "").toLowerCase() + " ", hits = [];
    for (const [type, words] of RULES) { const m = words.filter(w => t.includes(w)); if (m.length) hits.push({ type, matched: m }); }
    if (!hits.length) return { type: "performance", matched: [], guess: true };
    return { type: hits[0].type, matched: hits[0].matched.slice(0, 8), also: hits.slice(1).map(h => h.type) };
  }

  // ---------- follow-up questions (one at a time, each with a reason) ----------
  const WINDOW = { k: "window", q: "Periode mana yang mau dilihat?", why: "Menentukan lari mana yang masuk analisis.",
    opts: [{ v: 28, l: "4 minggu" }, { v: 56, l: "8 minggu" }, { v: 84, l: "12 minggu" }, { v: 0, l: "Semua data" }] };
  const Q = {
    performance: [WINDOW,
      { k: "meaning", q: "“Membaik” buat kamu artinya apa?", why: "Supaya yang diukur sesuai maksudmu.", opts: [{ v: "pace", l: "Pace lebih cepat di jarak sama" }, { v: "distance", l: "Lari lebih jauh dengan effort sama" }, { v: "effort", l: "Pace sama terasa lebih ringan" }, { v: "race", l: "Hasil race" }] },
      { k: "runs", q: "Lari jenis apa yang dibandingkan?", why: "Easy run dan sesi cepat tidak bisa dibandingkan langsung.", opts: [{ v: "easy", l: "Easy / santai saja" }, { v: "long", l: "Long run" }, { v: "all", l: "Semua lari" }] }],
    consistency: [WINDOW,
      { k: "focus", q: "Yang paling ingin kamu pahami?", why: "Frekuensi dan volume bisa bergerak berlawanan.", opts: [{ v: "freq", l: "Berapa kali lari per minggu" }, { v: "volume", l: "Total km per minggu" }, { v: "missed", l: "Sesi yang terlewat" }] }],
    comparison: [WINDOW,
      { k: "groups", q: "Dua kelompok apa yang dibandingkan?", why: "Perbandingan butuh dua kelompok yang jelas.", opts: [{ v: "time", l: "Pagi vs sore/malam" }, { v: "type", l: "Easy vs long run" }, { v: "period", l: "Bulan ini vs bulan lalu" }, { v: "shoe", l: "Sepatu A vs B" }] },
      { k: "match", q: "Lari dianggap “mirip” kalau…", why: "Aturan pencocokan menentukan perbandingan yang adil.", opts: [{ v: "distance", l: "Jaraknya mirip (±20%)" }, { v: "type", l: "Jenis sesinya sama" }, { v: "both", l: "Dua-duanya" }] }],
    environment: [WINDOW,
      { k: "factor", q: "Faktor apa yang kamu curigai?", why: "Tiap faktor butuh data berbeda.", opts: [{ v: "heat", l: "Panas / lembap" }, { v: "elev", l: "Tanjakan" }, { v: "time", l: "Jam lari (pagi vs malam)" }] },
      { k: "measure", q: "Kamu menilainya dari apa?", why: "Pace dan rasa capek bisa memberi jawaban berbeda.", opts: [{ v: "pace", l: "Pace" }, { v: "rpe", l: "Rasa berat (RPE)" }, { v: "hr", l: "Detak jantung" }] }],
    equipment: [WINDOW,
      { k: "shoeA", q: "Sepatu pertama?", why: "Perbandingan butuh dua sepatu yang jelas.", shoes: true },
      { k: "shoeB", q: "Dibandingkan dengan?", why: "Sepatu kedua untuk pembanding.", shoes: true },
      { k: "measure", q: "Yang kamu rasakan beda di mana?", why: "Menentukan ukuran yang dipakai.", opts: [{ v: "pace", l: "Pace" }, { v: "rpe", l: "Rasa berat (RPE)" }, { v: "comfort", l: "Nyaman / pegal setelahnya" }] }],
    recovery: [WINDOW,
      { k: "signal", q: "Sinyal mana yang ingin kamu amati?", why: "Diambil dari check-in harianmu; ini observasi, bukan diagnosis.", opts: [{ v: "sleep", l: "Tidur" }, { v: "soreness", l: "Pegal" }, { v: "fatigue", l: "Capek" }, { v: "energy", l: "Tenaga" }] },
      { k: "against", q: "Dibandingkan dengan apa?", why: "Pengamatan butuh pembanding.", opts: [{ v: "load", l: "Jarak/beban lari hari sebelumnya" }, { v: "long", l: "Hari setelah long run" }, { v: "trend", l: "Trennya saja" }] }],
    experiment: [
      { k: "variable", q: "Satu hal apa yang ingin kamu ubah?", why: "Eksperimen yang bisa dipercaya mengubah satu variabel saja.", text: true, ph: "misal: lari pagi, bukan malam" },
      { k: "outcome", q: "Hasil apa yang mau diamati?", why: "Ukuran hasil ditentukan sebelum mulai.", opts: [{ v: "pace", l: "Pace di easy run" }, { v: "rpe", l: "Rasa berat (RPE)" }, { v: "sleep", l: "Tidur setelahnya" }] },
      WINDOW]
  };
  const ans = (inv, k) => inv.answers && inv.answers[k];
  /** Steps for an investigation (shoe questions get the user's shoes as options). */
  function steps(inv, shoes) {
    return (Q[inv.type] || Q.performance).map(s => s.shoes
      ? Object.assign({}, s, { opts: (shoes || []).slice(0, 8).map(x => ({ v: x.id, l: x.name })) })
      : s);
  }
  /** The next unanswered question, or null when every question has an answer, skip or unknown. */
  function nextQuestion(inv, shoes) { return steps(inv, shoes).find(s => !ans(inv, s.k)) || null; }
  /** Record an answer. state: "answered" | "skipped" | "unknown". Skipped/unknown keep v = null (never inferred). */
  function answer(inv, k, v, state = "answered", now = new Date().toISOString()) {
    const a = Object.assign({}, inv.answers);
    a[k] = { v: state === "answered" ? v : null, state, at: now };
    return Object.assign({}, inv, { answers: a, updatedAt: now });
  }
  /** Re-open an earlier question (correction): removes it and nothing else. */
  function reopen(inv, k, now = new Date().toISOString()) { const a = Object.assign({}, inv.answers); delete a[k]; return Object.assign({}, inv, { answers: a, updatedAt: now, status: "draft" }); }

  // ---------- scope ----------
  const FIELDS = [
    ["distance", "Jarak", l => l.distance > 0],
    ["duration", "Durasi", l => l.duration > 0],
    ["pace", "Pace (dihitung dari jarak + durasi)", l => l.distance > 0 && l.duration > 0],
    ["hr", "Detak jantung rata-rata", l => l.hrAvg > 0],
    ["elev", "Elevasi naik", l => l.elev !== null && l.elev !== undefined && l.elev >= 0],
    ["rpe", "Rasa berat (RPE)", l => l.rpe >= 1],
    ["shoe", "Sepatu", l => !!l.shoeId],
    ["weather", "Catatan cuaca (teks)", l => !!(l.weather && String(l.weather).trim())],
    ["start", "Jam mulai", l => /^t:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(l.extId || "")],
    ["cadence", "Kadens", () => false]
  ];
  const NEED = {
    performance: ["distance", "duration", "pace"], consistency: ["distance"], comparison: ["distance", "duration", "pace"],
    environment: ["pace"], equipment: ["shoe", "distance"], recovery: [], experiment: []
  };
  const PLAN = {
    performance: "Pace dan durasi per kelompok jarak (mis. 3–6, 6–10, 10–16, 16+ km) dari waktu ke waktu, hanya lari dengan jarak + durasi terukur.",
    consistency: "Jumlah lari dan km per minggu kalender, minggu tanpa lari dihitung nol.",
    comparison: "Dua kelompok lari dengan aturan pencocokan yang kamu pilih; selisih median pace dan sebaran.",
    environment: "Pace/RPE dikelompokkan menurut faktor yang dipilih, hanya kalau datanya tercatat (tanpa menebak cuaca atau tanjakan).",
    equipment: "Lari per sepatu pada jenis sesi dan jarak yang mirip; selisih median pace/RPE.",
    recovery: "Nilai check-in harian dibandingkan dengan beban lari sebelumnya; hanya check-in yang benar-benar diisi.",
    experiment: "Protokol eksperimen (baseline vs periode uji) hadir di tahap berikutnya; untuk sekarang pertanyaan dan rencana disimpan."
  };
  const CONFOUNDERS = {
    performance: ["Jenis sesi berbeda (easy vs tempo)", "Rute dan tanjakan", "Cuaca", "Kurang tidur atau sakit", "Akurasi GPS"],
    consistency: ["Minggu ringan yang memang terjadwal (cutback/taper)", "Sakit atau perjalanan", "Lari yang tidak dicatat"],
    comparison: ["Rute berbeda", "Cuaca", "Effort berbeda", "Jumlah lari tidak seimbang"],
    environment: ["Jam lari ikut menentukan suhu", "Rute berbeda", "Effort yang disengaja berbeda", "Data cuaca hanya catatan teks"],
    equipment: ["Sepatu dipakai untuk jenis sesi berbeda", "Umur/km sepatu", "Rute dan cuaca"],
    recovery: ["Stres kerja", "Kafein dan makan", "Check-in tidak diisi setiap hari", "Ini observasi, bukan diagnosis"],
    experiment: ["Lebih dari satu hal berubah sekaligus", "Periode terlalu pendek", "Musim/cuaca berganti"]
  };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  /**
   * Scope for an investigation over the user's state. Deterministic.
   * Returns {method, window:{from,to,days}, included:[ids], excluded:[{id, reason}], coverage:[{k,l,n,total,need}],
   *          missingNeeded:[labels], checkins:{n}, plan, confounders, strava:{n}}
   */
  function scope(inv, state, today = ymd(new Date())) {
    const w = ans(inv, "window"), days = w && w.state === "answered" ? Number(w.v) : null;
    const from = days ? ymd(new Date(new Date(today + "T00:00:00").getTime() - (days - 1) * 864e5)) : null;
    const included = [], excluded = [];
    const runsAns = ans(inv, "runs"), typeFilter = runsAns && runsAns.state === "answered" && runsAns.v !== "all" ? runsAns.v : null;
    const shoeIds = ["shoeA", "shoeB"].map(k => ans(inv, k)).filter(a => a && a.state === "answered").map(a => a.v);
    for (const l of state.logs || []) {
      if (l.sample) { excluded.push({ id: l.id, reason: "contoh data" }); continue; }
      if (from && l.date < from) { excluded.push({ id: l.id, reason: "di luar periode" }); continue; }
      if (l.date > today) { excluded.push({ id: l.id, reason: "tanggal di masa depan" }); continue; }
      if (typeFilter && !(typeFilter === "easy" ? ["easy", "recovery"].includes(l.type) : l.type === typeFilter)) { excluded.push({ id: l.id, reason: "jenis sesi lain" }); continue; }
      if (inv.type === "equipment" && shoeIds.length && !shoeIds.includes(l.shoeId)) { excluded.push({ id: l.id, reason: "sepatu lain" }); continue; }
      included.push(l);
    }
    const need = NEED[inv.type] || [];
    const coverage = FIELDS.map(([k, label, has]) => ({ k, l: label, n: included.filter(has).length, total: included.length, need: need.includes(k) }));
    const missingNeeded = coverage.filter(c => c.need && c.n === 0).map(c => c.l);
    const ci = (state.checkins || []).filter(c => !c.sample && (!from || c.date >= from) && c.date <= today);
    return {
      method: METHOD, window: { from, to: today, days }, included: included.map(l => l.id), excluded,
      coverage, missingNeeded, checkins: { n: ci.length }, plan: PLAN[inv.type], confounders: CONFOUNDERS[inv.type] || [],
      strava: { n: included.filter(l => /strava/i.test(l.src || "") || /^strava:/.test(l.extId || "")).length }
    };
  }

  // ---------- record ----------
  const ID_RE = /^[A-Za-z0-9_-]{1,60}$/, ISO = v => typeof v === "string" && !isNaN(Date.parse(v)) ? v : null;
  const str = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  function newInvestigation(question, now = new Date().toISOString(), id) {
    const c = classify(question);
    return { id: id || "lab" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), schema: SCHEMA, createdAt: now, updatedAt: now,
      question: str(question, 500).trim(), type: c.type, typeSource: "auto", matched: c.matched, answers: {}, status: "draft", notes: "" };
  }
  /** Sanitizer for local, cloud and imported investigations. Returns null for unusable input (never throws). */
  function cleanInvestigation(x) {
    if (!x || typeof x !== "object" || !ID_RE.test(x.id || "") || !str(x.question, 500).trim()) return null;
    const o = { id: x.id, schema: SCHEMA, createdAt: ISO(x.createdAt) || new Date(0).toISOString(), updatedAt: ISO(x.updatedAt) || ISO(x.createdAt) || new Date(0).toISOString(),
      question: str(x.question, 500).trim(), type: TYPES[x.type] ? x.type : "performance", typeSource: x.typeSource === "user" ? "user" : "auto",
      matched: Array.isArray(x.matched) ? x.matched.filter(m => typeof m === "string").slice(0, 8).map(m => m.slice(0, 40)) : [],
      answers: {}, status: ["draft", "scoped", "closed"].includes(x.status) ? x.status : "draft", notes: str(x.notes, 2000) };
    if (str(x.questionEdited, 500).trim()) o.questionEdited = str(x.questionEdited, 500).trim();
    if (x.answers && typeof x.answers === "object") for (const [k, a] of Object.entries(x.answers).slice(0, 12)) {
      if (!/^[a-zA-Z]{1,20}$/.test(k) || !a || !["answered", "skipped", "unknown"].includes(a.state)) continue;
      const v = a.state !== "answered" ? null : typeof a.v === "number" && isFinite(a.v) ? a.v : typeof a.v === "string" ? a.v.slice(0, 200) : null;
      o.answers[k] = { v, state: a.state, at: ISO(a.at) || o.updatedAt };
    }
    return o;
  }
  /** Self-describing export (snapshot of question, answers and the scope as computed now). */
  function exportJson(inv, sc, exportedAt = new Date().toISOString()) {
    return { kind: "werunit-lab-investigation", schema: SCHEMA, exportedAt, methods: { scope: METHOD, analysis: null, research: null, synthesis: null },
      investigation: inv, scope: sc ? { window: sc.window, included: sc.included, excluded: sc.excluded, coverage: sc.coverage, missingNeeded: sc.missingNeeded, plan: sc.plan, confounders: sc.confounders } : null,
      note: "Snapshot. Analysis, research and AI synthesis were not available for this investigation." };
  }

  // Seams for later milestones (empty / unavailable on purpose).
  const ANALYSES = {};                                             // M2: registry of versioned deterministic analyses
  const NullProvider = { id: "none", available: () => false };     // M4: provider-neutral LLM adapter slot
  const STARTERS = [
    "Kenapa pace-ku nggak membaik padahal aku lari lebih banyak?",
    "Apakah aku lebih efisien lari pagi atau malam?",
    "Seberapa besar tanjakan memengaruhi pace-ku?",
    "Apakah aku lari beda pakai dua sepatu ini?",
    "Seberapa konsisten latihanku 8 minggu terakhir?",
    "Apakah tidurku berubah setelah long run?"
  ];

  G.WRI_LAB = { SCHEMA, METHOD, TYPES, RULES, classify, steps, nextQuestion, answer, reopen, scope, newInvestigation, cleanInvestigation, exportJson, ANALYSES, provider: NullProvider, research: null, STARTERS };
})(typeof globalThis !== "undefined" ? globalThis : this);
