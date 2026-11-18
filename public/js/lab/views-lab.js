/* RUNLAB Lab tab (Milestone 1). Shares app globals; pure logic lives in js/lab/lab.js (WRI_LAB).
 * Dock becomes Hari ini · Lab · Lari · Kamu; Race moves to Kamu and the Hari ini countdown chip.
 * Honest by construction: analysis, research and AI are shown as not available. Nothing here fakes a result.
 */
(function () {
  "use strict";
  const LB = WRI_LAB;
  const LAB = { open: null, editQ: false, editType: false, draft: "" };

  /* ---------- navigation ---------- */
  IC.lab = '<svg class="ico" viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></svg>';
  NAV_MAIN.splice(0, NAV_MAIN.length, ["home", "Hari ini"], ["lab", "Lab"], ["log", "Lari"], ["more", "Kamu"]);
  DOCK_ICON.lab = "lab";
  Object.assign(DOCK_GROUP, { lab: "lab", race: "more", pace: "more", goals: "more" });
  if (typeof MENU_IC !== "undefined") { MENU_IC.race = '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'; MENU_IC.lab = '<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/>'; }
  // Kamu: Race is one tap away at the top (it is no longer a dock tab).
  const _vMoreL = vMore;
  vMore = function () {
    const ev = activeEvent(), days = Math.max(0, Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY));
    return _vMoreL().replace('<div data-tour="menu">', `<h2 class="a4-sec">Race</h2><div class="rows a4-list" data-tour="kamu-race">
      <button class="row" data-act="nav" data-t="race"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${MENU_IC.race}</svg></span><span class="grow">Race & strategi<br><span class="xs mu">${esc(ev.name)} · ${days} hari lagi</span></span><span class="mu">›</span></button>
      <button class="row" data-act="nav" data-t="pace"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13l3-3M12 3v2"/></svg></span><span class="grow">Pace calculator</span><span class="mu">›</span></button></div>
      <div data-tour="menu">`);
  };
  // Hari ini: a "continue investigation" card when one is open (small, never a wall of text).
  const _vHomeL = vHome;
  vHome = function () {
    const h = _vHomeL(), open = Object.values(S.lab || {}).filter(i => i.status !== "closed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!open || S.ui.tab !== "home") return h;
    const card = `<button class="a4-card lab-cont" data-act="labOpen" data-id="${esc(open.id)}"><span class="a4-kicker">Lanjutkan investigasi</span><span class="lab-q">${esc(open.questionEdited || open.question)}</span></button>`;
    return h.replace('<section class="a4-card a4-week"', card + '<section class="a4-card a4-week"');
  };

  /* ---------- helpers ---------- */
  const all = () => Object.values(S.lab || {}).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const qOf = i => i.questionEdited || i.question;
  const fmtWhen = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
  function save(inv) {
    if (!Object.keys(S.lab || {}).length) makeBackup("Sebelum investigasi Lab pertama", S);   // one backup before the first Lab write
    S.lab = Object.assign({}, S.lab, { [inv.id]: inv }); persist();
  }
  const STATUS = () => `<div class="lab-status" role="list" aria-label="Status Lab">
    <span role="listitem" class="lab-chip ok">Data pribadi: siap</span>
    <span role="listitem" class="lab-chip off">Analisis: belum tersedia</span>
    <span role="listitem" class="lab-chip off">Riset: belum terhubung</span>
    <span role="listitem" class="lab-chip off">AI: tidak aktif</span></div>`;
  const ansText = (s, a) => {
    if (!a) return "";
    if (a.state === "skipped") return "dilewati";
    if (a.state === "unknown") return "nggak tahu";
    const o = (s.opts || []).find(x => String(x.v) === String(a.v));
    return o ? o.l : String(a.v);
  };

  /* ---------- views ---------- */
  function vLabHome() {
    const list = all(), open = list.filter(i => i.status !== "closed"), done = list.filter(i => i.status === "closed");
    const card = i => `<button class="lab-item" data-act="labOpen" data-id="${esc(i.id)}"><span class="lab-q">${esc(qOf(i))}</span><span class="xs mu">${esc(LB.TYPES[i.type].l)} · ${fmtWhen(i.updatedAt)}</span></button>`;
    return `<div class="a4 lab"><div class="a4-top"><div><p class="a4-date">Personal Running Lab</p><h1>Lab</h1></div>${helpBtn("lab")}</div>
      ${STATUS()}
      <section class="a4-card lab-new" data-tour="lab-new"><h2>Pertanyaan baru</h2>
        <p class="sm mu">Tanya sesuatu tentang larimu. Lab menanyakan satu hal setiap kali, lalu menunjukkan data mana yang bisa dipakai, dan mana yang belum ada.</p>
        <label class="sr-only" for="lab-q">Pertanyaanmu</label>
        <textarea id="lab-q" rows="3" maxlength="500" placeholder="misal: Kenapa pace-ku nggak membaik padahal lari lebih banyak?">${esc(LAB.draft)}</textarea>
        <div class="lab-starters" role="group" aria-label="Contoh pertanyaan">${LB.STARTERS.map((q, i) => `<button class="a4-chip" data-act="labStarter" data-i="${i}">${esc(q)}</button>`).join("")}</div>
        <button class="btn pri" style="margin-top:10px;width:100%" data-act="labCreate">Mulai investigasi</button></section>
      ${open.length ? `<h2 class="a4-sec">Berjalan</h2><div class="lab-list">${open.map(card).join("")}</div>` : ""}
      ${done.length ? `<h2 class="a4-sec">Selesai</h2><div class="lab-list">${done.map(card).join("")}</div>` : ""}
      <h2 class="a4-sec">Alat Lab</h2>
      <div class="lab-tools"><div class="lab-tool" aria-disabled="true" data-tour="lab-compiler"><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/></svg></span><span class="grow"><b>Workout Compiler</b><br><span class="xs mu">Ubah resep latihan jadi langkah terstruktur. Belum bisa dipakai.</span></span><span class="chip">Segera hadir</span></div></div>
      <p class="xs mu" style="margin-top:14px">Investigasi bersifat privat: tersimpan di akunmu dan nggak pernah dibagikan ke teman. Ini alat belajar dari datamu sendiri, bukan diagnosis medis.</p></div>`;
  }
  function vInvestigation(inv) {
    const shoes = S.shoes || [], st = LB.steps(inv, shoes), next = LB.nextQuestion(inv, shoes), T = LB.TYPES[inv.type];
    const answered = st.filter(s => inv.answers[s.k]);
    const sc = next ? null : LB.scope(inv, S);
    return `<div class="a4 lab"><div class="pagehead"><button class="back" data-act="labBack">‹ Lab</button></div>
      <section class="a4-card lab-head" data-tour="lab-question">
        ${LAB.editQ ? `<label class="sr-only" for="lab-eq">Ubah pertanyaan</label><textarea id="lab-eq" rows="3" maxlength="500">${esc(qOf(inv))}</textarea><div class="btns"><button class="btn sm pri" data-act="labSaveQ">Simpan</button><button class="btn sm ghost" data-act="labEditQ">Batal</button></div>`
          : `<h1 class="lab-title">${esc(qOf(inv))}</h1>${inv.questionEdited ? `<p class="xs mu">Pertanyaan asli: ${esc(inv.question)}</p>` : ""}<button class="link sm" data-act="labEditQ">Ubah pertanyaan</button>`}
        <div class="lab-type"><span class="chip">${esc(T.l)}</span><span class="xs mu">${inv.typeSource === "user" ? "dipilih kamu" : inv.matched.length ? "dikenali dari kata: " + inv.matched.map(esc).join(", ") : "tebakan awal; ganti kalau kurang pas"}</span></div>
        ${LAB.editType ? `<div class="field" style="margin-top:8px"><label for="lab-type">Jenis investigasi</label><select id="lab-type" data-live="labType">${Object.entries(LB.TYPES).map(([k, t]) => `<option value="${k}" ${k === inv.type ? "selected" : ""}>${esc(t.l)} — ${esc(t.d)}</option>`).join("")}</select></div>` : `<button class="link sm" data-act="labEditType">Ganti jenis</button>`}
      </section>
      ${answered.length ? `<section class="a4-card lab-answers"><h2>Jawabanmu</h2>${answered.map(s => `<button class="row lab-ans" data-act="labReopen" data-k="${s.k}" aria-label="Ubah jawaban: ${esc(s.q)}"><span class="grow"><span class="xs mu">${esc(s.q)}</span><br><b>${esc(ansText(s, inv.answers[s.k]))}</b></span><span class="mu">Ubah</span></button>`).join("")}</section>` : ""}
      ${next ? askCard(next) : scopeCard(inv, sc)}
      <section class="a4-card"><h2>Kesimpulanmu</h2><p class="xs mu">Catatan pribadimu sendiri tentang pertanyaan ini.</p><label class="sr-only" for="lab-notes">Kesimpulanmu</label><textarea id="lab-notes" rows="3" maxlength="2000">${esc(inv.notes || "")}</textarea><button class="btn sm" data-act="labSaveNotes">Simpan catatan</button></section>
      <div class="btns lab-actions"><button class="btn" data-act="labExport">Export (JSON)</button><button class="btn" data-act="labClose">${inv.status === "closed" ? "Buka lagi" : "Tandai selesai"}</button><button class="btn danger" data-act="labDelete">Hapus</button></div></div>`;
  }
  function askCard(q) {
    return `<section class="a4-card lab-ask" data-tour="lab-ask" aria-live="polite"><p class="a4-kicker">Pertanyaan lanjutan</p><h2>${esc(q.q)}</h2><p class="xs mu">Kenapa ditanya: ${esc(q.why)}</p>
      ${q.text ? `<label class="sr-only" for="lab-txt">${esc(q.q)}</label><input type="text" id="lab-txt" maxlength="200" placeholder="${esc(q.ph || "")}"><button class="btn pri" style="margin-top:8px" data-act="labAnsText" data-k="${q.k}">Simpan</button>`
        : (q.opts && q.opts.length ? `<div class="lab-opts">${q.opts.map(o => `<button class="btn" data-act="labAns" data-k="${q.k}" data-v="${esc(String(o.v))}">${esc(o.l)}</button>`).join("")}</div>` : `<p class="sm mu">Belum ada pilihan (misal belum ada sepatu tercatat).</p>`)}
      <div class="btns" style="margin-top:8px"><button class="btn sm ghost" data-act="labSkip" data-k="${q.k}" data-s="skipped">Lewati</button><button class="btn sm ghost" data-act="labSkip" data-k="${q.k}" data-s="unknown">Nggak tahu</button></div></section>`;
  }
  function scopeCard(inv, sc) {
    const reasons = {}; sc.excluded.forEach(e => { reasons[e.reason] = (reasons[e.reason] || 0) + 1; });
    const win = sc.window.days ? `${fmtD(sc.window.from)} – ${fmtD(sc.window.to)} (${sc.window.days} hari)` : `Semua data sampai ${fmtD(sc.window.to)}`;
    return `<section class="a4-card lab-scope" data-tour="lab-scope"><p class="a4-kicker">Rencana analisis</p><h2>Data yang akan dipakai</h2>
      <div class="kv"><span>Periode</span><b>${win}</b></div>
      <div class="kv"><span>Lari dipakai</span><b class="num">${sc.included.length}</b></div>
      ${Object.keys(reasons).length ? `<p class="xs mu">Tidak dipakai: ${Object.entries(reasons).map(([r, n]) => `${n} (${esc(r)})`).join(", ")}</p>` : ""}
      ${inv.type === "recovery" || inv.type === "experiment" ? `<div class="kv"><span>Check-in diisi</span><b class="num">${sc.checkins.n}</b></div>` : ""}
      <table class="lab-cov"><caption class="xs mu">Kelengkapan data di lari yang dipakai</caption><thead><tr><th scope="col">Data</th><th scope="col">Ada di</th></tr></thead><tbody>
        ${sc.coverage.map(c => `<tr class="${c.need && c.n === 0 ? "miss" : ""}"><td>${esc(c.l)}${c.need ? " <span class=\"xs mu\">(dibutuhkan)</span>" : ""}</td><td class="num">${c.n}/${c.total}</td></tr>`).join("")}</tbody></table>
      ${sc.missingNeeded.length ? `<div class="note warn" style="margin-top:8px">Belum ada data: ${sc.missingNeeded.map(esc).join(", ")}. Lab nggak akan menebak nilai yang hilang.</div>` : ""}
      ${sc.strava.n ? `<p class="xs mu" style="margin-top:6px">${sc.strava.n} lari berasal dari Strava. Data itu tidak akan pernah dikirim ke AI.</p>` : ""}
      <h3 style="margin-top:12px">Yang akan dihitung</h3><p class="sm">${esc(sc.plan)}</p>
      <h3 style="margin-top:10px">Bisa mengacaukan hasil</h3><ul class="sm lab-conf">${sc.confounders.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
      <div class="note info" style="margin-top:10px"><b>Analisis belum tersedia di versi ini.</b> Yang tampil di atas adalah cakupan data sebenarnya, bukan hasil. Perhitungan, riset ilmiah, dan ringkasan AI akan hadir bertahap, dan selalu diberi label sumbernya.</div></section>`;
  }
  window.vLab = function () { const inv = LAB.open && S.lab && S.lab[LAB.open]; return inv ? vInvestigation(inv) : vLabHome(); };

  /* ---------- actions ---------- */
  const cur = () => S.lab && S.lab[LAB.open];
  Object.assign(ACT, {
    labStarter: d => { const el = document.getElementById("lab-q"); if (el) el.value = LB.STARTERS[+d.i]; LAB.draft = LB.STARTERS[+d.i]; },
    labCreate: () => {
      const q = ((document.getElementById("lab-q") || {}).value || "").trim();
      if (q.length < 5) { toast("Tulis pertanyaanmu dulu (minimal 5 huruf)"); return; }
      const inv = LB.newInvestigation(q); save(inv); LAB.open = inv.id; LAB.draft = ""; LAB.editQ = false; render(false); window.scrollTo(0, 0);
    },
    labOpen: d => { LAB.open = d.id; LAB.editQ = false; LAB.editType = false; S.ui.tab = "lab"; render(false); window.scrollTo(0, 0); },
    labBack: () => { LAB.open = null; LAB.editQ = false; render(false); },
    labAns: d => { const i = cur(); if (!i) return; const v = /^-?\d+(\.\d+)?$/.test(d.v) ? Number(d.v) : d.v; save(LB.answer(i, d.k, v)); render(true); },
    labAnsText: d => { const i = cur(), v = ((document.getElementById("lab-txt") || {}).value || "").trim(); if (!i) return; if (!v) { toast("Tulis jawabannya, atau pilih Lewati / Nggak tahu"); return; } save(LB.answer(i, d.k, v.slice(0, 200))); render(true); },
    labSkip: d => { const i = cur(); if (!i) return; save(LB.answer(i, d.k, null, d.s === "unknown" ? "unknown" : "skipped")); render(true); },
    labReopen: d => { const i = cur(); if (!i) return; save(LB.reopen(i, d.k)); render(true); },
    labEditQ: () => { LAB.editQ = !LAB.editQ; render(true); },
    labEditType: () => { LAB.editType = true; render(true); },
    labSaveQ: () => {
      const i = cur(), v = ((document.getElementById("lab-eq") || {}).value || "").trim(); if (!i || v.length < 5) return;
      const o = Object.assign({}, i, { updatedAt: new Date().toISOString() }); if (v !== i.question) o.questionEdited = v; else delete o.questionEdited;
      save(o); LAB.editQ = false; render(true);
    },
    labSaveNotes: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { notes: ((document.getElementById("lab-notes") || {}).value || "").slice(0, 2000), updatedAt: new Date().toISOString() })); toast("Catatan tersimpan"); },
    labClose: () => { const i = cur(); if (!i) return; save(Object.assign({}, i, { status: i.status === "closed" ? "draft" : "closed", updatedAt: new Date().toISOString() })); render(true); },
    labExport: () => { const i = cur(); if (!i) return; const sc = LB.nextQuestion(i, S.shoes) ? null : LB.scope(i, S); offerFile(`werunit-lab-${i.id}.json`, JSON.stringify(LB.exportJson(i, sc), null, 2)); },
    labDelete: () => { const i = cur(); if (!i) return; M = { kind: "confirm", title: "Hapus investigasi ini?", msg: "Pertanyaan, jawaban, dan catatanmu untuk investigasi ini dihapus dari perangkat dan akun. Data lari kamu nggak kena. Mau simpan dulu? Pakai Export.", ok: "labDeleteOk", okId: i.id, okLabel: "Hapus", danger: true }; render(true); },
    labDeleteOk: d => { const o = Object.assign({}, S.lab); delete o[d.id]; S.lab = o; persist(); M = null; LAB.open = null; render(false); toast("Investigasi dihapus"); }
  });
  Object.assign(LIVE, {
    labType: el => { const i = cur(); if (!i || !LB.TYPES[el.value] || el.value === i.type) return; LAB.editType = false; save(Object.assign({}, i, { type: el.value, typeSource: "user", status: "draft", updatedAt: new Date().toISOString() })); render(true); }
  });
  document.addEventListener("input", e => { if (e.target && e.target.id === "lab-q") LAB.draft = e.target.value.slice(0, 500); });
  if (typeof TUT !== "undefined" && TUT.HELP) TUT.HELP.lab = { tour: "dashboard", title: "Lab", what: "Ajukan pertanyaan tentang larimu. Lab menanyakan satu hal setiap kali, lalu menunjukkan data mana yang tersedia dan mana yang belum.", why: "Supaya jawaban nanti didasarkan pada datamu sendiri dan riset yang jelas sumbernya, bukan tebakan.", how: ["Tulis pertanyaan atau pilih contoh.", "Jawab pertanyaan lanjutan, atau Lewati / Nggak tahu.", "Cek rencana analisis: periode, lari yang dipakai, data yang belum ada.", "Simpan catatanmu, export, atau hapus kapan saja."], ex: "“Apakah aku lebih efisien lari pagi atau malam?” → periode 8 minggu → faktor: jam lari → ukuran: pace.", warn: "Analisis, riset ilmiah, dan ringkasan AI belum tersedia di versi ini. Lab bukan alat diagnosis." };
})();
