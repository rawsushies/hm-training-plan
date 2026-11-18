/* RUNLAB Lab workspace (M1.5 redesign + M2 analyses + M3 research hook). Shares app globals.
 * Pure logic: js/lab/lab.js (WRI_LAB), js/lab/analysis.js (WRI_ANALYSIS), js/lab/charts.js (WRI_CHARTS),
 * js/lab/research.js (WRI_RESEARCH). Dock: Hari ini · Lab · Lari · Kamu; Race lives under Kamu + the Hari ini chip.
 * Honesty: capability states reflect runtime; analyses show method, record set, exclusions and adequacy; nothing is faked.
 */
(function () {
  "use strict";
  const LB = WRI_LAB, AN = WRI_ANALYSIS, CH = WRI_CHARTS;
  const LAB = { open: null, editQ: false, editType: false, draft: "", range: 12, sel: {}, band: null, cview: "spread", chide: {}, live: {}, research: { busy: false, err: "", results: null, q: "" } };

  /* ---------- navigation ---------- */
  IC.lab = '<svg class="ico" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>';
  NAV_MAIN.splice(0, NAV_MAIN.length, ["home", "Hari ini"], ["lab", "Lab"], ["log", "Lari"], ["more", "Kamu"]);
  DOCK_ICON.lab = "lab";
  Object.assign(DOCK_GROUP, { lab: "lab", race: "more", pace: "more", goals: "more" });
  if (typeof MENU_IC !== "undefined") { MENU_IC.race = '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'; MENU_IC.lab = '<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/>'; }
  const _vMoreL = vMore;
  vMore = function () {
    const ev = activeEvent(), days = Math.max(0, Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY));
    return _vMoreL().replace('<div data-tour="menu">', `<h2 class="a4-sec">Race</h2><div class="rows a4-list" data-tour="kamu-race">
      <button class="row" data-act="nav" data-t="race"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${MENU_IC.race}</svg></span><span class="grow">Race & strategi<br><span class="xs mu">${esc(ev.name)} · ${days} hari lagi</span></span><span class="mu">›</span></button>
      <button class="row" data-act="nav" data-t="pace"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13l3-3M12 3v2"/></svg></span><span class="grow">Pace calculator</span><span class="mu">›</span></button></div>
      <div data-tour="menu">`);
  };
  const _vHomeL = vHome;
  vHome = function () {
    const h = _vHomeL(), open = all().filter(i => i.status !== "closed")[0];
    if (!open || S.ui.tab !== "home") return h;
    const st = LB.stage(open, S.shoes);
    const card = `<button class="a4-card lab-cont" data-act="labOpen" data-id="${esc(open.id)}"><span class="a4-kicker">Lanjutkan investigasi · ${esc(LB.STAGES[st])}</span><span class="lab-q">${esc(qOf(open))}</span></button>`;
    return h.replace('<section class="a4-card a4-week"', card + '<section class="a4-card a4-week"');
  };

  /* ---------- helpers ---------- */
  const all = () => Object.values(S.lab || {}).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const qOf = i => i.questionEdited || i.question;
  const cur = () => S.lab && S.lab[LAB.open];
  const fmtWhen = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
  const pace = CH.pace, kmf = CH.km;
  function save(inv) {
    if (!Object.keys(S.lab || {}).length) makeBackup("Sebelum investigasi Lab pertama", S);
    S.lab = Object.assign({}, S.lab, { [inv.id]: inv }); persist();
  }
  const real = () => (S.logs || []).filter(l => !l.sample);
  const ICO = {
    performance: '<path d="M3 17l5-5 4 3 7-8"/><path d="M15 7h4v4"/>', consistency: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 14h2M13 14h2"/>',
    comparison: '<path d="M7 4v16M17 4v16M4 9h6M14 15h6"/>', environment: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    equipment: '<path d="M3 16c0-3 1-7 3-8l3 2 3-1c1 3 4 4 7 4 1.5 0 2 1 2 2v1H3z"/>', recovery: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    experiment: '<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/>'
  };
  const ico = (k, cls = "") => `<svg class="lab-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ICO.performance}</svg>`;
  /** Capability states from runtime, not hard-coded. */
  function caps() {
    const R = window.WRI_RESEARCH, online = isOnline();
    return [
      { k: "analysis", l: "Analisis lokal", st: "on", d: "Dihitung di perangkatmu dari catatan lari. Bekerja offline." },
      { k: "research", l: "Riset ilmiah", st: !R ? "off" : online ? "ready" : "off", d: !R ? "Modul riset tidak dimuat." : online ? "PubMed & OpenAlex, dicari saat kamu minta." : "Butuh koneksi. Hasil yang tersimpan tetap bisa dibuka." },
      { k: "ai", l: "Konsultasi AI", st: window.WRI_CONSULT && WRI_CONSULT.status(window.HMTP_LAB_AI || null) === "configured" ? "ready" : "off", d: "Belum diatur: butuh server aman + kunci API milik pemilik app. Tidak ada jawaban AI palsu." }
    ];
  }
  const CAPW = { on: "Aktif", ready: "Siap saat diminta", off: "Tidak aktif" };
  /** Capabilities as one quiet status line; details expand on demand (no three big cards). */
  const capStrip = () => { const c = caps(); return `<details class="lab-caps" data-tour="lab-caps"><summary role="list" aria-label="Kemampuan Lab">${c.map(x => `<span class="lab-cap ${x.st}" role="listitem" data-cap="${x.k}"><i class="lab-led" aria-hidden="true"></i><b>${x.l}</b> <span class="mu">${CAPW[x.st]}</span></span>`).join("")}<span class="lab-caps-more" aria-hidden="true">Detail</span></summary>
    <dl class="lab-caps-d">${c.map(x => `<dt>${x.l} · ${CAPW[x.st]}</dt><dd>${x.d}</dd>`).join("")}</dl></details>`; };
  function swap(id, html) { const el = document.getElementById(id); if (!el) return; el.outerHTML = html; const n = document.getElementById(id); if (n && typeof mountSegPills === "function") mountSegPills(n); }
  const narrow = () => (window.innerWidth || 1024) < 700;          // phones get a narrower viewBox so labels stay legible
  const fold = (cls, title, meta, body, open, attrs = "") => `<details class="lab-fold ${cls}"${open ? " open" : ""} ${attrs}><summary><span class="lab-fold-t">${title}</span>${meta ? `<span class="lab-fold-m">${meta}</span>` : ""}<svg class="lab-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="lab-fold-b">${body}</div></details>`;

  /* ---------- evidence rail (Lab home) ---------- */
  function evidence() {
    const runs = real(), t = todayYmd();
    if (!runs.length) return `<aside class="lab-rail" id="lab-ev" data-tour="lab-evidence"><p class="lab-kick">Bukti kamu</p><h2 class="lab-rail-h">Belum ada lari tercatat</h2>
      <p class="sm mu">Catat lari pertamamu atau import file GPX/TCX/CSV. Lab hanya memakai data yang benar-benar ada.</p>
      <div class="lab-acts-row"><button class="btn pri" data-act="nav" data-t="integ">${IC.plus} Import lari</button><button class="btn" data-act="quickLog">Catat lari</button></div></aside>`;
    const days = LAB.range * 7, w = { from: AN.addDays(t, -(days - 1)), to: t };
    const wk = AN.weekly(S, w), q = AN.quality(S, w), all = AN.quality(S, { to: t });
    LAB.live.weekly = wk;
    const sel = LAB.sel.weekly, sw = sel !== undefined && sel !== null ? wk.series[sel] : null;
    const src = Object.entries(all.metrics.sources), tot = all.n, N = narrow();
    return `<aside class="lab-rail" id="lab-ev" data-tour="lab-evidence">
      <div class="lab-ph"><div><p class="lab-kick">Bukti kamu</p><h2 class="lab-rail-h">Volume ${LAB.range} minggu</h2></div>${segPill("evrange", [["8", "8 mgg"], ["12", "12 mgg"], ["26", "26 mgg"]], String(LAB.range), "labRange")}</div>
      <dl class="lab-kpis">
        <div><dt>lari tercatat</dt><dd class="num">${tot}</dd></div>
        <div><dt>km · ${LAB.range} mgg</dt><dd class="num">${kmf(wk.metrics.totalKm)}</dd></div>
        <div><dt>data terakhir</dt><dd class="num">${all.metrics.latest ? CH.dlabel(all.metrics.latest) : "–"}</dd></div></dl>
      <div class="lab-chart" id="ch-weekly">${CH.weekly(wk.series, { sel, w: N ? 360 : 420, h: N ? 210 : 230 })}</div>
      <p class="ch-readout" aria-live="polite">${sw ? `<b>Minggu ${CH.dlabel(sw.start)}</b> · ${sw.runs ? `${kmf(sw.km)} km dari ${sw.runs} lari${sw.minutes ? `, ${sw.minutes} menit tercatat` : ""}${sw.logged === "partial" ? " · sebagian tanpa durasi" : ""}${sw.strength ? ` · ${sw.strength} strength` : ""}` : "tidak ada lari tercatat (belum tentu tidak lari)"}` : "Arahkan atau ketuk batang untuk detail minggu."}</p>
      ${fold("", "Kelengkapan data", `${LAB.range} mgg · ${q.n} lari`, CH.coverage(q.metrics.coverage), !N)}
      ${fold("", "Asal data", `semua ${tot} lari`, `<div class="lab-src" role="list">${src.map(([k, v]) => `<span role="listitem" style="flex:${v}" title="${esc(k)}: ${v}"><i></i>${esc(k)} <b class="num">${v}</b></span>`).join("")}</div>
        ${all.metrics.flags.length ? `<p class="xs mu" style="margin-top:8px">${all.metrics.flags.length} nilai perlu dicek (tidak diubah otomatis). Buka investigasi “kualitas data” untuk melihatnya.</p>` : ""}`, false)}
    </aside>`;
  }

  /* ---------- Lab home ---------- */
  function vLabHome() {
    const list = all(), paces = real().filter(l => l.distance > 0 && l.duration > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-24).map(l => l.duration / l.distance);
    const starters = LB.STARTERS.map((q, i) => { const c = LB.classify(q); return `<li><button class="lab-tile${LAB.draft === q ? " sel" : ""}" data-act="labStarter" data-i="${i}" aria-pressed="${LAB.draft === q}">${ico(c.type)}<span class="lab-tile-q">${esc(q)}</span><span class="lab-tile-k">${esc(LB.TYPES[c.type].l)}</span></button></li>`; }).join("");
    const inv = i => { const st = LB.stage(i, S.shoes), steps = LB.steps(i, S.shoes), done = steps.filter(s => i.answers[s.k]).length; return `<li><button class="lab-inv st-${st}" data-act="labOpen" data-id="${esc(i.id)}"><i class="lab-dot" aria-hidden="true"></i><span class="grow"><span class="lab-q">${esc(qOf(i))}</span><span class="xs mu">${esc(LB.STAGES[st])} · ${esc(LB.TYPES[i.type].l)} · ${fmtWhen(i.updatedAt)}</span></span><span class="lab-frac num" aria-label="${done} dari ${steps.length} pertanyaan dijawab">${done}/${steps.length}</span><svg class="lab-chev r" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></li>`; };
    return `<div class="lab2 home">
      <div class="lab-main">
        <header class="lab-hero"><p class="lab-kick">RUNLAB · Personal Running Lab</p><span class="lh-help">${helpBtn("lab")}</span>
          <h1>Apa yang mau kamu ketahui tentang larimu?</h1>
          <p class="lab-sub">Lab membaca catatan larimu sendiri, menunjukkan apa yang bisa dan belum bisa dijawab, lalu membantumu memutuskan apa yang diuji berikutnya.</p>
          ${CH.trace(paces, { w: 600, h: 56 })}</header>
        <section class="lab-compose" data-tour="lab-new"><label for="lab-q" class="sr-only">Pertanyaanmu</label>
          <div class="lab-composer"><textarea id="lab-q" rows="2" maxlength="500" placeholder="Tulis pertanyaanmu, misal: Kenapa pace-ku nggak membaik padahal lari lebih banyak?">${esc(LAB.draft)}</textarea>
          <button class="btn pri lab-go" data-act="labCreate"><span>Mulai investigasi</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
          ${capStrip()}</section>
        <section class="lab-sec"><h2 class="lab-h2">Mulai dari contoh</h2><ul class="lab-tiles">${starters}</ul></section>
        <section class="lab-sec"><div class="lab-ph"><h2 class="lab-h2">Investigasi</h2><span class="xs mu">${list.length ? `${list.length} tersimpan · privat` : "privat, hanya di akunmu"}</span></div>
          ${list.length ? `<ul class="lab-invs">${list.map(inv).join("")}</ul>` : `<p class="lab-empty">Belum ada investigasi. Tulis pertanyaan di atas: Lab akan bertanya satu hal setiap kali.</p>`}</section>
        <section class="lab-sec"><h2 class="lab-h2">Alat Lab</h2>
          <div class="lab-tool" aria-disabled="true" data-tour="lab-compiler"><svg class="lab-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/></svg><span class="grow"><b>Workout Compiler</b><br><span class="xs mu">Mengubah resep latihan jadi langkah terstruktur yang bisa dicek. Belum bisa dipakai.</span></span><span class="lab-soon">Segera hadir</span></div></section>
      </div>
      ${evidence()}
    </div>`;
  }

  /* ---------- investigation ---------- */
  const STEPS = [["ask", "Tanya"], ["context", "Konteks"], ["evidence", "Bukti"], ["findings", "Temuan"], ["experiment", "Eksperimen"]];
  function stepper(inv) {
    const st = LB.stage(inv, S.shoes), steps = LB.steps(inv, S.shoes), done = steps.filter(s => inv.answers[s.k]).length;
    const at = st === "draft" || st === "context" ? 1 : st === "ready" ? 2 : 3;
    return `<ol class="lab-steps" aria-label="Tahap investigasi">${STEPS.map(([k, l], i) => { const state = k === "experiment" ? "locked" : i < at ? "done" : i === at ? "now" : "todo"; return `<li class="${state}"${state === "now" ? ' aria-current="step"' : ""}><i aria-hidden="true"></i><span>${l}${k === "context" ? ` <small>${done}/${steps.length}</small>` : k === "experiment" ? " <small>nanti</small>" : ""}</span></li>`; }).join("")}</ol>`;
  }
  const ansText = (s, a) => !a ? "" : a.state === "skipped" ? "dilewati" : a.state === "unknown" ? "nggak tahu" : ((s.opts || []).find(x => String(x.v) === String(a.v)) || { l: String(a.v) }).l;
  function askCard(q) {
    return `<section class="lab-ask" data-tour="lab-ask" aria-live="polite"><p class="lab-kick">Pertanyaan lanjutan</p><h2>${esc(q.q)}</h2>
      <details class="lab-why"><summary>Kenapa ditanya?</summary><p class="sm">${esc(q.why)}</p></details>
      ${q.text ? `<label class="sr-only" for="lab-txt">${esc(q.q)}</label><input type="text" id="lab-txt" maxlength="200" placeholder="${esc(q.ph || "")}"><button class="btn pri" style="margin-top:10px" data-act="labAnsText" data-k="${q.k}">Simpan jawaban</button>`
        : (q.opts && q.opts.length ? `<div class="lab-opts" role="group" aria-label="${esc(q.q)}">${q.opts.map(o => `<button class="lab-opt" data-act="labAns" data-k="${q.k}" data-v="${esc(String(o.v))}"><span>${esc(o.l)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`).join("")}</div>` : `<p class="lab-empty">Belum ada pilihan: tambahkan sepatu dulu di Kamu → Sepatu, atau lewati.</p>`)}
      <div class="lab-alt"><button class="btn ghost" data-act="labSkip" data-k="${q.k}" data-s="unknown">Nggak tahu</button><button class="btn ghost" data-act="labSkip" data-k="${q.k}" data-s="skipped">Lewati</button></div></section>`;
  }
  const winText = sc => sc.window.days ? `${fmtD(sc.window.from)} – ${fmtD(sc.window.to)} · ${sc.window.days} hari` : `semua data sampai ${fmtD(sc.window.to)}`;
  const reasonsOf = list => { const r = {}; list.forEach(e => { r[e.reason] = (r[e.reason] || 0) + 1; }); return Object.entries(r).sort((a, b) => b[1] - a[1]); };
  function snapNote(inv) {
    const snaps = inv.snapshots || [], fresh = snaps.filter(s => LB.snapshotFresh(inv, s));
    return fresh.length ? `Snapshot ${fmtWhen(fresh[0].createdAt)} · ${fresh.map(s => s.methodVersion).join(", ")}` : snaps.length ? "Snapshot lama tidak cocok lagi dengan jawabanmu: hitung ulang." : "Dihitung di perangkatmu. Hasil disimpan sebagai snapshot dengan versi metode.";
  }
  /** Eligible-records summary. "Memenuhi syarat" = inside the window; each analysis then reports its own n. */
  function eligibility(sc) {
    const inc = sc.included.length, exc = sc.excluded.length;
    return `<div class="lab-elig"><p class="lab-big"><b class="num">${inc}</b> lari masuk analisis <span class="mu">· memenuhi syarat periode</span></p>
      <p class="sm mu">${esc(winText(sc))}${exc ? ` · ${exc} di luar` : ""}</p>
      <div class="lab-split" role="img" aria-label="${inc} lari memenuhi syarat, ${exc} tidak"><i class="in" style="flex:${Math.max(inc, 0.0001)}"></i><i class="out" style="flex:${Math.max(exc, 0.0001)}"></i></div>
      <p class="xs mu">Tiap analisis lalu memakai bagian yang punya data yang dibutuhkan, jadi n per temuan bisa lebih kecil.</p>
      ${exc ? `<details class="lab-why"><summary>Kenapa ${exc} lari tidak dipakai</summary><ul class="sm">${reasonsOf(sc.excluded).map(([r, n]) => `<li>${n} · ${esc(r)}</li>`).join("")}</ul></details>` : ""}</div>`;
  }
  const missingNote = sc => sc.missingNeeded.length ? `<div class="lab-note warn">Belum ada: ${sc.missingNeeded.map(esc).join(", ")}. Lab nggak menebak nilai yang hilang. ${sc.missingNeeded.some(m => /Durasi|Pace/.test(m)) ? "Tambahkan durasi di lari yang tercatat (Lari → buka lari → Edit) atau import file." : ""}</div>` : "";
  const stravaNote = sc => sc.strava.n ? `<p class="xs mu">${sc.strava.n} lari berasal dari Strava: dipakai untuk hitungan di perangkatmu, tapi tidak akan pernah dikirim ke AI.</p>` : "";
  /** Canvas focal block before analysis: what will be computed, from which records, then one clear action. */
  function readyBlock(inv, sc) {
    const fresh = (inv.snapshots || []).filter(s => LB.snapshotFresh(inv, s));
    return `<section class="lab-ready" data-tour="lab-scope" id="lab-scope"><p class="lab-kick">Bukti · rencana analisis</p>
      ${eligibility(sc)}
      <div class="lab-ready-g"><div><h3>Yang akan dihitung</h3><p class="sm">${esc(sc.plan)}</p></div>
        <div><h3>Bisa mengacaukan hasil</h3><ul class="lab-list sm">${sc.confounders.map(c => `<li>${esc(c)}</li>`).join("")}</ul></div></div>
      <h3>Kelengkapan data</h3>${CH.coverage(sc.coverage)}
      ${missingNote(sc)}${stravaNote(sc)}
      <div class="lab-run"><button class="btn pri lab-cta" data-act="labAnalyze">${fresh.length ? "Hitung ulang" : "Jalankan analisis"}</button><span class="xs mu">${snapNote(inv)}</span></div></section>`;
  }
  /** Inspector version once findings exist: compact, collapsible. */
  function scopeInspector(inv, sc) {
    return fold("lab-insp-scope", "Data & cakupan", `${sc.included.length} lari`, `<div data-tour="lab-scope" id="lab-scope">${eligibility(sc)}
      <h4>Kelengkapan data</h4>${CH.coverage(sc.coverage)}${missingNote(sc)}${stravaNote(sc)}
      <div class="lab-run"><button class="btn sm" data-act="labAnalyze">Hitung ulang</button><span class="xs mu">${snapNote(inv)}</span></div></div>`, !narrow());
  }
  /** Deterministic sentences from metrics (no generation, careful wording). */
  function sentence(r) {
    const m = r.metrics;
    if (r.analysisId === "weekly") return `Dalam ${m.weeks} minggu, ${m.activeWeeks} minggu ada lari tercatat; median ${m.medianWeekKm === null ? "–" : kmf(m.medianWeekKm)} km per minggu aktif. ${m.emptyWeeks} minggu tanpa catatan (belum tentu tidak lari).`;
    if (r.analysisId === "trend") { const ok = m.bands.filter(b => b.verdict !== "insufficient"); if (!ok.length) return "Belum cukup lari sebanding (butuh minimal 3 lari per paruh periode di rentang jarak yang sama)."; return ok.map(b => `${b.band}: median ${pace(b.late.median)} /km di paruh akhir vs ${pace(b.early.median)} /km di paruh awal (${b.verdict === "flat" ? "praktis sama" : `${Math.abs(b.diff)} dtk/km lebih ${b.verdict === "faster" ? "cepat" : "lambat"}`}; n ${b.early.n}/${b.late.n}).`).join(" "); }
    if (r.analysisId === "compare") return m.diff === null ? `Belum cukup lari di kedua kelompok (${m.labels.a}: ${m.a.n}, ${m.labels.b}: ${m.b.n}; butuh minimal 3 per kelompok).` : `${m.labels.a}: median ${pace(m.a.median)} /km (n ${m.a.n}). ${m.labels.b}: median ${pace(m.b.median)} /km (n ${m.b.n}). Selisih ${Math.abs(m.diff)} dtk/km${m.distanceGap ? `, dengan selisih jarak median ${kmf(Math.abs(m.distanceGap))} km` : ""}.`;
    const c = Object.fromEntries(m.coverage.map(x => [x.k, x])); return `${r.n} lari; durasi ada di ${c.duration.n}/${r.n}, detak jantung ${c.hr.n}/${r.n}, jam mulai ${c.start.n}/${r.n}. ${m.flags.length} nilai ditandai untuk dicek.`;
  }
  /** The single key figure of a finding (shown large). Only values computed by the analysis. */
  function keyFigure(r) {
    const m = r.metrics;
    if (r.analysisId === "compare") return m.diff === null ? null : m.diff === 0 ? { v: "0", u: "dtk/km", l: "median sama" } : { v: String(Math.abs(m.diff)), u: "dtk/km", l: `${m.diff > 0 ? m.labels.a : m.labels.b} lebih cepat (median)` };
    if (r.analysisId === "trend") { const b = AN.leadBand(r); return b ? { v: b.verdict === "flat" ? "≈" : String(Math.abs(b.diff)), u: b.verdict === "flat" ? "praktis sama" : "dtk/km", l: `${b.band}: paruh akhir ${b.verdict === "flat" ? "vs awal" : b.verdict === "faster" ? "lebih cepat" : "lebih lambat"}` } : null; }
    if (r.analysisId === "weekly") return m.medianWeekKm === null ? null : { v: kmf(m.medianWeekKm), u: "km", l: "median per minggu aktif" };
    const c = Object.fromEntries(m.coverage.map(x => [x.k, x])); return { v: `${c.duration.n}/${r.n}`, u: "", l: "lari dengan durasi" };
  }
  const TITLE = { weekly: "Volume mingguan", trend: "Tren pace per rentang jarak", compare: "Perbandingan dua kelompok", quality: "Kualitas & kelengkapan data" };
  const ADQ = { adequate: "Data cukup", limited: "Data terbatas", insufficient: "Belum cukup data" };
  const GRADE_HELP = {
    descriptive: "Ringkasan hitungan dari catatanmu. Tidak menguji perbedaan.",
    insufficient: "Belum memenuhi jumlah lari minimum, jadi belum ada perbandingan.",
    observation: "Ada selisih di datamu, tapi belum didukung uji statistik (atau lari per kelompok < 6). Bisa kebetulan.",
    supported: "Uji permutasi: selisih sebesar ini jarang muncul kalau kelompoknya diacak (p < 0,05). Tetap asosiasi, bukan sebab-akibat."
  };
  const gradeBadge = g => `<span class="lab-grade g-${g.grade}" title="${esc(GRADE_HELP[g.grade])}">${esc(g.label)}${g.p !== null ? ` <span class="num">p ${String(g.p).replace(".", ",")}</span>` : ""}</span>`;
  /** n strip: dataset eligibility vs what this metric actually used, plus why the rest is excluded. */
  function sampleLine(r, eligible, g) {
    const ex = reasonsOf(r.excluded), used = r.n, groups = g.groups ? (g.band ? ` di semua rentang jarak; dibandingkan di ${g.band}: ${g.groups[0]} paruh awal + ${g.groups[1]} paruh akhir,` : ` (${g.groups.join(" + ")})`) : "";
    return `<div class="lab-n"><div class="lab-nbar" role="img" aria-label="${used} dari ${eligible} lari dipakai di analisis ini"><i style="flex:${Math.max(used, 0.0001)}"></i><i class="out" style="flex:${Math.max(eligible - used, 0.0001)}"></i></div>
      <p class="sm"><b class="num">n ${used}</b>${groups} dipakai di analisis ini dari <b class="num">${eligible}</b> lari yang memenuhi syarat · <span class="lab-adq ${r.adequacy}">${ADQ[r.adequacy]}</span></p>
      ${ex.length ? `<p class="xs mu">Tidak dipakai: ${ex.map(([k, n]) => `${n} ${esc(k)}`).join(" · ")}</p>` : ""}</div>`;
  }
  function findingChart(r, lead) {
    const sel = LAB.sel[r.analysisId], N = narrow(), W = N ? 360 : lead ? 760 : 640;
    if (r.analysisId === "weekly") return CH.weekly(r.series, { sel, w: W, h: N ? 220 : lead ? 280 : 230 });
    if (r.analysisId === "trend") {
      const bands = r.metrics.bands; if (!bands.length) return CH.trend([], null);
      const b = bands.find(x => x.band === LAB.band) || AN.leadBand(r) || bands[0];
      return `${bands.length > 1 ? `<div class="lab-ctl"><span class="xs mu">Rentang jarak</span>${segPill("trendband", bands.map(x => [x.band, x.band]), b.band, "labBand")}</div>` : ""}${CH.trend(r.series, Object.assign({}, b, { splitDate: r.metrics.splitDate }), { sel, w: W, h: N ? 250 : lead ? 300 : 250 })}`;
    }
    if (r.analysisId === "compare") {
      const m = r.metrics, hide = LAB.chide, chip = k => `<button type="button" class="lab-gchip ${k === "a" ? "sa" : "sb"}" data-act="labCompHide" data-g="${k}" aria-pressed="${!hide[k]}" title="${hide[k] ? "Tampilkan" : "Sembunyikan"} ${esc(m.labels[k])}"><i aria-hidden="true"></i><span class="lab-gchip-l">${esc(m.labels[k])}</span><span class="num">${m[k].n}</span></button>`;
      return `<div class="lab-ctl lab-ctl-c"><div class="lab-ctl-g">${segPill("compview", [["spread", "Sebaran"], ["time", "Urutan waktu"]], LAB.cview, "labCompView")}</div><div class="lab-ctl-g" role="group" aria-label="Kelompok yang ditampilkan">${chip("a")}${chip("b")}</div></div>
        ${CH.compare(m, r.series, { sel, w: W, h: N ? (LAB.cview === "time" ? 240 : 230) : LAB.cview === "time" ? 290 : 250, view: LAB.cview, hide })}
        ${LAB.cview === "time" ? `<p class="xs mu lab-ctl-note">Kalau satu kelompok berkumpul di minggu-minggu tertentu, selisihnya bisa ikut dipengaruhi waktu (kebugaran, musim), bukan hanya kelompoknya.</p>` : ""}`;
    }
    return CH.coverage(r.metrics.coverage);
  }
  function redrawChart(id) {
    const r = LAB.live[id]; if (!r) return;
    const box = document.getElementById("ch-" + id); if (box) { box.innerHTML = findingChart(r, isLead(id)); if (typeof mountSegPills === "function") mountSegPills(box); }
    const ro = document.getElementById("ro-" + id); if (ro) ro.innerHTML = readout(r);
  }
  function readout(r) {
    const i = LAB.sel[r.analysisId]; if (i === undefined || i === null) return `<span class="mu">Arahkan atau ketuk ${r.analysisId === "weekly" ? "batang" : "titik"} untuk detail${r.analysisId === "weekly" ? "" : " dan buka lari aslinya"}.</span>`;
    let p = null;
    if (r.analysisId === "weekly") { const w = r.series[i]; return w ? `<b>Minggu ${CH.dlabel(w.start)}</b> · ${w.runs ? `${kmf(w.km)} km, ${w.runs} lari` : "tidak ada lari tercatat"}` : ""; }
    if (r.analysisId === "trend") { const b = LAB.band, pts = r.series.filter(x => x.band === (r.metrics.bands.find(y => y.band === b) || AN.leadBand(r) || r.metrics.bands[0] || {}).band); p = pts[i]; }
    if (r.analysisId === "compare") p = r.series.a.concat(r.series.b)[i];
    return p ? `<b>${CH.dlabel(p.date)}</b> · ${kmf(p.km)} km · ${pace(p.pace)} /km <button class="link sm" data-act="editLog" data-id="${esc(p.id)}">Buka lari</button>` : "";
  }
  function methodFold(r, g) {
    return `<details class="lab-method"><summary>Metode, data & batasan <span class="xs mu">${esc(r.methodVersion)} · n ${r.n}</span><svg class="lab-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
        <dl class="sm"><dt>Periode</dt><dd>${r.window.from ? fmtD(r.window.from) : "awal data"} – ${fmtD(r.window.to)}</dd><dt>Cara hitung</dt><dd>${esc(r.method)}</dd>
        ${g.test ? `<dt>Uji</dt><dd>${esc(g.test)}; p ${String(g.p).replace(".", ",")}. “Didukung” hanya jika p &lt; 0,05, minimal 6 lari per kelompok, dan selisih ≥ 5 dtk/km.</dd>` : ""}
        ${r.assumptions.length ? `<dt>Asumsi</dt><dd>${r.assumptions.map(esc).join(" ")}</dd>` : ""}<dt>Batasan</dt><dd>${r.limitations.map(esc).join(" ")}</dd>
        <dt>Tidak dipakai</dt><dd>${r.excluded.length ? reasonsOf(r.excluded).map(([k, n]) => `${n} (${esc(k)})`).join(", ") : "–"}</dd>
        ${r.missingFields.length ? `<dt>Data hilang</dt><dd>${r.missingFields.map(esc).join(", ")}</dd>` : ""}<dt>Satuan</dt><dd>${Object.values(r.units).map(esc).join(" · ") || "–"}</dd></dl></details>`;
  }
  /** One finding. lead = the focal finding (big figure + big chart); others are flatter rows. */
  function findingCard(r, eligible, lead) {
    const g = AN.grade(r), k = keyFigure(r);
    const flags = r.analysisId === "quality" && r.metrics.flags.length ? `<details class="lab-why"><summary>${r.metrics.flags.length} nilai perlu dicek</summary><ul class="sm">${r.metrics.flags.slice(0, 20).map(f => `<li>${esc(f.note)} <button class="link sm" data-act="editLog" data-id="${esc(f.id)}">Buka</button></li>`).join("")}</ul></details>` : "";
    return `<article class="lab-find${lead ? " is-lead" : ""} g-${g.grade}" data-analysis="${r.analysisId}">
      <header class="lab-find-h"><p class="lab-kick">${lead ? "Temuan utama" : "Temuan pendukung"} · ${esc(TITLE[r.analysisId])}</p>${gradeBadge(g)}</header>
      <div class="lab-find-top">${k ? `<p class="lab-fig"><b class="num">${esc(k.v)}</b>${k.u ? `<span class="u">${esc(k.u)}</span>` : ""}<span class="l">${esc(k.l)}</span></p>` : ""}
        <p class="lab-sent">${esc(sentence(r))}</p></div>
      ${sampleLine(r, eligible, g)}
      ${r.analysisId === "quality" && !lead ? `<details class="lab-fold-in"><summary>Kelengkapan per kolom<svg class="lab-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary><div class="lab-chart" id="ch-quality">${findingChart(r, lead)}</div></details>` : `<div class="lab-chart" id="ch-${r.analysisId}">${findingChart(r, lead)}</div>`}
      ${r.analysisId !== "quality" ? `<p class="ch-readout" id="ro-${r.analysisId}" aria-live="polite">${readout(r)}</p>` : flags}
      ${methodFold(r, g)}</article>`;
  }
  /** Which finding answers the question best: a comparison or trend beats volume; data quality only when alone. */
  const LEAD_ORDER = ["compare", "trend", "weekly", "quality"];
  function results(inv) {
    const sc = LB.scope(inv, S), w = { from: sc.window.from, to: sc.window.to };
    const shoes = S.shoes || [], nm = id => (shoes.find(s => s.id === id) || {}).name;
    return AN.plan(inv).map(([id, opts]) => AN.run(id, S, w, Object.assign({}, opts, { shoeAName: nm(opts.shoeA), shoeBName: nm(opts.shoeB) })));
  }
  /** What can and cannot be said, from the grades (deterministic). */
  function conclusions(res, sc) {
    const can = res.map(r => ({ r, g: AN.grade(r) })).filter(x => x.g.grade !== "insufficient" && x.g.grade !== "descriptive")
      .map(({ r, g }) => `<li><span class="lab-grade g-${g.grade}">${esc(g.label)}</span> ${esc(TITLE[r.analysisId])}: ${g.grade === "supported" ? "selisihnya kecil kemungkinan kebetulan di datamu." : "ada selisih, tapi bisa saja kebetulan."}</li>`);
    const cannot = [`<li>Ini pola dari catatanmu sendiri, bukan bukti sebab-akibat.</li>`].concat(res.filter(r => r.adequacy !== "adequate").map(r => `<li>${esc(ADQ[r.adequacy])} untuk ${esc(TITLE[r.analysisId].toLowerCase())} (n ${r.n}).</li>`), [...new Set(res.flatMap(r => r.missingFields))].map(f => `<li>Tanpa data ${esc(f)}.</li>`));
    return `<section class="lab-concl" data-tour="lab-conclusions"><div><h3>Yang bisa dikatakan</h3><ul class="lab-list sm">${can.length ? can.join("") : `<li class="mu">Belum ada perbedaan yang bisa dinilai. Temuan di atas bersifat deskriptif.</li>`}</ul></div>
      <div><h3>Yang belum bisa disimpulkan</h3><ul class="lab-list sm">${cannot.join("")}</ul></div>
      <div class="lab-concl-w"><h3>Kemungkinan penjelasan lain <span class="xs mu">· belum diuji</span></h3><ul class="lab-list sm">${sc.confounders.map(c => `<li>${esc(c)}</li>`).join("")}</ul><p class="xs mu">Lab tidak membuat penjelasan otomatis (konsultasi AI <b>belum diatur</b>). Punya dugaan sendiri? Tulis di Catatan.</p></div></section>`;
  }
  /** Where the shown list came from: live provider call, fresh cache, or an older cache used because offline/providers failed. */
  function originNote(st) {
    if (st.origin === "cache") return `<p class="xs mu" data-origin="cache">Dari hasil tersimpan ${esc(st.cache)} (belum 14 hari). Tekan "Cari lagi" untuk mengambil ulang.</p>`;
    if (st.origin === "stale-cache") return `<p class="xs mu" data-origin="stale-cache">Hasil lama dari ${esc(st.cache)}, ditampilkan karena ${st.offline ? "kamu offline" : "sumber tidak bisa dihubungi"}. Bisa sudah berubah.</p>`;
    if (st.origin === "live") return `<p class="xs mu" data-origin="live">Diambil langsung dari penyedia barusan.</p>`;
    return "";
  }
  function researchPanel(inv) {
    const R = window.WRI_RESEARCH, st = LAB.research, saved = inv.sources || [];
    const online = isOnline(), list = st.results && st.inv === inv.id ? st.results : null;
    const card = (x, savedOne) => `<li class="lab-src-card"><div class="lab-src-meta"><span class="lab-kind">${esc(x.kindLabel || x.kind || "artikel")}</span><span class="xs mu">${esc(x.provider)}${x.year ? ` · ${x.year}` : ""}</span></div>
      <a class="lab-src-t" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>
      <p class="xs mu">${esc((x.authors || []).slice(0, 3).join(", "))}${(x.authors || []).length > 3 ? " dkk." : ""}${x.journal ? ` · ${esc(x.journal)}` : ""}${x.pmid ? ` · PMID ${esc(x.pmid)}` : ""}${x.doi ? ` · DOI ${esc(x.doi)}` : ""}</p>
      ${x.excerpt ? `<details class="lab-why"><summary>Kutipan abstrak</summary><p class="sm">${esc(x.excerpt)}</p></details>` : ""}
      ${x.why ? `<p class="xs mu">Kenapa muncul: ${esc(x.why)}</p>` : ""}
      ${savedOne ? `<button class="btn sm ghost" data-act="labUnsave" data-id="${esc(x.id)}">Lepas dari investigasi</button>` : `<button class="btn sm" data-act="labSaveSrc" data-id="${esc(x.id)}">Simpan ke investigasi</button>`}</li>`;
    return `<section class="lab-block" id="lab-research" data-tour="lab-research"><div class="lab-ph"><h3>Riset terbitan</h3><span class="xs mu">${online ? "PubMed · OpenAlex" : "offline"}</span></div>
      <p class="xs mu">Hanya metadata dan abstrak dari sumber terbuka. Lab tidak pernah mengarang judul, penulis, atau hasil. Kutipan abstrak adalah teks asli sumber.</p>
      ${saved.length ? `<h4>Tersimpan di investigasi ini</h4><ul class="lab-srcs">${saved.map(x => card(x, true)).join("")}</ul>` : ""}
      ${!R ? `<p class="sm mu">Modul riset tidak tersedia.</p>` : `<div class="lab-run"><button class="btn${saved.length ? "" : " pri"}${st.busy ? " is-busy" : ""}" data-act="labResearch" ${st.busy ? 'disabled aria-busy="true"' : ""}>${st.busy ? '<i class="lab-spin" aria-hidden="true"></i>Mencari…' : list ? "Cari lagi" : "Cari riset terkait"}</button><span class="xs mu">Kata kunci: ${esc(R.queryFor(inv, LAB.lastResults || []).text)}</span></div>`}
      ${st.err && st.inv === inv.id ? `<div class="lab-note warn" role="alert">${esc(st.err)}</div>` : ""}
      ${st.notes && st.notes.length && st.inv === inv.id && !st.err ? `<p class="xs mu" data-research-notes>Catatan: ${esc(st.notes.join(" "))}</p>` : ""}
      ${list ? (list.length ? `<ul class="lab-srcs">${list.filter(x => !saved.some(s => s.id === x.id)).map(x => card(x, false)).join("")}</ul>${originNote(st)}` : `<p class="sm">Tidak ada riset yang cukup relevan ditemukan untuk kata kunci ini. Itu hasil yang sah.</p>`) : ""}</section>`;
  }
  /** AI consultation: credential-gated. Shows exactly what would be sent, and that nothing is sent today. */
  function aiPanel(inv, res) {
    const C = window.WRI_CONSULT; if (!C) return "";
    const st = C.status(window.HMTP_LAB_AI || null), prev = C.buildPayload(inv, S, res, C.CATEGORIES.map(c => c.k));
    return fold("lab-locked", "Konsultasi AI", st === "configured" ? "Siap" : "Belum diatur", `<p class="sm">${st === "configured" ? "" : "Belum aktif: butuh server aman dan kunci API milik pemilik app. Tidak ada data yang dikirim, dan tidak ada jawaban AI palsu."}</p>
      <h4>Yang akan dikirim kalau nanti diaktifkan (dengan izinmu)</h4>
      <ul class="sm lab-list">${C.CATEGORIES.map(c => `<li><label><input type="checkbox" disabled ${c.k === "hr" ? "" : "checked"}> ${esc(c.l)}</label></li>`).join("")}</ul>
      <p class="xs mu">Tidak pernah dikirim: catatan pribadi, nama, email, rute/GPS, data teman${prev.excluded.strava ? `, dan ${prev.excluded.strava} lari dari Strava (aturan Strava melarang pemakaian AI)` : ", dan lari dari Strava"}.</p>`, false, 'data-tour="lab-ai"');
  }
  function vInvestigation(inv) {
    const shoes = S.shoes || [], st = LB.steps(inv, shoes), next = LB.nextQuestion(inv, shoes), T = LB.TYPES[inv.type], stage = LB.stage(inv, shoes);
    const answered = st.filter(s => inv.answers[s.k]);
    const sc = next ? null : LB.scope(inv, S);
    const fresh = (inv.snapshots || []).filter(s => LB.snapshotFresh(inv, s));
    const res = !next && fresh.length ? results(inv) : null; LAB.lastResults = res || [];
    if (res) res.forEach(r => { LAB.live[r.analysisId] = r; });
    const changed = res && fresh.some(snp => { const r = res.find(x => x.analysisId === snp.analysisId); return r && JSON.stringify(r.includedRecordIds.slice(0, 400)) !== JSON.stringify(snp.includedRecordIds); });
    const ordered = res ? res.slice().sort((a, b) => LEAD_ORDER.indexOf(a.analysisId) - LEAD_ORDER.indexOf(b.analysisId)) : [];
    const eligible = sc ? sc.included.length : 0;
    return `<div class="lab2 inv${res ? " has-res" : ""}">
      <header class="lab-head" data-tour="lab-question">
        <div class="lab-topbar"><button class="back" data-act="labBack"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Lab</button><span class="lab-stage st-${stage}"><i aria-hidden="true"></i>${esc(LB.STAGES[stage])}</span>
          <span class="lab-acts"><button class="icbtn" data-act="labExport" aria-label="Export investigasi (JSON)" title="Export"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button><button class="icbtn" data-act="labClose" aria-label="${inv.status === "closed" ? "Buka lagi" : "Arsipkan"}" title="${inv.status === "closed" ? "Buka lagi" : "Arsipkan"}"><svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM2 3h20v4H2zM10 12h4"/></svg></button><button class="icbtn danger" data-act="labDelete" aria-label="Hapus investigasi" title="Hapus"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></span></div>
        ${LAB.editQ ? `<label class="sr-only" for="lab-eq">Ubah pertanyaan</label><textarea id="lab-eq" rows="3" maxlength="500">${esc(qOf(inv))}</textarea><div class="btns"><button class="btn sm pri" data-act="labSaveQ">Simpan</button><button class="btn sm ghost" data-act="labEditQ">Batal</button></div>`
          : `<h1 class="lab-title">${esc(qOf(inv))}</h1>${inv.questionEdited ? `<p class="xs mu">Pertanyaan asli: ${esc(inv.question)}</p>` : ""}`}
        <div class="lab-type">${ico(inv.type)}<b>${esc(T.l)}</b><span class="xs mu">${inv.typeSource === "user" ? "dipilih kamu" : inv.matched.length ? "dikenali dari: " + inv.matched.map(esc).join(", ") : "tebakan awal"}</span>
          ${LAB.editQ ? "" : `<button class="link sm" data-act="labEditQ">Ubah pertanyaan</button>`}${LAB.editType ? "" : `<button class="link sm" data-act="labEditType">Ganti jenis</button>`}</div>
        ${LAB.editType ? `<div class="field" style="margin-top:8px"><label for="lab-type">Jenis investigasi</label><select id="lab-type" data-live="labType">${Object.entries(LB.TYPES).map(([k, t]) => `<option value="${k}" ${k === inv.type ? "selected" : ""}>${esc(t.l)}: ${esc(t.d)}</option>`).join("")}</select></div>` : ""}
        ${stepper(inv)}</header>
      <div class="lab-main">
        ${next ? askCard(next) : ""}
        ${sc && !res ? readyBlock(inv, sc) : ""}
        ${res ? `<section class="lab-findings" data-tour="lab-findings"><div class="lab-ph"><h2 class="lab-h2">Temuan dari datamu</h2>${changed ? `<span class="lab-stage st-context"><i aria-hidden="true"></i>Data berubah sejak snapshot</span>` : ""}</div>
            ${ordered.map((r, i) => findingCard(r, eligible, i === 0)).join("")}</section>
          ${conclusions(res, sc)}
          ${researchPanel(inv)}
          ${aiPanel(inv, res)}
          <section class="lab-block lab-locked-row"><h3>Eksperimen berikutnya</h3><p class="sm mu">Merancang eksperimen pribadi (satu variabel, baseline vs periode uji) hadir di tahap berikutnya. Belum aktif.</p></section>` : ""}
      </div>
      <aside class="lab-side" aria-label="Inspektur investigasi">
        ${res ? scopeInspector(inv, sc) : ""}
        ${answered.length ? fold("lab-answers", "Jawabanmu", `${answered.length} dijawab`, `${answered.map(s => `<button class="lab-ans" data-act="labReopen" data-k="${s.k}" aria-label="Ubah jawaban: ${esc(s.q)}"><span class="xs mu">${esc(s.q)}</span><b class="${inv.answers[s.k].state !== "answered" ? "mu" : ""}">${esc(ansText(s, inv.answers[s.k]))}</b><span class="lab-edit">Ubah</span></button>`).join("")}<p class="xs mu">Mengubah jawaban juga menghapus jawaban yang bergantung padanya, dan snapshot lama jadi kedaluwarsa.</p>`, !narrow() || !res) : ""}
        ${fold("lab-notes", "Catatanmu", inv.notes ? "tersimpan" : "", `<label class="sr-only" for="lab-notes">Catatanmu</label><textarea id="lab-notes" rows="3" maxlength="2000" placeholder="Dugaan, kesimpulan, atau hal yang mau dicoba.">${esc(inv.notes || "")}</textarea><button class="btn sm" data-act="labSaveNotes">Simpan catatan</button>`, !narrow() || !!inv.notes)}
      </aside>
    </div>`;
  }
  window.vLab = function () { const inv = LAB.open && S.lab && S.lab[LAB.open]; return inv ? vInvestigation(inv) : vLabHome(); };

  /* ---------- actions ---------- */
  Object.assign(ACT, {
    labStarter: d => {
      const q = LB.STARTERS[+d.i]; LAB.draft = q; const el = document.getElementById("lab-q"); if (el) { el.value = q; el.focus(); }
      document.querySelectorAll(".lab-tile").forEach(t => { const on = t.dataset.i === String(d.i); t.classList.toggle("sel", on); t.setAttribute("aria-pressed", String(on)); });
    },
    labCreate: () => {
      const q = ((document.getElementById("lab-q") || {}).value || "").trim();
      if (q.length < 5) { toast("Tulis pertanyaanmu dulu (minimal 5 huruf)", "err"); const el = document.getElementById("lab-q"); if (el) el.focus(); return; }
      const inv = LB.newInvestigation(q); save(inv); LAB.open = inv.id; LAB.draft = ""; LAB.editQ = LAB.editType = false; LAB.sel = {}; render(false); window.scrollTo(0, 0); toast("Investigasi tersimpan", "ok");
    },
    labOpen: d => { LAB.open = d.id; LAB.editQ = LAB.editType = false; LAB.sel = {}; LAB.band = null; LAB.cview = "spread"; LAB.chide = {}; S.ui.tab = "lab"; render(false); window.scrollTo(0, 0); },
    labBack: () => { LAB.open = null; LAB.editQ = LAB.editType = false; render(false); },
    labAns: d => { const i = cur(); if (!i) return; const v = /^-?\d+(\.\d+)?$/.test(d.v) ? Number(d.v) : d.v; save(LB.answer(i, d.k, v)); render(true); },
    labAnsText: d => { const i = cur(), v = ((document.getElementById("lab-txt") || {}).value || "").trim(); if (!i) return; if (!v) { toast("Tulis jawabannya, atau pilih Lewati / Nggak tahu", "err"); return; } save(LB.answer(i, d.k, v.slice(0, 200))); render(true); },
    labSkip: d => { const i = cur(); if (!i) return; save(LB.answer(i, d.k, null, d.s === "unknown" ? "unknown" : "skipped")); render(true); },
    labReopen: d => { const i = cur(); if (!i) return; save(LB.reopen(i, d.k)); render(true); },
    labEditQ: () => { LAB.editQ = !LAB.editQ; render(true); },
    labEditType: () => { LAB.editType = true; render(true); },
    labSaveQ: () => {
      const i = cur(), v = ((document.getElementById("lab-eq") || {}).value || "").trim(); if (!i || v.length < 5) return;
      const o = Object.assign({}, i, { updatedAt: new Date().toISOString() }); if (v !== i.question) o.questionEdited = v; else delete o.questionEdited;
      save(o); LAB.editQ = false; render(true); toast("Pertanyaan diperbarui", "ok");
    },
    labSaveNotes: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { notes: ((document.getElementById("lab-notes") || {}).value || "").slice(0, 2000), updatedAt: new Date().toISOString() })); toast("Catatan tersimpan", "ok"); },
    labClose: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { status: i.status === "closed" ? "draft" : "closed", updatedAt: new Date().toISOString() })); render(true); toast(i.status === "closed" ? "Investigasi dibuka lagi" : "Investigasi diarsipkan"); },
    labAnalyze: () => {
      const i = cur(); if (!i) return;
      const now = new Date().toISOString(), key = LB.answersKey(i);
      const snaps = results(i).map(r => Object.assign(AN.snapshot(r), { answersKey: key, createdAt: now }));
      save(Object.assign({}, i, { snapshots: snaps, status: "scoped", updatedAt: now })); LAB.sel = {}; render(true);
      toast(`Analisis selesai · ${snaps.length} hasil disimpan`, "ok");
      setTimeout(() => { const f = document.querySelector('[data-tour="lab-findings"]'); if (f) f.scrollIntoView({ block: "start", behavior: WRI_MOTION.reduced() ? "auto" : "smooth" }); }, 30);
    },
    labExport: () => { const i = cur(); if (!i) return; const sc = LB.nextQuestion(i, S.shoes) ? null : LB.scope(i, S); offerFile(`werunit-lab-${i.id}.json`, JSON.stringify(Object.assign(LB.exportJson(i, sc), { sources: i.sources || [] }), null, 2)); },
    labDelete: () => { const i = cur(); if (!i) return; M = { kind: "confirm", title: "Hapus investigasi ini?", msg: "Pertanyaan, jawaban, snapshot analisis, sumber tersimpan dan catatanmu untuk investigasi ini dihapus dari perangkat dan akun. Data lari kamu nggak kena. Mau simpan dulu? Pakai tombol Export.", ok: "labDeleteOk", okId: i.id, okLabel: "Hapus", danger: true }; render(true); },
    labDeleteOk: d => { const o = Object.assign({}, S.lab); delete o[d.id]; S.lab = o; persist(); M = null; LAB.open = null; render(false); toast("Investigasi dihapus", "ok"); },
    labRange: d => { LAB.range = +d.v || 12; LAB.sel.weekly = null; swap("lab-ev", evidence()); },
    labCompView: d => { LAB.cview = d.v === "time" ? "time" : "spread"; redrawChart("compare"); },
    labCompHide: d => { const k = d.g === "b" ? "b" : "a", o = k === "a" ? "b" : "a"; LAB.chide[k] = !LAB.chide[k]; if (LAB.chide[k] && LAB.chide[o]) LAB.chide[o] = false; const r = LAB.live.compare, sel = LAB.sel.compare; if (r && sel != null && LAB.chide[sel < r.series.a.length ? "a" : "b"]) LAB.sel.compare = null; redrawChart("compare"); },
    labBand: d => { LAB.band = d.v; LAB.sel.trend = null; const r = LAB.live.trend; if (!r) return; const box = document.getElementById("ch-trend"); if (box) { box.innerHTML = findingChart(r, isLead("trend")); if (typeof mountSegPills === "function") mountSegPills(box); } const ro = document.getElementById("ro-trend"); if (ro) ro.innerHTML = readout(r); },
    chartSel: d => {
      const id = d.chart, i = +d.i; LAB.sel[id] = LAB.sel[id] === i ? null : i;
      if (id === "weekly" && !LAB.open) { swap("lab-ev", evidence()); return; }
      const r = LAB.live[id]; if (!r) return;
      const box = document.getElementById("ch-" + id); if (box) { box.innerHTML = findingChart(r, isLead(id)); if (typeof mountSegPills === "function") mountSegPills(box); }
      const ro = document.getElementById("ro-" + id); if (ro) ro.innerHTML = readout(r);
      const m = document.querySelector(`#ch-${id} [data-act="chartSel"][data-i="${i}"]`); if (m) m.focus({ preventScroll: true });
    },
    labResearch: async () => {
      const i = cur(), R = window.WRI_RESEARCH; if (!i || !R) return;
      const offline = !isOnline(), again = !!(LAB.research.results && LAB.research.inv === i.id);
      LAB.research = { busy: true, err: "", results: null, inv: i.id }; swap("lab-research", researchPanel(i));
      try {
        const r = await R.search(R.queryFor(i, LAB.lastResults || []), { offline, force: again && !offline });
        const failed = r.origin === "none";
        LAB.research = { busy: false, err: failed ? (offline ? "Kamu sedang offline dan belum ada hasil tersimpan untuk pertanyaan ini. Sumber yang sudah disimpan tetap bisa dibuka." : "Pencarian riset gagal: " + r.errors.join(" ")) : "",
          notes: failed ? [] : r.errors, results: failed ? null : r.items, inv: i.id, origin: r.origin, offline, cache: r.cachedAt ? fmtWhen(r.cachedAt) : "" };
        if (!failed) toast(r.items.length ? `${r.items.length} sumber${r.origin === "live" ? " ditemukan" : " dari hasil tersimpan"}` : "Tidak ada riset yang cukup relevan");
      }
      catch (e) { LAB.research = { busy: false, err: "Pencarian riset gagal: " + String(e && e.message || e).slice(0, 120), results: null, inv: i.id }; }
      if (LAB.research.err) toast("Pencarian riset gagal", "err");
      const n = cur(); if (n) swap("lab-research", researchPanel(n));
    },
    labSaveSrc: d => { const i = cur(); if (!i || !LAB.research.results) return; const x = LAB.research.results.find(r => r.id === d.id); if (!x) return; const list = (i.sources || []).filter(s => s.id !== x.id).concat([window.WRI_RESEARCH.toSaved(x)]).slice(-12); save(Object.assign({}, i, { sources: list, updatedAt: new Date().toISOString() })); swap("lab-research", researchPanel(cur())); toast("Sumber disimpan ke investigasi", "ok"); },
    labUnsave: d => { const i = cur(); if (!i) return; save(Object.assign({}, i, { sources: (i.sources || []).filter(s => s.id !== d.id), updatedAt: new Date().toISOString() })); swap("lab-research", researchPanel(cur())); toast("Sumber dilepas dari investigasi"); }
  });
  Object.assign(LIVE, {
    labType: el => { const i = cur(); if (!i || !LB.TYPES[el.value] || el.value === i.type) return; LAB.editType = false; save(Object.assign({}, i, { type: el.value, typeSource: "user", status: "draft", updatedAt: new Date().toISOString() })); render(true); }
  });
  function isLead(id) { const el = document.querySelector(`[data-analysis="${id}"]`); return !!(el && el.classList.contains("is-lead")); }
  /* Hover/focus inspection: a small tooltip over the mark (pointer devices); tap/Enter still pins the readout. */
  function tip(mark) {
    const box = mark && mark.closest(".lab-chart"); if (!box) return;
    let t = box.querySelector(".ch-tip"); if (!t) { t = document.createElement("div"); t.className = "ch-tip"; t.setAttribute("aria-hidden", "true"); box.appendChild(t); }
    t.textContent = mark.getAttribute("aria-label") || "";
    const mb = mark.getBoundingClientRect(), bb = box.getBoundingClientRect();
    const x = Math.min(Math.max(mb.left + mb.width / 2 - bb.left, 70), bb.width - 70);
    t.style.left = x + "px"; t.style.top = Math.max(0, mb.top - bb.top - 8) + "px"; t.classList.add("on");
  }
  const untip = box => { const t = box && box.querySelector(".ch-tip.on"); if (t) t.classList.remove("on"); };
  document.addEventListener("pointerover", e => { if (e.pointerType === "touch") return; const m = e.target.closest && e.target.closest(".lab-chart .ch-mark"); if (m) tip(m); });
  document.addEventListener("pointerout", e => { const m = e.target.closest && e.target.closest(".lab-chart .ch-mark"); if (m && !(e.relatedTarget && m.contains(e.relatedTarget))) untip(m.closest(".lab-chart")); });
  document.addEventListener("focusin", e => { const m = e.target.closest && e.target.closest(".lab-chart .ch-mark"); if (m && m.matches(":focus-visible")) tip(m); });
  document.addEventListener("focusout", e => { const m = e.target.closest && e.target.closest(".lab-chart .ch-mark"); if (m) untip(m.closest(".lab-chart")); });
  document.addEventListener("input", e => { if (e.target && e.target.id === "lab-q") LAB.draft = e.target.value.slice(0, 500); });
  document.addEventListener("keydown", e => { const t = e.target; if ((e.key === "Enter" || e.key === " ") && t && t.matches && t.matches('[data-act="chartSel"]')) { e.preventDefault(); ACT.chartSel(t.dataset); } });
  if (typeof TUT !== "undefined" && TUT.HELP) TUT.HELP.lab = { tour: "dashboard", title: "Lab", what: "Ajukan pertanyaan tentang larimu. Lab bertanya satu hal setiap kali, menunjukkan data mana yang dipakai, lalu menghitung analisis dari catatanmu sendiri.", why: "Jawaban berdasar datamu sendiri dan riset yang jelas sumbernya, bukan tebakan.", how: ["Tulis pertanyaan atau pilih contoh.", "Jawab pertanyaan lanjutan, atau Nggak tahu / Lewati.", "Cek bukti: lari yang dipakai, data yang hilang.", "Jalankan analisis, lalu cari riset terkait."], ex: "“Apakah aku lebih efisien lari pagi atau malam?” → 8 minggu → jam lari → pace.", warn: "Konsultasi AI belum diatur. Lab bukan alat diagnosis." };
})();
