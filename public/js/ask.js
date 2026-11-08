/* WeRunIt 4.0 "Tanya Kiki": manual input as one question at a time.
 * Kiki asks, the person taps a choice (or types their own answer), the answered question folds up and the next one
 * slides in below. Answers are collected quietly; at the end Kiki shows what it made of them, and only then is
 * anything saved. Used for the daily check-in, adding a shoe and logging a run.
 *
 * A flow is {title, steps(a) -> [step], summary(a) -> html, save(a) -> toast text}. A step:
 *   {k, q, sub, type:"choice"|"scale"|"text", opts:[{v, l, s}], custom:{kind:"number"|"text"|"time"|"date", ph, unit},
 *    skip:"label" (optional), show(a) (optional), fmt(v, a) (how the answer reads back)}
 * State lives in M = {kind:"ask", f, i, a}. Loaded after companion.js.
 */
(function (G) {
  "use strict";
  const T = () => todayYmd(), Y = () => ymd(addDays(new Date(), -1));

  /* ---------- flows ---------- */
  const CI_OPTS = {
    sleep: ["Jelek", "Kurang", "Lumayan", "Enak", "Nyenyak"],
    soreness: ["Nggak", "Dikit", "Lumayan", "Pegal", "Pegal banget"],
    fatigue: ["Segar", "Oke", "Lumayan", "Capek", "Capek banget"],
    energy: ["Lemes", "Kurang", "Biasa", "Oke", "Full"],
    motivation: ["Males banget", "Males", "Biasa", "Mau", "Semangat"],
    pain: ["Nggak ada", "Dikit", "Kerasa", "Ganggu", "Tajam"]
  };
  const CI_Q = { sleep: "Semalam tidurnya gimana?", soreness: "Otot pegal nggak?", fatigue: "Kakinya capek?", energy: "Tenaga hari ini?", motivation: "Semangat lari?", pain: "Ada nyeri?" };
  const scale = k => ({ k, q: CI_Q[k], type: "scale", opts: CI_OPTS[k].map((l, i) => ({ v: i + 1, l })) });
  const ciOf = a => ({ date: T(), sleep: a.sleep, soreness: a.soreness, fatigue: a.fatigue, energy: a.energy, motivation: a.motivation, pain: a.pain });

  const FLOWS = {
    ci: {
      title: "Check-in",
      steps: () => ["sleep", "soreness", "fatigue", "energy", "motivation", "pain"].map(scale),
      summary(a) {
        const c = ciOf(a), r = readiness(c), SC = G.WRI_SCORES;
        const siap = SC ? SC.charge({ date: c.date, checkins: S.checkins.filter(x => x.date !== c.date).concat([c]), logs: S.logs.filter(l => !l.sample), strength: S.strength.filter(x => !x.sample), hrMax: S.profile && S.profile.hrMax }).score : null;
        return `<div class="ask-res" data-tour="ci-result"><div class="ask-ring rd-ring">${readyRing(r)}</div>
          <div><p class="ask-big">${RD_LBL[r.st]}</p>${siap !== null ? `<p class="cap">Siap <b class="num">${siap}</b></p>` : ""}</div></div>
          ${c.pain >= 4 ? `<div class="note bad">Nyeri tajam: stop lari dulu. Kalau berlanjut, periksa ke dokter atau fisio.</div>` : ""}`;
      },
      save(a) { const c = ciOf(a); S.checkins = S.checkins.filter(x => x.date !== c.date); S.checkins.push(c); S.ui.ci = null; return "Check-in tersimpan"; }
    },
    shoe: {
      title: "Sepatu baru",
      steps: () => [
        { k: "brand", q: "Merek apa?", type: "choice", opts: ["Nike", "Adidas", "ASICS", "New Balance", "Hoka", "Puma", "Ortuseight", "910"].map(v => ({ v, l: v })), custom: { kind: "text", ph: "Merek lain" }, skip: "Nggak tahu" },
        { k: "model", q: "Namanya?", sub: "Misal Pegasus 42 atau \"Sepatu biru\"", type: "text", custom: { kind: "text", ph: "Nama sepatu" } },
        { k: "use", q: "Paling sering dipakai buat apa?", type: "choice", opts: [{ v: "daily", l: "Harian", s: "easy run" }, { v: "long", l: "Long run" }, { v: "tempo", l: "Sesi cepat" }, { v: "race", l: "Race" }, { v: "trail", l: "Trail" }] },
        { k: "init", q: "Udah dipakai berapa km?", type: "choice", opts: [{ v: 0, l: "Baru" }, { v: 100, l: "± 100 km" }, { v: 300, l: "± 300 km" }, { v: 500, l: "± 500 km" }], custom: { kind: "number", ph: "km", unit: "km" }, fmt: v => v ? `${v} km` : "Baru" },
        { k: "limit", q: "Mau dipensiunin di berapa km?", type: "choice", opts: [{ v: 500, l: "500 km", s: "race / ringan" }, { v: 700, l: "700 km", s: "umumnya" }, { v: 900, l: "900 km", s: "awet" }], custom: { kind: "number", ph: "km", unit: "km" }, fmt: v => `${v} km` }
      ],
      summary(a) {
        const pct = Math.min(100, Math.round((a.init || 0) / a.limit * 100));
        return `<div class="ask-shoe"><span class="ask-shoe-ic">${IC.shoe}</span><div class="grow"><p class="ask-big">${esc(a.model)}</p><p class="cap">${esc([a.brand, USE_L[a.use]].filter(Boolean).join(" · "))}</p></div></div>
          <div class="ask-life"><i style="width:${pct}%"></i></div><p class="cap ask-life-l"><span class="num">${a.init || 0}</span> / <span class="num">${a.limit}</span> km</p>`;
      },
      save(a) {
        const x = HMTP.sanitizeState(Object.assign(defaults(), { shoes: [{ id: uid(), retired: false, name: a.model, limit: Math.round(a.limit), brand: a.brand || "", model: a.model, use: a.use, initialKm: a.init || 0, since: T() }] }), defaults).shoes[0];
        S.shoes.push(x); if (!S.settings.defaultShoe) S.settings.defaultShoe = x.id;
        return "Sepatu tersimpan";
      }
    },
    run: {
      title: "Catat lari",
      steps(a) {
        const date = a.date || T();
        const open = (typeof itemsOnDate === "function" ? [date, ymd(addDays(parseYmd(date), -1)), ymd(addDays(parseYmd(date), 1))].flatMap(d => itemsOnDate(d)) : [])
          .filter(s => s.type !== "strength" && !S.logs.some(l => l.sessionId === s.id)).slice(0, 3);
        const sess = a.sess ? sessById(a.sess) : null;
        const shoes = S.shoes.filter(s => !s.retired);
        return [
          { k: "date", q: "Larinya kapan?", type: "choice", opts: [{ v: T(), l: "Hari ini" }, { v: Y(), l: "Kemarin" }], custom: { kind: "date" }, fmt: v => v === T() ? "Hari ini" : v === Y() ? "Kemarin" : fmtDay(v) },
          { k: "sess", q: "Ini sesi yang mana?", type: "choice", show: () => open.length > 0, opts: open.map(s => ({ v: s.id, l: s.title, s: `${fmtKm(s.dist)} km · ${fmtDay(s.date)}` })).concat([{ v: "", l: "Lari bebas" }]), fmt: v => v ? (sessById(v) || {}).title || "Sesi" : "Lari bebas" },
          { k: "km", q: "Berapa km?", type: "choice", opts: [...new Set([sess && sess.dist, 3, 5, 10].filter(Boolean))].map(v => ({ v, l: `${fmtKm(v)} km`, s: sess && v === sess.dist ? "sesuai rencana" : "" })), custom: { kind: "number", ph: "km", unit: "km", step: "0.01" }, fmt: v => `${fmtKm(v)} km` },
          { k: "dur", q: "Waktunya berapa lama?", sub: "mm:ss atau j:mm:ss", type: "text", custom: { kind: "time", ph: "45:30" }, skip: "Nggak tahu" },
          { k: "type", q: "Larinya jenis apa?", type: "choice", show: () => !sess, opts: ["easy", "long", "recovery", "locked", "race", "other"].map(v => ({ v, l: TYPES[v] })), fmt: v => TYPES[v] },
          { k: "rpe", q: "Seberat apa rasanya?", type: "choice", opts: [{ v: 2, l: "Santai", s: "bisa ngobrol" }, { v: 4, l: "Nyaman" }, { v: 6, l: "Kerja", s: "kalimat pendek" }, { v: 8, l: "Berat" }, { v: 10, l: "Habis-habisan" }], skip: "Lewati" },
          { k: "shoe", q: "Pakai sepatu apa?", type: "choice", show: () => shoes.length > 0, opts: shoes.map(s => ({ v: s.id, l: s.name })).concat([{ v: "", l: "Lainnya" }]), fmt: v => v ? (S.shoes.find(s => s.id === v) || {}).name : "Lainnya" }
        ];
      },
      summary(a) {
        const sess = a.sess ? sessById(a.sess) : null, dur = a.dur ? parseDur(a.dur) : null, pace = dur && a.km ? dur / a.km : null;
        const SC = G.WRI_SCORES, eff = SC ? SC.effort(SC.runLoad({ date: a.date, type: sess ? sess.type : a.type, distance: a.km, duration: dur, rpe: a.rpe }).load) : null;
        return `<div class="ask-run"><div><b class="ask-km num">${fmtKm(a.km)}</b><span class="cap">km</span></div>
          <div><b class="num">${pace ? fmtPace(pace, false) : "–"}</b><span class="cap">/km</span></div>
          <div><b class="num">${dur ? fmtDur(dur) : "–"}</b><span class="cap">waktu</span></div>
          <div><b class="num">${eff ?? "–"}</b><span class="cap">beban</span></div></div>
          ${sess ? `<p class="cap ask-vs">${esc(sess.title)} · rencana ${fmtKm(sess.dist)} km</p>` : ""}`;
      },
      save(a) {
        const sess = a.sess ? sessById(a.sess) : null, dur = a.dur ? parseDur(a.dur) : null;
        if (sess) delete S.status[sess.id];
        S.logs.push({ id: uid(), date: a.date, type: sess ? sess.type : (a.type || "easy"), sessionId: sess ? sess.id : null, distance: a.km, duration: dur && !isNaN(dur) ? dur : null, elev: null, hrAvg: null, hrMax: null, rpe: a.rpe || null, weather: "", notes: "", shoeId: a.shoe || S.settings.defaultShoe || null });
        return "Lari tersimpan";
      }
    }
  };
  FLOWS.result = {
    title: "Hasil race",
    steps: () => [
      { k: "km", q: "Jarak berapa?", type: "choice", opts: [{ v: 5, l: "5K" }, { v: 10, l: "10K" }, { v: 21.1, l: "Half" }, { v: 42.2, l: "Full" }], custom: { kind: "number", ph: "km", unit: "km", step: "0.01" }, fmt: v => `${fmtKm(v)} km` },
      { k: "t", q: "Finish di waktu berapa?", sub: "mm:ss atau j:mm:ss", type: "text", custom: { kind: "time", ph: "55:30" } },
      { k: "d", q: "Kapan?", type: "choice", opts: [{ v: T(), l: "Hari ini" }], custom: { kind: "date" }, skip: "Lupa", fmt: v => v ? fmtD(v) : "Lupa" }
    ],
    summary(a) {
      const sec = parseDur(a.t), exp = (S.racePrefs && S.racePrefs.exp) || 1.06, hm = sec * Math.pow(21.0975 / a.km, exp);
      return `<div class="ask-run" style="grid-template-columns:1fr 1fr 1fr"><div><b class="ask-km num">${fmtKm(a.km)}</b><span class="cap">km</span></div>
        <div><b class="num">${fmtDur(sec)}</b><span class="cap">finish</span></div><div><b class="num">${fmtPace(sec / a.km, false)}</b><span class="cap">/km</span></div></div>
        <p class="cap ask-vs">Perkiraan half marathon <b class="num">${fmtDur(Math.round(hm))}</b></p>`;
    },
    save(a) { S.racePrefs.recent = [...S.racePrefs.recent, { km: a.km, sec: parseDur(a.t), date: a.d && validYmd(a.d) ? a.d : "", label: "Hasil race" }].slice(-10); if (typeof touchRace === "function") touchRace(); return "Hasil tersimpan"; }
  };
  const USE_L = { daily: "Harian", long: "Long run", tempo: "Sesi cepat", race: "Race", trail: "Trail" };

  /* ---------- engine ---------- */
  const steps = () => FLOWS[M.f].steps(M.a).filter(s => !s.show || s.show(M.a));
  const readBack = (s, v) => v === null || v === undefined || v === "" && s.skip && !s.opts ? (s.skip || "–")
    : s.fmt ? s.fmt(v, M.a) : (s.opts && (s.opts.find(o => o.v === v) || {}).l) || String(v);
  const words = (txt, start) => esc(txt).split(/\s+/).map((w, i) => `<span class="kw" style="--i:${start + i}">${w}</span>`).join(" ");

  function mAsk() {
    const F = FLOWS[M.f], all = steps(), done = M.i >= all.length, s = all[M.i];
    const qWords = s ? (s.q + " " + (s.sub || "")).split(/\s+/).length : 6;
    const kiki = mascot("ask-kiki", done ? "cheer talk" : "talk").replace('class="ask-kiki', `style="--tn:${Math.max(4, qWords * 2)}" class="ask-kiki`);
    const hist = all.slice(0, Math.min(M.i, all.length)).map((x, i) => `<button class="ask-h" data-act="askGo" data-i="${i}"><span>${esc(x.q)}</span><b>${esc(readBack(x, M.a[x.k]))}</b></button>`).join("");
    let body = "";
    if (!done) {
      const c = s.custom, cur = M.a[s.k];
      const opts = (s.opts || []).map((o, i) => `<button class="ask-o ${s.type === "scale" ? "sc" : ""} ${cur === o.v ? "on" : ""}" style="--i:${i}" data-act="askAns" data-v="${esc(JSON.stringify(o.v))}">${s.type === "scale" ? `<span class="num ask-n">${o.v}</span>` : ""}<span class="ask-ol">${esc(o.l)}</span>${o.s ? `<span class="ask-os">${esc(o.s)}</span>` : ""}</button>`).join("");
      const typ = c ? { number: "number", date: "date", time: "text", text: "text" }[c.kind] : "";
      const inp = c ? `<div class="ask-custom" style="--i:${(s.opts || []).length}"><input id="ask-in" type="${typ}" ${c.kind === "number" ? `inputmode="decimal" step="${c.step || "1"}" min="0"` : ""} placeholder="${esc(s.opts ? "Jawaban lain" + (c.ph ? " · " + c.ph : "") : c.ph || "")}" value="${cur !== undefined && cur !== null && !(s.opts || []).some(o => o.v === cur) ? esc(String(cur)) : ""}" autocomplete="off"><button class="ask-ok" data-act="askCustom" aria-label="Kirim">${IC.check}</button></div>` : "";
      body = `<div class="ask-q" data-step="${M.i}">
          <div class="ask-say"><span class="ask-av">${kiki}<i class="ask-bub b1"></i><i class="ask-bub b2"></i><i class="ask-bub b3"></i></span>
            <div class="ask-bubble"><span class="kc-typing" aria-hidden="true"><i></i><i></i><i></i></span><p class="ask-qt">${words(s.q, 0)}</p>${s.sub ? `<p class="ask-sub">${words(s.sub, s.q.split(/\s+/).length)}</p>` : ""}</div></div>
          <div class="ask-opts ${s.type === "scale" ? "scale" : ""}">${opts}${inp}</div>
          <p class="ask-err" id="ask-err"></p>
          ${s.skip ? `<button class="ask-skip" data-act="askSkip">${esc(s.skip)}</button>` : ""}
        </div>`;
    } else {
      body = `<div class="ask-q ask-end">
          <div class="ask-say"><span class="ask-av">${kiki}<i class="ask-bub b1"></i><i class="ask-bub b2"></i><i class="ask-bub b3"></i></span>
            <div class="ask-bubble"><span class="kc-typing" aria-hidden="true"><i></i><i></i><i></i></span><p class="ask-qt">${words("Beres. Ini hasilnya.", 0)}</p></div></div>
          <div class="ask-sum">${F.summary(M.a)}</div>
          <button class="btn pri ask-save" data-act="askSave">Simpan</button>
        </div>`;
    }
    return `<div class="ask" data-flow="${M.f}">
      <div class="ask-top"><button class="ask-x" data-act="closeM" aria-label="Tutup">×</button><b>${esc(F.title)}</b><span class="cap">${Math.min(M.i + 1, all.length)}/${all.length}</span></div>
      <div class="ask-prog"><i style="width:${Math.round(Math.min(M.i, all.length) / all.length * 100)}%"></i></div>
      ${hist ? `<div class="ask-hist">${hist}</div>` : ""}
      ${body}
    </div>`;
  }

  function next() { M.i++; render(true); requestAnimationFrame(() => { const q = document.querySelector(".ask-q"); if (q && q.scrollIntoView) q.scrollIntoView({ block: "end", behavior: WRI_MOTION.reduced() ? "auto" : "smooth" }); const i = document.getElementById("ask-in"); if (i && !document.querySelector(".ask-o") && window.innerWidth >= 700) i.focus(); }); }
  function err(t) { const e = document.getElementById("ask-err"); if (e) e.textContent = t; }
  function accept(s, raw) {
    const c = s.custom || {};
    if (c.kind === "number") { const n = num(raw); if (!(n > 0) || n > 5000) return err("Angkanya belum pas"); if (s.k === "km" && n > 100) return err("Maksimal 100 km"); if (s.k === "limit" && (n < 100 || n > 2000)) return err("Antara 100 dan 2000 km"); return n; }
    if (c.kind === "time") { const d = parseDur(raw); if (d === null || isNaN(d)) return err("Format mm:ss atau j:mm:ss"); return raw; }
    if (c.kind === "date") { if (!validYmd(raw)) return err("Tanggalnya belum bener"); return raw; }
    const t = String(raw || "").trim().slice(0, 60); if (!t) return err("Isi dulu ya"); return t;
  }
  const _modal = modal;
  modal = function () { return M && M.kind === "ask" ? `<div class="sheet-bg" data-act="closeM"></div><div class="sheet ask-sheet" role="dialog" aria-modal="true">${mAsk()}</div>` : _modal(); };

  Object.assign(ACT, {
    askStart: d => { M = { kind: "ask", f: d.f, i: 0, a: {} }; render(true); },
    askAns: d => { const s = steps()[M.i]; if (!s) return; M.a[s.k] = JSON.parse(d.v); next(); },
    askCustom: () => { const s = steps()[M.i]; if (!s) return; const v = accept(s, document.getElementById("ask-in").value); if (v === undefined) return; M.a[s.k] = v; next(); },
    askSkip: () => { const s = steps()[M.i]; if (!s) return; M.a[s.k] = s.k === "dur" || s.k === "brand" ? "" : null; next(); },
    askGo: d => { M.i = +d.i; render(true); },
    askSave: () => { const t = FLOWS[M.f].save(M.a); persist(); M = null; render(true); toast(t); }
  });
  // Enter submits a typed answer
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target && e.target.id === "ask-in") { e.preventDefault(); ACT.askCustom(); } });

  // entry points: the record button and "Catat" open the run questions; the shoe and check-in pages start theirs
  ACT.quickLog = () => ACT.askStart({ f: "run" });
  const _vRec = vRecovery;
  vRecovery = function () {
    const html = _vRec(), ex = S.checkins.find(c => c.date === T());
    const hero = `<section class="ask-hero" data-tour="ci-rate"><span class="ask-av">${mascot("ask-kiki", "wave")}<i class="ask-bub b1"></i><i class="ask-bub b2"></i><i class="ask-bub b3"></i></span>
      <div class="grow"><p class="ask-big">${ex ? "Udah check-in" : "Gimana badanmu?"}</p><p class="cap">${ex ? RD_LBL[readiness(ex).st] : "6 pertanyaan · 20 detik"}</p></div>
      <button class="btn pri" data-act="askStart" data-f="ci">${ex ? "Ulangi" : "Mulai"}</button></section>`;
    // drop the old six-row form (rate rows, result note and save button) and put the Kiki card in its place
    return html.replace(/<div class="field" style="max-width:220px;margin-top:14px"><label for="ci-date">[\s\S]*?<button class="btn pri" data-act="ciSave">Simpan check-in<\/button>/, hero);
  };

  G.WRI_ASK = { FLOWS };
})(typeof globalThis !== "undefined" ? globalThis : this);
