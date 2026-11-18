/* RUNLAB Lab workspace (M1.5 redesign + M2 analyses + M3 research hook). Shares app globals.
 * Pure logic: js/lab/lab.js (WRI_LAB), js/lab/analysis.js (WRI_ANALYSIS), js/lab/charts.js (WRI_CHARTS),
 * js/lab/research.js (WRI_RESEARCH). Dock: Hari ini · Lab · Lari · Kamu; Race lives under Kamu + the Hari ini chip.
 * Honesty: capability states reflect runtime; analyses show method, record set, exclusions and adequacy; nothing is faked.
 */
(function () {
  "use strict";
  const LB = WRI_LAB, AN = WRI_ANALYSIS, CH = WRI_CHARTS;
  const LAB = { open: null, editQ: false, editType: false, draft: "", range: 12, sel: {}, band: null, live: {}, research: { busy: false, err: "", results: null, q: "" } };

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
  const capStrip = () => `<div class="lab-caps" role="list" aria-label="Kemampuan Lab">${caps().map(c => `<div class="lab-cap ${c.st}" role="listitem" data-cap="${c.k}"><i class="lab-led" aria-hidden="true"></i><span><b>${c.l}</b><span class="xs mu">${CAPW[c.st]} · ${c.d}</span></span></div>`).join("")}</div>`;
  function swap(id, html) { const el = document.getElementById(id); if (!el) return; el.outerHTML = html; const n = document.getElementById(id); if (n && typeof mountSegPills === "function") mountSegPills(n); }

  /* ---------- evidence panel (Lab home) ---------- */
  function evidence() {
    const runs = real(), t = todayYmd();
    if (!runs.length) return `<aside class="lab-panel lab-evidence" id="lab-ev" data-tour="lab-evidence"><h2>Bukti kamu</h2>
      <div class="ch-empty tall"><span><b>Belum ada lari tercatat.</b><br>Catat lari pertamamu atau import file GPX/TCX/CSV. Lab hanya memakai data yang benar-benar ada.</span></div>
      <div class="btns"><button class="btn pri" data-act="nav" data-t="integ">${IC.plus} Import lari</button><button class="btn" data-act="quickLog">Catat lari</button></div></aside>`;
    const days = LAB.range * 7, w = { from: AN.addDays(t, -(days - 1)), to: t };
    const wk = AN.weekly(S, w), q = AN.quality(S, w), all = AN.quality(S, { to: t });
    LAB.live.weekly = wk;
    const sel = LAB.sel.weekly, sw = sel !== undefined && sel !== null ? wk.series[sel] : null;
    const src = Object.entries(all.metrics.sources), tot = all.n;
    return `<aside class="lab-panel lab-evidence" id="lab-ev" data-tour="lab-evidence">
      <div class="lab-ph"><h2>Bukti kamu</h2>${segPill("evrange", [["8", "8 mgg"], ["12", "12 mgg"], ["26", "26 mgg"]], String(LAB.range), "labRange")}</div>
      <div class="lab-kpis">
        <div><b class="num">${tot}</b><span>lari tercatat</span></div>
        <div><b class="num">${kmf(wk.metrics.totalKm)}</b><span>km · ${LAB.range} mgg</span></div>
        <div><b class="num">${all.metrics.latest ? CH.dlabel(all.metrics.latest) : "–"}</b><span>data terakhir</span></div></div>
      <div class="lab-chart" id="ch-weekly">${CH.weekly(wk.series, { sel, w: 380, h: 190 })}</div>
      <p class="ch-readout" aria-live="polite">${sw ? `<b>Minggu ${CH.dlabel(sw.start)}</b> · ${sw.runs ? `${kmf(sw.km)} km dari ${sw.runs} lari${sw.minutes ? `, ${sw.minutes} menit tercatat` : ""}${sw.logged === "partial" ? " · sebagian tanpa durasi" : ""}${sw.strength ? ` · ${sw.strength} strength` : ""}` : "tidak ada lari tercatat (belum tentu tidak lari)"}` : "Ketuk batang untuk detail minggu."}</p>
      <h3>Kelengkapan data · ${LAB.range} mgg</h3>${CH.coverage(q.metrics.coverage)}
      <h3>Asal data · semua lari</h3><div class="lab-src" role="list">${src.map(([k, v]) => `<span role="listitem" style="flex:${v}" title="${esc(k)}: ${v}"><i></i>${esc(k)} <b class="num">${v}</b></span>`).join("")}</div>
      ${all.metrics.flags.length ? `<p class="xs mu" style="margin-top:8px">${all.metrics.flags.length} nilai perlu dicek (tidak diubah otomatis). Lihat di investigasi “kualitas data”.</p>` : ""}
    </aside>`;
  }

  /* ---------- Lab home ---------- */
  function vLabHome() {
    const list = all(), paces = real().filter(l => l.distance > 0 && l.duration > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-24).map(l => l.duration / l.distance);
    const tiles = LB.STARTERS.map((q, i) => { const c = LB.classify(q); return `<button class="lab-tile${LAB.draft === q ? " sel" : ""}" data-act="labStarter" data-i="${i}" aria-pressed="${LAB.draft === q}">${ico(c.type)}<span class="xs mu">${esc(LB.TYPES[c.type].l)}</span><span class="lab-tile-q">${esc(q)}</span></button>`; }).join("");
    const inv = i => { const st = LB.stage(i, S.shoes), steps = LB.steps(i, S.shoes), done = steps.filter(s => i.answers[s.k]).length; return `<button class="lab-inv" data-act="labOpen" data-id="${esc(i.id)}">${ico(i.type)}<span class="grow"><span class="lab-badge st-${st}">${esc(LB.STAGES[st])}</span><span class="lab-q">${esc(qOf(i))}</span><span class="lab-prog" aria-label="${done} dari ${steps.length} pertanyaan dijawab"><i style="width:${Math.round(done / Math.max(1, steps.length) * 100)}%"></i></span><span class="xs mu">${esc(LB.TYPES[i.type].l)} · ${fmtWhen(i.updatedAt)}</span></span></button>`; };
    return `<div class="lab2">
      <div class="lab-main">
        <header class="lab-hero"><div class="lh-txt"><p class="lab-kick">Personal Running Lab</p><h1>Ajukan pertanyaan yang lebih baik tentang larimu.</h1>
          <p class="lab-sub">Lab membaca catatan larimu sendiri, menunjukkan apa yang bisa dan belum bisa dijawab, lalu membantumu memutuskan apa yang diuji berikutnya.</p></div>
          ${CH.trace(paces)}<span class="lh-help">${helpBtn("lab")}</span></header>
        <section class="lab-panel lab-compose" data-tour="lab-new"><label for="lab-q" class="lab-lbl">Pertanyaanmu</label>
          <div class="lab-composer"><textarea id="lab-q" rows="2" maxlength="500" placeholder="misal: Kenapa pace-ku nggak membaik padahal lari lebih banyak?">${esc(LAB.draft)}</textarea>
          <button class="btn pri lab-go" data-act="labCreate"><span>Mulai investigasi</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
          <p class="lab-lbl" style="margin-top:14px">Atau mulai dari contoh</p><div class="lab-tiles">${tiles}</div></section>
        ${capStrip()}
        <section class="lab-sec"><div class="lab-ph"><h2>Investigasi</h2><span class="xs mu">${list.length ? `${list.length} tersimpan · privat` : "privat, hanya di akunmu"}</span></div>
          ${list.length ? `<div class="lab-invs">${list.map(inv).join("")}</div>` : `<div class="ch-empty"><span>Belum ada investigasi. Tulis pertanyaan di atas: Lab akan bertanya satu hal setiap kali.</span></div>`}</section>
        <section class="lab-sec"><h2>Alat Lab</h2>
          <div class="lab-tool" aria-disabled="true" data-tour="lab-compiler"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/></svg></span><span class="grow"><b>Workout Compiler</b><br><span class="xs mu">Mengubah resep latihan jadi langkah terstruktur yang bisa dicek. Belum bisa dipakai.</span></span><span class="chip">Segera hadir</span></div></section>
      </div>
      ${evidence()}
    </div>`;
  }

  /* ---------- investigation ---------- */
  const STEPS = [["ask", "Tanya"], ["context", "Konteks"], ["evidence", "Bukti"], ["findings", "Temuan"], ["experiment", "Eksperimen"]];
  function stepper(inv) {
    const st = LB.stage(inv, S.shoes), steps = LB.steps(inv, S.shoes), done = steps.filter(s => inv.answers[s.k]).length;
    const at = st === "draft" || st === "context" ? 1 : st === "ready" ? 2 : 3;
    return `<ol class="lab-steps" aria-label="Tahap investigasi">${STEPS.map(([k, l], i) => { const state = k === "experiment" ? "locked" : i < at ? "done" : i === at ? "now" : "todo"; return `<li class="${state}"${state === "now" ? ' aria-current="step"' : ""}><i>${state === "done" ? "✓" : i + 1}</i><span>${l}${k === "context" ? ` <small>${done}/${steps.length}</small>` : k === "experiment" ? " <small>nanti</small>" : ""}</span></li>`; }).join("")}</ol>`;
  }
  const ansText = (s, a) => !a ? "" : a.state === "skipped" ? "dilewati" : a.state === "unknown" ? "nggak tahu" : ((s.opts || []).find(x => String(x.v) === String(a.v)) || { l: String(a.v) }).l;
  function askCard(q) {
    return `<section class="lab-panel lab-ask" data-tour="lab-ask" aria-live="polite"><p class="lab-kick">Pertanyaan lanjutan</p><h2>${esc(q.q)}</h2>
      <details class="lab-why"><summary>Kenapa ditanya?</summary><p class="sm">${esc(q.why)}</p></details>
      ${q.text ? `<label class="sr-only" for="lab-txt">${esc(q.q)}</label><input type="text" id="lab-txt" maxlength="200" placeholder="${esc(q.ph || "")}"><button class="btn pri" style="margin-top:10px" data-act="labAnsText" data-k="${q.k}">Simpan jawaban</button>`
        : (q.opts && q.opts.length ? `<div class="lab-opts" role="group" aria-label="${esc(q.q)}">${q.opts.map(o => `<button class="lab-opt" data-act="labAns" data-k="${q.k}" data-v="${esc(String(o.v))}"><span>${esc(o.l)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`).join("")}</div>` : `<div class="ch-empty"><span>Belum ada pilihan: tambahkan sepatu dulu di Kamu → Sepatu, atau lewati.</span></div>`)}
      <div class="lab-alt"><button class="btn ghost" data-act="labSkip" data-k="${q.k}" data-s="unknown">Nggak tahu</button><button class="btn ghost" data-act="labSkip" data-k="${q.k}" data-s="skipped">Lewati</button></div></section>`;
  }
  function evidenceCard(inv, sc) {
    const inc = sc.included.length, exc = sc.excluded.length, reasons = {};
    sc.excluded.forEach(e => { reasons[e.reason] = (reasons[e.reason] || 0) + 1; });
    const win = sc.window.days ? `${fmtD(sc.window.from)} – ${fmtD(sc.window.to)}` : `semua data sampai ${fmtD(sc.window.to)}`;
    const snaps = (inv.snapshots || []), fresh = snaps.filter(s => LB.snapshotFresh(inv, s));
    return `<section class="lab-panel" data-tour="lab-scope" id="lab-scope"><p class="lab-kick">Bukti · rencana analisis</p><h2>${inc} lari masuk analisis</h2>
      <p class="sm mu">${esc(win)}${sc.window.days ? ` · ${sc.window.days} hari` : ""}</p>
      <div class="lab-split" role="img" aria-label="${inc} lari dipakai, ${exc} tidak dipakai"><i class="in" style="flex:${Math.max(inc, 0.0001)}"></i><i class="out" style="flex:${Math.max(exc, 0.0001)}"></i></div>
      <div class="ch-legend"><span><i class="lg sa"></i>dipakai ${inc}</span><span><i class="lg none"></i>tidak dipakai ${exc}</span></div>
      ${exc ? `<details class="lab-why"><summary>Kenapa ${exc} lari tidak dipakai</summary><ul class="sm">${Object.entries(reasons).map(([r, n]) => `<li>${n} · ${esc(r)}</li>`).join("")}</ul></details>` : ""}
      <h3>Kelengkapan data</h3>${CH.coverage(sc.coverage)}
      ${sc.missingNeeded.length ? `<div class="note warn" style="margin-top:10px">Belum ada: ${sc.missingNeeded.map(esc).join(", ")}. Lab nggak menebak nilai yang hilang. ${sc.missingNeeded.some(m => /Durasi|Pace/.test(m)) ? "Tambahkan durasi di lari yang tercatat (Lari → buka lari → Edit) atau import file." : ""}</div>` : ""}
      ${sc.strava.n ? `<p class="xs mu" style="margin-top:6px">${sc.strava.n} lari berasal dari Strava: dipakai untuk hitungan di perangkatmu, tapi tidak akan pernah dikirim ke AI.</p>` : ""}
      <h3>Yang akan dihitung</h3><p class="sm">${esc(sc.plan)}</p>
      <h3>Bisa mengacaukan hasil</h3><div class="lab-chips">${sc.confounders.map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>
      <div class="lab-run"><button class="btn pri" data-act="labAnalyze">${fresh.length ? "Hitung ulang" : "Jalankan analisis"}</button>
        <span class="xs mu">${fresh.length ? `Snapshot ${fmtWhen(fresh[0].createdAt)} · ${fresh.map(s => s.methodVersion).join(", ")}` : snaps.length ? "Snapshot lama tidak cocok lagi dengan jawabanmu: hitung ulang." : "Dihitung di perangkatmu. Hasil disimpan sebagai snapshot dengan versi metode."}</span></div></section>`;
  }
  /** Deterministic sentences from metrics (no generation, careful wording). */
  function sentence(r) {
    const m = r.metrics;
    if (r.analysisId === "weekly") return `Dalam ${m.weeks} minggu, ${m.activeWeeks} minggu ada lari tercatat; median ${m.medianWeekKm === null ? "–" : kmf(m.medianWeekKm)} km per minggu aktif. ${m.emptyWeeks} minggu tanpa catatan (belum tentu tidak lari).`;
    if (r.analysisId === "trend") { const ok = m.bands.filter(b => b.verdict !== "insufficient"); if (!ok.length) return "Belum cukup lari sebanding (butuh minimal 3 lari per paruh periode di rentang jarak yang sama)."; return ok.map(b => `${b.band}: median ${pace(b.late.median)} /km di paruh akhir vs ${pace(b.early.median)} /km di paruh awal (${b.verdict === "flat" ? "praktis sama" : `${Math.abs(b.diff)} dtk/km lebih ${b.verdict === "faster" ? "cepat" : "lambat"}`}; n ${b.early.n}/${b.late.n}).`).join(" "); }
    if (r.analysisId === "compare") return m.diff === null ? `Belum cukup lari di kedua kelompok (${m.labels.a}: ${m.a.n}, ${m.labels.b}: ${m.b.n}; butuh minimal 3 per kelompok).` : `${m.labels.a}: median ${pace(m.a.median)} /km (n ${m.a.n}). ${m.labels.b}: median ${pace(m.b.median)} /km (n ${m.b.n}). Selisih ${Math.abs(m.diff)} dtk/km${m.distanceGap ? `, dengan selisih jarak median ${kmf(Math.abs(m.distanceGap))} km` : ""}.`;
    const c = Object.fromEntries(m.coverage.map(x => [x.k, x])); return `${r.n} lari; durasi ada di ${c.duration.n}/${r.n}, detak jantung ${c.hr.n}/${r.n}, jam mulai ${c.start.n}/${r.n}. ${m.flags.length} nilai ditandai untuk dicek.`;
  }
  const ADQ = { adequate: "Data cukup", limited: "Data terbatas", insufficient: "Belum cukup data" };
  const narrow = () => (window.innerWidth || 1024) < 700;          // phones get a narrower viewBox so labels stay legible
  function findingChart(r) {
    const sel = LAB.sel[r.analysisId], N = narrow();
    if (r.analysisId === "weekly") return CH.weekly(r.series, { sel, w: N ? 360 : 640, h: N ? 200 : 220 });
    if (r.analysisId === "trend") {
      const bands = r.metrics.bands; if (!bands.length) return CH.trend([], null);
      const b = bands.find(x => x.band === LAB.band) || bands.find(x => x.verdict !== "insufficient") || bands[0];
      return `${bands.length > 1 ? segPill("trendband", bands.map(x => [x.band, x.band]), b.band, "labBand") : ""}${CH.trend(r.series, Object.assign({}, b, { splitDate: r.metrics.splitDate }), { sel, w: N ? 360 : 640, h: N ? 230 : 240 })}`;
    }
    if (r.analysisId === "compare") return CH.compare(r.metrics, r.series, { sel, w: N ? 360 : 640, h: 170 });
    return CH.coverage(r.metrics.coverage);
  }
  function readout(r) {
    const i = LAB.sel[r.analysisId]; if (i === undefined || i === null) return "Ketuk titik atau batang untuk detail dan buka lari aslinya.";
    let p = null;
    if (r.analysisId === "weekly") { const w = r.series[i]; return w ? `Minggu ${CH.dlabel(w.start)}: ${w.runs ? `${kmf(w.km)} km, ${w.runs} lari` : "tidak ada lari tercatat"}` : ""; }
    if (r.analysisId === "trend") { const b = LAB.band, pts = r.series.filter(x => !b || x.band === (r.metrics.bands.find(y => y.band === b) || r.metrics.bands.find(y => y.verdict !== "insufficient") || r.metrics.bands[0] || {}).band); p = pts[i]; }
    if (r.analysisId === "compare") p = r.series.a.concat(r.series.b)[i];
    return p ? `<b>${CH.dlabel(p.date)}</b> · ${kmf(p.km)} km · ${pace(p.pace)} /km <button class="link sm" data-act="editLog" data-id="${esc(p.id)}">Buka lari</button>` : "";
  }
  function findingCard(r) {
    const ex = {}; r.excluded.forEach(e => { ex[e.reason] = (ex[e.reason] || 0) + 1; });
    return `<article class="lab-panel lab-find" data-analysis="${r.analysisId}">
      <div class="lab-ph"><h3>${{ weekly: "Volume mingguan", trend: "Tren pace per rentang jarak", compare: "Perbandingan dua kelompok", quality: "Kualitas & kelengkapan data" }[r.analysisId]}</h3><span class="lab-adq ${r.adequacy}">${ADQ[r.adequacy]}</span></div>
      <p class="lab-sent">${esc(sentence(r))}</p>
      <div class="lab-chart" id="ch-${r.analysisId}">${findingChart(r)}</div>
      ${r.analysisId !== "quality" ? `<p class="ch-readout" id="ro-${r.analysisId}" aria-live="polite">${readout(r)}</p>` : r.metrics.flags.length ? `<details class="lab-why"><summary>${r.metrics.flags.length} nilai perlu dicek</summary><ul class="sm">${r.metrics.flags.slice(0, 20).map(f => `<li>${esc(f.note)} <button class="link sm" data-act="editLog" data-id="${esc(f.id)}">Buka</button></li>`).join("")}</ul></details>` : ""}
      <details class="lab-method"><summary>Metode, data & batasan <span class="xs mu">${esc(r.methodVersion)} · n ${r.n}</span></summary>
        <dl class="sm"><dt>Periode</dt><dd>${r.window.from ? fmtD(r.window.from) : "awal data"} – ${fmtD(r.window.to)}</dd><dt>Cara hitung</dt><dd>${esc(r.method)}</dd>
        ${r.assumptions.length ? `<dt>Asumsi</dt><dd>${r.assumptions.map(esc).join(" ")}</dd>` : ""}<dt>Batasan</dt><dd>${r.limitations.map(esc).join(" ")}</dd>
        <dt>Tidak dipakai</dt><dd>${Object.keys(ex).length ? Object.entries(ex).map(([k, n]) => `${n} (${esc(k)})`).join(", ") : "–"}</dd>
        ${r.missingFields.length ? `<dt>Data hilang</dt><dd>${r.missingFields.map(esc).join(", ")}</dd>` : ""}<dt>Satuan</dt><dd>${Object.values(r.units).map(esc).join(" · ") || "–"}</dd></dl></details></article>`;
  }
  function results(inv) {
    const sc = LB.scope(inv, S), w = { from: sc.window.from, to: sc.window.to };
    const shoes = S.shoes || [], nm = id => (shoes.find(s => s.id === id) || {}).name;
    return AN.plan(inv).map(([id, opts]) => AN.run(id, S, w, Object.assign({}, opts, { shoeAName: nm(opts.shoeA), shoeBName: nm(opts.shoeB) })));
  }
  function researchPanel(inv) {
    const R = window.WRI_RESEARCH, st = LAB.research, saved = inv.sources || [];
    const online = isOnline(), list = st.results && st.inv === inv.id ? st.results : null;
    const card = (x, savedOne) => `<li class="lab-src-card"><div class="lab-ph"><span class="lab-badge">${esc(x.kindLabel || x.kind || "artikel")}</span><span class="xs mu">${esc(x.provider)}${x.year ? ` · ${x.year}` : ""}</span></div>
      <a class="lab-src-t" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>
      <p class="xs mu">${esc((x.authors || []).slice(0, 3).join(", "))}${(x.authors || []).length > 3 ? " dkk." : ""}${x.journal ? ` · ${esc(x.journal)}` : ""}${x.pmid ? ` · PMID ${esc(x.pmid)}` : ""}${x.doi ? ` · DOI ${esc(x.doi)}` : ""}</p>
      ${x.excerpt ? `<details class="lab-why"><summary>Kutipan abstrak</summary><p class="sm">${esc(x.excerpt)}</p></details>` : ""}
      ${x.why ? `<p class="xs mu">Kenapa muncul: ${esc(x.why)}</p>` : ""}
      ${savedOne ? `<button class="btn sm ghost" data-act="labUnsave" data-id="${esc(x.id)}">Lepas dari investigasi</button>` : `<button class="btn sm" data-act="labSaveSrc" data-id="${esc(x.id)}">Simpan ke investigasi</button>`}</li>`;
    return `<section class="lab-panel" id="lab-research" data-tour="lab-research"><div class="lab-ph"><h3>Riset terbitan</h3><span class="xs mu">${online ? "PubMed · OpenAlex" : "offline"}</span></div>
      <p class="xs mu">Hanya metadata dan abstrak dari sumber terbuka. Lab tidak pernah mengarang judul, penulis, atau hasil. Kutipan abstrak adalah teks asli sumber.</p>
      ${saved.length ? `<h4>Tersimpan di investigasi ini</h4><ul class="lab-srcs">${saved.map(x => card(x, true)).join("")}</ul>` : ""}
      ${!R ? `<p class="sm mu">Modul riset tidak tersedia.</p>` : `<div class="lab-run"><button class="btn${saved.length ? "" : " pri"}" data-act="labResearch" ${st.busy ? "disabled" : ""}>${st.busy ? "Mencari…" : list ? "Cari lagi" : "Cari riset terkait"}</button><span class="xs mu">Kata kunci: ${esc(R.queryFor(inv, LAB.lastResults || []).text)}</span></div>`}
      ${st.err && st.inv === inv.id ? `<div class="note warn" style="margin-top:8px">${esc(st.err)}</div>` : ""}
      ${list ? (list.length ? `<ul class="lab-srcs">${list.filter(x => !saved.some(s => s.id === x.id)).map(x => card(x, false)).join("")}</ul>${st.cache ? `<p class="xs mu">Dari cache ${esc(st.cache)}.</p>` : ""}` : `<p class="sm">Tidak ada riset yang cukup relevan ditemukan untuk kata kunci ini. Itu hasil yang sah.</p>`) : ""}</section>`;
  }
  /** AI consultation: credential-gated. Shows exactly what would be sent, and that nothing is sent today. */
  function aiPanel(inv, res) {
    const C = window.WRI_CONSULT; if (!C) return "";
    const st = C.status(window.HMTP_LAB_AI || null), prev = C.buildPayload(inv, S, res, C.CATEGORIES.map(c => c.k));
    return `<section class="lab-panel lab-locked" data-tour="lab-ai"><div class="lab-ph"><h3>Konsultasi AI</h3><span class="lab-badge">${st === "configured" ? "Siap" : "Belum diatur"}</span></div>
      <p class="sm">${st === "configured" ? "" : "Belum aktif: butuh server aman dan kunci API milik pemilik app. Tidak ada data yang dikirim, dan tidak ada jawaban AI palsu."}</p>
      <details class="lab-why"><summary>Yang akan dikirim kalau nanti diaktifkan (dengan izinmu)</summary>
        <ul class="sm">${C.CATEGORIES.map(c => `<li><label><input type="checkbox" disabled ${c.k === "hr" ? "" : "checked"}> ${esc(c.l)}</label></li>`).join("")}</ul>
        <p class="xs mu">Tidak pernah dikirim: catatan pribadi, nama, email, rute/GPS, data teman${prev.excluded.strava ? `, dan ${prev.excluded.strava} lari dari Strava (aturan Strava melarang pemakaian AI)` : ", dan lari dari Strava"}.</p></details></section>`;
  }
  function vInvestigation(inv) {
    const shoes = S.shoes || [], st = LB.steps(inv, shoes), next = LB.nextQuestion(inv, shoes), T = LB.TYPES[inv.type], stage = LB.stage(inv, shoes);
    const answered = st.filter(s => inv.answers[s.k]);
    const sc = next ? null : LB.scope(inv, S);
    const fresh = (inv.snapshots || []).filter(s => LB.snapshotFresh(inv, s));
    const res = !next && fresh.length ? results(inv) : null; LAB.lastResults = res || [];
    if (res) res.forEach(r => { LAB.live[r.analysisId] = r; });
    const changed = res && fresh.some(snp => { const r = res.find(x => x.analysisId === snp.analysisId); return r && JSON.stringify(r.includedRecordIds.slice(0, 400)) !== JSON.stringify(snp.includedRecordIds); });
    return `<div class="lab2 inv">
      <div class="lab-main">
        <div class="lab-topbar"><button class="back" data-act="labBack">‹ Lab</button><span class="lab-badge st-${stage}">${esc(LB.STAGES[stage])}</span>
          <span class="lab-acts"><button class="icbtn" data-act="labExport" aria-label="Export investigasi (JSON)" title="Export"><svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg></button><button class="icbtn" data-act="labClose" aria-label="${inv.status === "closed" ? "Buka lagi" : "Arsipkan"}" title="${inv.status === "closed" ? "Buka lagi" : "Arsipkan"}"><svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM2 3h20v4H2zM10 12h4"/></svg></button><button class="icbtn danger" data-act="labDelete" aria-label="Hapus investigasi" title="Hapus"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button></span></div>
        <header class="lab-head" data-tour="lab-question">${ico(inv.type, "big")}
          ${LAB.editQ ? `<label class="sr-only" for="lab-eq">Ubah pertanyaan</label><textarea id="lab-eq" rows="3" maxlength="500">${esc(qOf(inv))}</textarea><div class="btns"><button class="btn sm pri" data-act="labSaveQ">Simpan</button><button class="btn sm ghost" data-act="labEditQ">Batal</button></div>`
            : `<h1 class="lab-title">${esc(qOf(inv))}</h1>${inv.questionEdited ? `<p class="xs mu">Pertanyaan asli: ${esc(inv.question)}</p>` : ""}`}
          <div class="lab-type"><span class="chip">${esc(T.l)}</span><span class="xs mu">${inv.typeSource === "user" ? "dipilih kamu" : inv.matched.length ? "dikenali dari: " + inv.matched.map(esc).join(", ") : "tebakan awal"}</span>
            ${LAB.editQ ? "" : `<button class="link sm" data-act="labEditQ">Ubah pertanyaan</button>`}${LAB.editType ? "" : `<button class="link sm" data-act="labEditType">Ganti jenis</button>`}</div>
          ${LAB.editType ? `<div class="field" style="margin-top:8px"><label for="lab-type">Jenis investigasi</label><select id="lab-type" data-live="labType">${Object.entries(LB.TYPES).map(([k, t]) => `<option value="${k}" ${k === inv.type ? "selected" : ""}>${esc(t.l)}: ${esc(t.d)}</option>`).join("")}</select></div>` : ""}
          ${stepper(inv)}</header>
        ${next ? askCard(next) : ""}
        ${res ? `<section class="lab-findings" data-tour="lab-findings"><div class="lab-ph"><h2>Temuan · datamu</h2>${changed ? `<span class="lab-badge st-context">Data berubah sejak snapshot</span>` : ""}</div>${res.map(findingCard).join("")}</section>
          ${researchPanel(inv)}
          ${aiPanel(inv, res)}
          <section class="lab-panel"><h3>Kemungkinan penjelasan</h3><p class="sm">Lab belum membuat penjelasan otomatis: itu butuh konsultasi AI yang <b>belum diatur</b>. Hal-hal ini bisa ikut menjelaskan pola di atas dan <b>belum diuji</b>:</p><div class="lab-chips">${sc.confounders.map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div><p class="xs mu" style="margin-top:6px">Punya dugaan sendiri? Tulis di Catatan di bawah.</p></section>
          <section class="lab-panel"><h3>Yang belum bisa disimpulkan</h3><ul class="sm lab-conf"><li>Ini pola dari catatanmu sendiri, bukan bukti sebab-akibat.</li>${res.filter(r => r.adequacy !== "adequate").map(r => `<li>${esc(ADQ[r.adequacy])} untuk ${esc({ weekly: "volume mingguan", trend: "tren pace", compare: "perbandingan", quality: "kualitas data" }[r.analysisId])} (n ${r.n}).</li>`).join("")}${[...new Set(res.flatMap(r => r.missingFields))].map(f => `<li>Tanpa data ${esc(f)}.</li>`).join("")}</ul></section>
          <section class="lab-panel lab-locked"><h3>Eksperimen berikutnya</h3><p class="sm mu">Merancang eksperimen pribadi (satu variabel, baseline vs periode uji) hadir di tahap berikutnya. Belum aktif.</p></section>` : ""}
      </div>
      <aside class="lab-side">
        ${sc ? evidenceCard(inv, sc) : ""}
        ${answered.length ? `<section class="lab-panel lab-answers"><h3>Jawabanmu</h3>${answered.map(s => `<button class="lab-ans" data-act="labReopen" data-k="${s.k}" aria-label="Ubah jawaban: ${esc(s.q)}"><span class="xs mu">${esc(s.q)}</span><b class="${inv.answers[s.k].state !== "answered" ? "mu" : ""}">${esc(ansText(s, inv.answers[s.k]))}</b><span class="lab-edit">Ubah</span></button>`).join("")}<p class="xs mu">Mengubah jawaban juga menghapus jawaban yang bergantung padanya, dan snapshot lama jadi kedaluwarsa.</p></section>` : ""}
        <section class="lab-panel"><h3>Catatanmu</h3><label class="sr-only" for="lab-notes">Catatanmu</label><textarea id="lab-notes" rows="3" maxlength="2000" placeholder="Dugaan, kesimpulan, atau hal yang mau dicoba.">${esc(inv.notes || "")}</textarea><button class="btn sm" data-act="labSaveNotes">Simpan catatan</button></section>
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
      if (q.length < 5) { toast("Tulis pertanyaanmu dulu (minimal 5 huruf)"); const el = document.getElementById("lab-q"); if (el) el.focus(); return; }
      const inv = LB.newInvestigation(q); save(inv); LAB.open = inv.id; LAB.draft = ""; LAB.editQ = LAB.editType = false; LAB.sel = {}; render(false); window.scrollTo(0, 0); toast("Investigasi tersimpan");
    },
    labOpen: d => { LAB.open = d.id; LAB.editQ = LAB.editType = false; LAB.sel = {}; LAB.band = null; S.ui.tab = "lab"; render(false); window.scrollTo(0, 0); },
    labBack: () => { LAB.open = null; LAB.editQ = LAB.editType = false; render(false); },
    labAns: d => { const i = cur(); if (!i) return; const v = /^-?\d+(\.\d+)?$/.test(d.v) ? Number(d.v) : d.v; save(LB.answer(i, d.k, v)); render(true); },
    labAnsText: d => { const i = cur(), v = ((document.getElementById("lab-txt") || {}).value || "").trim(); if (!i) return; if (!v) { toast("Tulis jawabannya, atau pilih Lewati / Nggak tahu"); return; } save(LB.answer(i, d.k, v.slice(0, 200))); render(true); },
    labSkip: d => { const i = cur(); if (!i) return; save(LB.answer(i, d.k, null, d.s === "unknown" ? "unknown" : "skipped")); render(true); },
    labReopen: d => { const i = cur(); if (!i) return; save(LB.reopen(i, d.k)); render(true); },
    labEditQ: () => { LAB.editQ = !LAB.editQ; render(true); },
    labEditType: () => { LAB.editType = true; render(true); },
    labSaveQ: () => {
      const i = cur(), v = ((document.getElementById("lab-eq") || {}).value || "").trim(); if (!i || v.length < 5) return;
      const o = Object.assign({}, i, { updatedAt: new Date().toISOString() }); if (v !== i.question) o.questionEdited = v; else delete o.questionEdited;
      save(o); LAB.editQ = false; render(true); toast("Pertanyaan diperbarui");
    },
    labSaveNotes: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { notes: ((document.getElementById("lab-notes") || {}).value || "").slice(0, 2000), updatedAt: new Date().toISOString() })); toast("Catatan tersimpan"); },
    labClose: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { status: i.status === "closed" ? "draft" : "closed", updatedAt: new Date().toISOString() })); render(true); toast(i.status === "closed" ? "Investigasi dibuka lagi" : "Investigasi diarsipkan"); },
    labAnalyze: () => {
      const i = cur(); if (!i) return;
      const now = new Date().toISOString(), key = LB.answersKey(i);
      const snaps = results(i).map(r => Object.assign(AN.snapshot(r), { answersKey: key, createdAt: now }));
      save(Object.assign({}, i, { snapshots: snaps, status: "scoped", updatedAt: now })); LAB.sel = {}; render(true);
      toast(`Analisis selesai · ${snaps.length} hasil disimpan`);
      setTimeout(() => { const f = document.querySelector('[data-tour="lab-findings"]'); if (f) f.scrollIntoView({ block: "start", behavior: WRI_MOTION.reduced() ? "auto" : "smooth" }); }, 30);
    },
    labExport: () => { const i = cur(); if (!i) return; const sc = LB.nextQuestion(i, S.shoes) ? null : LB.scope(i, S); offerFile(`werunit-lab-${i.id}.json`, JSON.stringify(Object.assign(LB.exportJson(i, sc), { sources: i.sources || [] }), null, 2)); },
    labDelete: () => { const i = cur(); if (!i) return; M = { kind: "confirm", title: "Hapus investigasi ini?", msg: "Pertanyaan, jawaban, snapshot analisis, sumber tersimpan dan catatanmu untuk investigasi ini dihapus dari perangkat dan akun. Data lari kamu nggak kena. Mau simpan dulu? Pakai tombol Export.", ok: "labDeleteOk", okId: i.id, okLabel: "Hapus", danger: true }; render(true); },
    labDeleteOk: d => { const o = Object.assign({}, S.lab); delete o[d.id]; S.lab = o; persist(); M = null; LAB.open = null; render(false); toast("Investigasi dihapus"); },
    labRange: d => { LAB.range = +d.v || 12; LAB.sel.weekly = null; swap("lab-ev", evidence()); },
    labBand: d => { LAB.band = d.v; LAB.sel.trend = null; const r = LAB.live.trend; if (!r) return; const box = document.getElementById("ch-trend"); if (box) { box.innerHTML = findingChart(r); if (typeof mountSegPills === "function") mountSegPills(box); } const ro = document.getElementById("ro-trend"); if (ro) ro.innerHTML = readout(r); },
    chartSel: d => {
      const id = d.chart, i = +d.i; LAB.sel[id] = LAB.sel[id] === i ? null : i;
      if (id === "weekly" && !LAB.open) { swap("lab-ev", evidence()); return; }
      const r = LAB.live[id]; if (!r) return;
      const box = document.getElementById("ch-" + id); if (box) { box.innerHTML = findingChart(r); if (typeof mountSegPills === "function") mountSegPills(box); }
      const ro = document.getElementById("ro-" + id); if (ro) ro.innerHTML = readout(r);
      const m = document.querySelector(`#ch-${id} [data-act="chartSel"][data-i="${i}"]`); if (m) m.focus({ preventScroll: true });
    },
    labResearch: async () => {
      const i = cur(), R = window.WRI_RESEARCH; if (!i || !R) return;
      if (!isOnline()) { LAB.research = Object.assign(LAB.research, { inv: i.id, err: "Kamu sedang offline. Riset butuh koneksi; sumber yang sudah tersimpan tetap bisa dibuka.", results: null }); swap("lab-research", researchPanel(i)); return; }
      LAB.research = { busy: true, err: "", results: null, inv: i.id }; swap("lab-research", researchPanel(i));
      try { const r = await R.search(R.queryFor(i, LAB.lastResults || [])); LAB.research = { busy: false, err: r.errors.length && !r.items.length ? r.errors.join(" ") : "", results: r.items, inv: i.id, cache: r.cachedAt ? fmtWhen(r.cachedAt) : "" }; toast(r.items.length ? `${r.items.length} sumber ditemukan` : "Tidak ada riset yang cukup relevan"); }
      catch (e) { LAB.research = { busy: false, err: "Pencarian riset gagal: " + String(e && e.message || e).slice(0, 120), results: null, inv: i.id }; }
      const n = cur(); if (n) swap("lab-research", researchPanel(n));
    },
    labSaveSrc: d => { const i = cur(); if (!i || !LAB.research.results) return; const x = LAB.research.results.find(r => r.id === d.id); if (!x) return; const list = (i.sources || []).filter(s => s.id !== x.id).concat([window.WRI_RESEARCH.toSaved(x)]).slice(-12); save(Object.assign({}, i, { sources: list, updatedAt: new Date().toISOString() })); swap("lab-research", researchPanel(cur())); toast("Sumber disimpan ke investigasi"); },
    labUnsave: d => { const i = cur(); if (!i) return; save(Object.assign({}, i, { sources: (i.sources || []).filter(s => s.id !== d.id), updatedAt: new Date().toISOString() })); swap("lab-research", researchPanel(cur())); }
  });
  Object.assign(LIVE, {
    labType: el => { const i = cur(); if (!i || !LB.TYPES[el.value] || el.value === i.type) return; LAB.editType = false; save(Object.assign({}, i, { type: el.value, typeSource: "user", status: "draft", updatedAt: new Date().toISOString() })); render(true); }
  });
  document.addEventListener("input", e => { if (e.target && e.target.id === "lab-q") LAB.draft = e.target.value.slice(0, 500); });
  document.addEventListener("keydown", e => { const t = e.target; if ((e.key === "Enter" || e.key === " ") && t && t.matches && t.matches('[data-act="chartSel"]')) { e.preventDefault(); ACT.chartSel(t.dataset); } });
  if (typeof TUT !== "undefined" && TUT.HELP) TUT.HELP.lab = { tour: "dashboard", title: "Lab", what: "Ajukan pertanyaan tentang larimu. Lab bertanya satu hal setiap kali, menunjukkan data mana yang dipakai, lalu menghitung analisis dari catatanmu sendiri.", why: "Jawaban berdasar datamu sendiri dan riset yang jelas sumbernya, bukan tebakan.", how: ["Tulis pertanyaan atau pilih contoh.", "Jawab pertanyaan lanjutan, atau Nggak tahu / Lewati.", "Cek bukti: lari yang dipakai, data yang hilang.", "Jalankan analisis, lalu cari riset terkait."], ex: "“Apakah aku lebih efisien lari pagi atau malam?” → 8 minggu → jam lari → pace.", warn: "Konsultasi AI belum diatur. Lab bukan alat diagnosis." };
})();
