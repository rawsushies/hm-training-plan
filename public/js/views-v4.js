/* WeRunIt v4 views: availability & schedule editor, race events + replanning, race-day workspace,
 * race-day sheet export, onboarding. Loaded after the main app script (shares its globals: S, ACT, render…).
 */
"use strict";
NAV_MORE.splice(NAV_MORE.findIndex(x => x[0] === "locked"), 0, ["jadwal", "Jadwal & ketersediaan"]);
DOCK_GROUP.jadwal = "cal";
const RS = WRI_RACE, SC = WRI_SCHED, DAYS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const evKm = ev => Math.round(ev.distanceKm * 10) / 10;
const raceDist = () => activeEvent().distanceKm;
const fmtClock = (startHHMM, secs) => { const [h, m] = (startHHMM || "05:00").split(":").map(Number); const t = h * 3600 + m * 60 + secs; return `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}`; };
function touchRace(){ S.racePrefs.touched = true; }

/* ===================== Availability & schedule editor ===================== */
function schedDraft(){ if(!S.ui.schedDraft) S.ui.schedDraft = HMTP.clone(S.schedule || SC.fromLegacy(S.settings.weekday)); return S.ui.schedDraft; }
function previewWeeks(draft){
  const keep = S.schedule; S.schedule = draft; const plan = buildPlan(); S.schedule = keep;
  const ci = Math.max(0, PLANW.findIndex(w => todayYmd() >= w.start && todayYmd() <= w.end));
  return plan.slice(ci, ci + 2);
}
const INTENSITY = {locked:"Berat", benchmark:"Berat", elevation:"Berat", long:"Long", race:"Race", easy:"Santai", recovery:"Santai", strength:"Strength"};
function dayChips(sel, act, extra = ""){ return `<div class="seg" role="group">${DAYS_SHORT.map((d, i) => `<button class="${sel.includes(i) ? "on" : ""}" data-act="${act}" data-d="${i}" aria-pressed="${sel.includes(i)}" ${extra}>${d}</button>`).join("")}</div>`; }
function availEditor(D, compact){
  const av = D.avail.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const opt = (sel, allowAuto) => (allowAuto ? `<option value="">Otomatis</option>` : "") + av.map(i => `<option value="${i}" ${sel === i ? "selected" : ""}>${SC.DAYS[i]}</option>`).join("");
  return `<div class="field"><span class="lbl">Hari yang kamu bisa lari</span>${dayChips(av, "schDay")}<span class="hint">Pilih semua hari yang memungkinkan. Jumlah lari tetap ${D.freq} kali seminggu, hari kosong nggak otomatis jadi latihan.</span></div>
  <div class="g2"><div class="field"><label for="sch-long">Long run</label><select id="sch-long" data-live="schPref" data-k="long">${opt(D.long, false)}</select></div>
  <div class="field"><label for="sch-q">Sesi cepat / weekday</label><select id="sch-q" data-live="schPref" data-k="quality">${opt(D.quality, false)}</select></div></div>
  ${compact ? "" : `<div class="g2"><div class="field"><label for="sch-r">Recovery run</label><select id="sch-r" data-live="schPref" data-k="recovery">${opt(D.recovery, true)}</select><span class="hint">Otomatis = sehari setelah long run kalau bisa.</span></div>
  <div class="field"><span class="lbl">Lari per minggu</span><div class="seg">${[2, 3, 4].map(f => `<button class="${D.freq === f ? "on" : ""}" data-act="schFreq" data-v="${f}">${f}×</button>`).join("")}</div><span class="hint">Default program: 3×.</span></div></div>
  <div class="field"><span class="lbl">Hari strength (opsional)</span>${dayChips(D.strength, "schStr")}<span class="hint">Kosongkan = otomatis di hari tanpa lari, bukan sehari sebelum long run.</span></div>`}`;
}
function previewHtml(D){
  return previewWeeks(D).map(w => {
    const items = [...w.sessions, ...w.strength].sort((a, b) => a.date.localeCompare(b.date));
    const byDay = DAYS_SHORT.map((_, i) => items.filter(s => (parseYmd(s.date).getDay() + 6) % 7 === i));
    const warn = [...(w.notes || []), ...SC.weekWarnings(w.sessions)];
    return `<div class="card" style="margin-top:10px"><h3>Week ${w.n} · ${fmtRange(w.start, w.end)}</h3>
      <div class="wk-grid">${byDay.map((its, i) => `<div class="wk-day"><b class="xs mu">${DAYS_SHORT[i]}</b>${its.length ? its.map(s => `<span class="wk-chip" style="--c:${tc(s.type)}" title="${esc(s.title)}">${esc(INTENSITY[s.type] || s.type)}${s.dist ? ` ${fmtKm(s.dist)}` : ""}</span>`).join("") : `<span class="wk-chip rest">Istirahat</span>`}</div>`).join("")}</div>
      ${warn.length ? `<div class="note warn" style="margin-top:8px">${[...new Set(warn)].map(esc).join("<br>")}</div>` : ""}</div>`;
  }).join("");
}
function vSchedule(){
  const D = schedDraft(), custom = !!S.schedule;
  return `${pageHead("Jadwal & ketersediaan", "Atur hari kamu bisa lari. Isi program (jenis sesi, jarak, tujuan) nggak berubah, cuma harinya yang menyesuaikan.")}
  <div class="sec" style="margin-top:8px" data-tour="sch-avail">${availEditor(D)}
    <div class="g2"><div class="field"><label for="st-wdt2">Jam lari hari kerja</label><input type="time" id="st-wdt2" value="${esc(S.settings.wdTime)}"></div><div class="field"><label for="st-wkt2">Jam lari weekend</label><input type="time" id="st-wkt2" value="${esc(S.settings.wkTime)}"></div></div>
    <div class="btns"><button class="btn pri" data-act="schSave">Simpan jadwal</button>${custom ? `<button class="btn ghost" data-act="schLegacy">Kembali ke susunan lama</button>` : ""}</div>
    <p class="xs mu" style="margin-top:8px">${custom ? "Kamu pakai jadwal sendiri." : "Sekarang pakai susunan lama (lari weekday + Sabtu + Minggu)."} Sesi yang udah kamu pindah manual tetap di tanggal pilihanmu. Catatan lari tetap nempel ke sesinya.</p></div>
  <div class="sec" data-tour="sch-preview"><h2>Pratinjau</h2><p class="sm mu">Minggu ini dan minggu depan dengan pilihan di atas (belum disimpan).</p>${previewHtml(D)}</div>`;
}
Object.assign(LIVE, {
  schPref:el => { const D = schedDraft(), k = el.dataset.k; D[k] = el.value === "" ? null : +el.value; render(true); }
});
Object.assign(ACT, {
  schDay:d => { const D = schedDraft(), i = +d.d; D.avail[i] = !D.avail[i]; ["long", "quality", "recovery"].forEach(k => { if(D[k] !== null && !D.avail[D[k]]) D[k] = null; }); if(D.long === null){ const c = D.avail.map((v, j) => v ? j : -1).filter(j => j >= 0).pop(); D.long = c ?? null; } if(D.quality === null){ const c = D.avail.map((v, j) => v ? j : -1).filter(j => j >= 0 && j !== D.long)[0]; D.quality = c ?? null; } render(true); },
  schStr:d => { const D = schedDraft(), i = +d.d; D.strength = D.strength.includes(i) ? D.strength.filter(x => x !== i) : [...D.strength, i].slice(-3); render(true); },
  schFreq:d => { const f = +d.v, D = schedDraft(); if(f === D.freq) return; M = {kind:"confirm", title:`Ganti jadi ${f} lari per minggu?`, msg:f === 2 ? "Recovery run nggak dijadwalkan lagi, jadi total km mingguan turun. Long run dan sesi cepat tetap. Cocok kalau waktumu sempit atau badan butuh pulih." : f === 4 ? "Satu easy run pendek (maks 5 km) ditambahkan di hari yang nggak nempel sesi berat, sampai minggu 27. Volume naik sedikit; lewati kalau badan capek." : "Kembali ke program asli: 3 lari per minggu.", ok:"schFreqOk", okId:String(f), okLabel:"Ganti frekuensi"}; render(true); },
  schFreqOk:d => { schedDraft().freq = +d.id; M = null; render(true); toast("Frekuensi diubah di draft. Tap “Simpan jadwal” buat pakai."); },
  schSave:() => {
    const D = SC.cleanSchedule(schedDraft()); if(!D || !D.avail.some(Boolean)){ toast("Pilih minimal satu hari."); return; }
    const okT = v => /^\d{2}:\d{2}$/.test(v), a = (document.getElementById("st-wdt2") || {}).value, b = (document.getElementById("st-wkt2") || {}).value;
    if(okT(a)) S.settings.wdTime = a; if(okT(b)) S.settings.wkTime = b;
    S.schedule = D; S.ui.schedDraft = null; persist(); render(true); toast("Jadwal disimpan. Sesi menyesuaikan hari pilihanmu.");
  },
  schLegacy:() => { S.schedule = null; S.ui.schedDraft = null; persist(); render(true); toast("Kembali ke susunan lama."); }
});

/* ===================== Race events & replanning ===================== */
function allEvents(){ const evs = Object.values(S.events || {}); if(!evs.some(e => e.id === "jakim-2027")) evs.unshift(SC.defaultEvent(S.settings)); return evs.sort((a, b) => a.eventDate.localeCompare(b.eventDate)); }
const ST_EV = {planned:"Direncanakan", confirmed:"Terkonfirmasi", postponed:"Ditunda", cancelled:"Dibatalkan", completed:"Selesai", archived:"Diarsipkan"};
function eventCard(){
  const ev = activeEvent(), days = Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY), bad = ["postponed", "cancelled"].includes(ev.eventStatus);
  return `<section class="hero-card glass holo-edge" data-tour="race-event">
    <div class="titlerow"><p class="xs mu">Race target</p><span class="chip ${bad ? "missed" : ev.eventStatus === "confirmed" ? "done" : ""}">${ST_EV[ev.eventStatus]}</span></div>
    <h2 style="font-size:24px;margin:4px 0">${esc(ev.name)}</h2>
    <p class="sm mu">${fmtDay(ev.eventDate)} ${parseYmd(ev.eventDate).getFullYear()} · ${fmtKm(evKm(ev))} km${ev.location ? " · " + esc(ev.location) : ""}${ev.targetFinish ? " · target " + esc(ev.targetFinish) : ""}</p>
    <p class="num" style="font-size:40px;margin-top:6px">${days >= 0 ? `<span data-roll="${days}">${days}</span> <span class="sm mu">hari lagi</span>` : `<span class="sm mu">Tanggal udah lewat</span>`}</p>
    ${bad ? `<div class="note warn" style="margin-top:8px">Race ini ${ST_EV[ev.eventStatus].toLowerCase()}. Riwayat latihanmu tetap aman. Pilih race lain supaya sisa jadwal disusun ulang.</div>` : ""}
    ${SC.distanceFactor(ev.distanceKm).note ? `<p class="xs mu" style="margin-top:6px">${esc(SC.distanceFactor(ev.distanceKm).note)}</p>` : ""}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="evList">Ganti / atur race</button><button class="btn sm ghost" data-act="evEdit" data-id="${esc(ev.id)}">Edit race ini</button><button class="btn sm ghost" data-act="raceSheet">Lembar race day</button></div>
  </section>`;
}
function mEvents(){
  const act = activeEvent().id;
  return `${mHead("Race kamu", "Pilih satu race sebagai target utama. Riwayat race lain tetap tersimpan.")}
  <div class="rows">${allEvents().map(e => `<div class="row" style="flex-wrap:wrap"><span class="grow"><b>${esc(e.name)}</b>${e.id === act ? ' <span class="chip today">Target</span>' : ""} <span class="chip">${ST_EV[e.eventStatus]}</span><br><span class="sm mu">${fmtD(e.eventDate)} · ${fmtKm(evKm(e))} km</span></span>
    <span class="btns">${e.id !== act && !["cancelled", "archived", "completed"].includes(e.eventStatus) ? `<button class="btn sm pri" data-act="evPick" data-id="${esc(e.id)}">Jadikan target</button>` : ""}<button class="btn sm ghost" data-act="evEdit" data-id="${esc(e.id)}">Edit</button></span></div>`).join("")}</div>
  <div class="btns" style="margin-top:12px"><button class="btn" data-act="evNew">Tambah race</button></div>`;
}
const DIST_OPTS = [["5", "5K"], ["10", "10K"], ["16.0934", "10 mil"], ["21.0975", "Half marathon (21,1 km)"], ["42.195", "Marathon"], ["custom", "Jarak lain"]];
function mEvent(){
  const e = M.data, std = DIST_OPTS.find(o => Math.abs(+o[0] - e.distanceKm) < 0.01);
  return `${mHead(M.isNew ? "Tambah race" : "Edit race")}
  <div class="field"><label for="ev-name">Nama race</label><input type="text" id="ev-name" maxlength="80" value="${esc(e.name)}"></div>
  <div class="g2"><div class="field"><label for="ev-date">Tanggal</label><input type="date" id="ev-date" value="${esc(e.eventDate)}"></div>
  <div class="field"><label for="ev-status">Status</label><select id="ev-status">${SC.STATUSES.map(s => `<option value="${s}" ${e.eventStatus === s ? "selected" : ""}>${ST_EV[s]}</option>`).join("")}</select></div></div>
  <div class="g2"><div class="field"><label for="ev-dist">Jarak</label><select id="ev-dist">${DIST_OPTS.map(([v, l]) => `<option value="${v}" ${(std ? std[0] === v : v === "custom") ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="field"><label for="ev-km">Km (kalau jarak lain)</label><input type="text" inputmode="decimal" id="ev-km" value="${fmtKm(e.distanceKm)}"></div></div>
  <div class="g2"><div class="field"><label for="ev-target">Target finish</label><input type="text" id="ev-target" placeholder="j:mm:ss" value="${esc(e.targetFinish)}"></div>
  <div class="field"><label for="ev-loc">Lokasi</label><input type="text" id="ev-loc" maxlength="80" value="${esc(e.location)}"></div></div>
  <div class="field"><label for="ev-org">Penyelenggara</label><input type="text" id="ev-org" maxlength="80" value="${esc(e.organizer)}"></div>
  <div class="field"><label for="ev-src">Sumber info (link resmi)</label><input type="text" id="ev-src" placeholder="https://..." value="${esc(e.sourceUrl)}"><span class="hint">Isi dari pengumuman resmi. WeRunIt nggak mengarang jadwal, rute, atau pos minum.</span></div>
  <div id="ev-err"></div>
  <div class="btns"><button class="btn pri" data-act="evSave">Simpan</button>${!M.isNew ? `<button class="btn ghost" data-act="evList">Kembali</button>` : ""}</div>`;
}
/** Weeks from the plan start Monday to the race week (inclusive) for a date. */
function weeksTo(dateStr){ const st = parseYmd(S.settings.startDate), d = parseYmd(dateStr), mon = addDays(d, -((d.getDay() + 6) % 7)); return Math.round((mon - st) / (7 * DAY)) + 1; }
/** Move future per-session settings so they follow their plan week when the calendar mapping changes. */
function rekeyFuture(oldWeeks, newWeeks, curIdx){
  for(const f of ["locked", "elev", "overrides", "status"]){
    const src = S[f], out = {};
    for(const [k, v] of Object.entries(src)){
      const m = k.match(/^w(\d+)-(.+)$/); if(!m){ out[k] = v; continue; }
      const cal = +m[1];
      if(cal <= curIdx + 1){ out[k] = v; continue; }                    // past and current weeks never change
      if(f === "status" || (f === "overrides" && v.date)) { if(f === "overrides"){ const o = Object.assign({}, v); delete o.date; if(Object.keys(o).length) out[k] = o; } continue; }  // old future dates/skips don't apply to a new calendar
      const tn = oldWeeks[cal - 1], j = newWeeks.findIndex((t, i) => i > curIdx && t === tn && !out[`w${i + 1}-${m[2]}`]);
      if(j >= 0) out[`w${j + 1}-${m[2]}`] = v;
    }
    S[f] = out;
  }
}
function proposeReplan(ev){
  const N = weeksTo(ev.eventDate), oldWeeks = S.planMap ? S.planMap.weeks.slice() : PLAN.map((_, i) => i + 1);
  const ci = todayYmd() < PLANW[0].start ? -1 : curWeekIdx();
  if(N < ci + 2) return {error:"Tanggal race ini lebih awal dari minggu latihan sekarang. Pilih race yang masih di depan."};
  if(N > 60) return {error:"Race ini lebih dari 60 minggu dari awal program. Atur ulang tanggal mulai di Settings dulu."};
  const totals = PLAN.map(p => p[0] + p[1] + p[2]);
  const r = N === oldWeeks.length ? {weeks:oldWeeks, changes:["Jumlah minggu persiapan sama. Jadwal tetap, cuma nama/jarak/target race yang berubah."], readiness:"ok"} : SC.replan(oldWeeks, ci, N - (ci + 1), totals);
  const df = SC.distanceFactor(ev.distanceKm);
  return Object.assign(r, {N, oldWeeks, ci, ev, factor:df});
}
function mReplan(){
  const P = M.plan, ev = P.ev;
  return `${mHead("Susun ulang sisa jadwal?", `${esc(ev.name)} · ${fmtD(ev.eventDate)} · ${fmtKm(evKm(ev))} km`)}
  <ul class="clean sm">${P.changes.map(c => `<li>${esc(c)}</li>`).join("")}${P.factor.note ? `<li>${esc(P.factor.note)}</li>` : ""}
    <li>${P.ci >= 0 ? `Latihan yang udah dijalani (minggu 1–${P.ci + 1}) dan semua catatan lari tetap seperti apa adanya.` : "Program belum mulai, jadi belum ada latihan yang berubah. Semua catatan lari tetap seperti apa adanya."}</li>
    <li>Total minggu program: ${P.oldWeeks.length} → ${P.weeks.length}. Taper 3 minggu sebelum race.</li></ul>
  ${P.readiness !== "ok" ? `<div class="note ${P.readiness === "insufficient" ? "bad" : "warn"}" style="margin-top:10px">${P.readiness === "insufficient" ? "<b>Persiapan nggak cukup.</b> WeRunIt nggak akan bikin rencana agresif buat ngejar waktu. Pertimbangkan target santai, jarak lebih pendek, atau race yang lebih jauh tanggalnya." : "<b>Persiapan ketat.</b> Dengarkan badan, jangan paksa target waktu."}</div>` : ""}
  <div class="btns" style="margin-top:14px"><button class="btn pri" data-act="replanOk">Pakai jadwal baru</button><button class="btn ghost" data-act="closeM">Batal</button></div>`;
}
function applyEventAsTarget(ev, plan){
  if(plan && plan.weeks !== plan.oldWeeks && plan.weeks.join() !== plan.oldWeeks.join()){
    rekeyFuture(plan.oldWeeks, plan.weeks, plan.ci);
    const identity = plan.weeks.length === 31 && plan.weeks.every((t, i) => t === i + 1);
    S.planMap = identity ? null : {weeks:plan.weeks, eventId:ev.id, at:new Date().toISOString(), note:plan.changes.join(" ")};
  }
  const prev = activeEvent();
  if(Math.abs(prev.distanceKm - ev.distanceKm) > 0.05 && S.racePrefs.custom){   // custom splits belong to the old distance
    Object.assign(S.racePrefs, {custom:null, locked:[], strategy:"conservative"}); touchRace();
  }
  S.settings.activeEvent = ev.id;
  S.settings.raceDate = ev.eventDate;                                  // v3 code paths keep reading these
  if(/^\d{1,2}:\d{2}:\d{2}$/.test(ev.targetFinish || "")) S.settings.goalTime = ev.targetFinish;
}
Object.assign(ACT, {
  evList:() => { M = {kind:"events"}; render(true); },
  evNew:() => { M = {kind:"event", isNew:true, data:{id:"", name:"", organizer:"", eventDate:ymd(addDays(new Date(), 120)), distanceKm:21.0975, location:"", targetFinish:S.settings.goalTime, eventStatus:"planned", aidStations:[], cutOffTimes:[], courseProfile:null, sourceUrl:""}}; render(true); },
  evEdit:d => { const e = allEvents().find(x => x.id === d.id); if(e){ M = {kind:"event", isNew:false, data:HMTP.clone(e)}; render(true); } },
  evSave:() => {
    const g = id => (document.getElementById(id) || {}).value || "", e = M.data, errs = [];
    const dsel = g("ev-dist"), km = dsel === "custom" ? num(g("ev-km")) : +dsel;
    const tf = g("ev-target").trim(), ts = tf ? parseDur(tf) : null;
    if(!g("ev-name").trim()) errs.push("Nama race wajib diisi.");
    if(!validYmd(g("ev-date"))) errs.push("Tanggal belum bener.");
    if(!(km >= 1 && km <= 250)) errs.push("Jarak 1–250 km.");
    if(tf && (!ts || isNaN(ts))) errs.push("Target finish pakai format j:mm:ss.");
    const src = g("ev-src").trim(); if(src && !/^https:\/\//.test(src)) errs.push("Link sumber harus https://.");
    if(errs.length){ document.getElementById("ev-err").innerHTML = `<p class="err">${errs.join("<br>")}</p>`; return; }
    const now = new Date().toISOString();
    const id = e.id || (g("ev-name").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "race") + "-" + uid().slice(-4);
    const next = SC.cleanEvent(Object.assign({}, e, {id, name:g("ev-name").trim(), eventDate:g("ev-date"), distanceKm:km, targetFinish:ts ? fmtDur(ts) : "", location:g("ev-loc").trim(), organizer:g("ev-org").trim(), eventStatus:g("ev-status"), sourceUrl:src, createdAt:e.createdAt || now, updatedAt:now}));
    S.events = Object.assign({}, S.events, {[id]:next});
    const isActive = activeEvent().id === id || (!S.settings.activeEvent && id === "jakim-2027");
    if(isActive && !["cancelled", "postponed", "archived"].includes(next.eventStatus)){
      const plan = proposeReplan(next);
      if(plan.error){ persist(); M = null; render(true); toast(plan.error); return; }
      if(plan.weeks.join() !== plan.oldWeeks.join()){ M = {kind:"replan", plan}; render(true); return; }
      applyEventAsTarget(next, plan);
    }
    persist(); M = {kind:"events"}; render(true); toast(isActive && ["cancelled", "postponed"].includes(next.eventStatus) ? "Disimpan. Pilih race lain buat menyusun ulang sisa jadwal." : "Race disimpan.");
  },
  evPick:d => {
    const ev = allEvents().find(x => x.id === d.id); if(!ev) return;
    if(!S.events[ev.id]) S.events = Object.assign({}, S.events, {[ev.id]:ev});
    const plan = proposeReplan(ev);
    if(plan.error){ toast(plan.error); return; }
    M = {kind:"replan", plan}; render(true);
  },
  replanOk:() => { const P = M.plan; applyEventAsTarget(P.ev, P); persist(); M = null; render(false); toast("Sisa jadwal disusun ulang untuk " + P.ev.name + "."); }
});

/* ===================== Race-day workspace ===================== */
const RTAB_LBL = {overview:"Ringkasan", pace:"Strategi pace", splits:"Split per km", elev:"Elevasi", hydration:"Hidrasi", fuel:"Energi", hr:"Detak jantung", stations:"Pos & cut-off", checklist:"Checklist"};
function racePlanData(){
  const ev = activeEvent(), D = ev.distanceKm, rp = S.racePrefs;
  const target = parseDur(ev.targetFinish || S.settings.goalTime) || null;
  const pred = RS.predict(S.logs, D, {targetSec:target, recent:rp.recent, exp:rp.exp});
  const T = target || pred.seconds || D * 420;
  const n = RS.segments(D).length;
  const elev = ev.courseProfile ? RS.elevPerSegment(ev.courseProfile.points, D) : null;
  const custom = rp.strategy === "custom" && rp.custom && rp.custom.length === n ? rp.custom : null;
  const paces = RS.strategy(custom ? "custom" : rp.strategy === "elevation" && !elev ? "even" : rp.strategy, T, D, {startDelta:rp.startDelta, splitPct:rp.splitPct, elev, custom});
  return {ev, D, rp, target, pred, T, paces, elev, rows:RS.splitRows(paces, D)};
}
function confChip(c){ return `<span class="chip ${c === "high" ? "done" : c === "medium" ? "" : "missed"}">${{high:"Keyakinan tinggi", medium:"Keyakinan sedang", low:"Keyakinan rendah", none:"Belum bisa diperkirakan"}[c]}</span>`; }
function raceTabs(){
  const rp = S.racePrefs, tabs = rp.tabs.filter(t => !rp.hidden.includes(t)), cur = tabs.includes(S.ui.raceTab) ? S.ui.raceTab : "overview";
  return {tabs, cur, html:`<div class="rtabs-wrap"><div class="rtabs glass" role="tablist" id="rtabs"><div class="glass-pill"><i class="lens"></i></div>${tabs.map(t => `<button role="tab" aria-selected="${t === cur}" class="${t === cur ? "on" : ""}" data-act="raceTab" data-t="${t}">${RTAB_LBL[t]}</button>`).join("")}</div><button class="helpbtn" data-act="raceTabsCfg" aria-label="Atur tab" title="Atur tab">⋯</button></div>`};
}
function tabOverview(P){
  const p = P.pred, ev = P.ev;
  return `<div class="card"><h3>Perkiraan finish ${fmtKm(evKm(ev))} km</h3>
    ${p.seconds ? `<p class="num" style="font-size:56px;line-height:.9">${fmtDur(p.seconds)} <span class="sm mu">${fmtPace(p.seconds / P.D)}</span></p>` : `<p class="mu">Belum bisa diperkirakan.</p>`}
    <p style="margin:6px 0">${confChip(p.confidence)} ${p.source === "target" ? '<span class="chip">pakai target kamu</span>' : ""}</p>
    ${p.sensitivity ? `<p class="xs mu">Rentang (eksponen 1,04–1,08): ${fmtDur(p.sensitivity.low)} – ${fmtDur(p.sensitivity.high)}</p>` : ""}
    <details class="method" style="margin-top:8px"><summary class="sm">Cara hitung dan data yang dipakai</summary><div class="bd">
    <p class="sm" style="margin-top:4px">${esc(p.method)}</p>
    ${p.used.length ? `<div class="scroll"><table class="t" style="margin-top:8px"><tr><th>Data</th><th>Hasil</th><th>Setara</th><th>Bobot</th></tr>${p.used.slice(0, 6).map(u => `<tr><td>${esc(TYPES[u.label] || u.label)} ${u.date ? fmtD(u.date) : ""}</td><td class="tab">${fmtKm(u.km)} km · ${fmtDur(u.sec)}</td><td class="tab">${fmtDur(u.estimate)}</td><td class="tab">${Math.round(u.weight / p.used.reduce((a, x) => a + x.weight, 0) * 100)}%</td></tr>`).join("")}</table></div>` : ""}
    ${p.assumptions.length ? `<p class="sm" style="margin-top:8px"><b>Asumsi:</b></p><ul class="clean sm">${p.assumptions.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
    <p class="sm" style="margin-top:6px"><b>Keterbatasan:</b></p><ul class="clean sm">${p.limitations.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
    </div></details>
    ${p.excluded && p.excluded.length ? `<details style="margin-top:6px"><summary class="sm">${p.excluded.length} catatan nggak dipakai</summary><div class="bd"><ul class="clean xs">${p.excluded.slice(0, 20).map(x => `<li>${fmtD(x.log.date)} ${fmtKm(x.log.distance)} km: ${esc(x.reason)}</li>`).join("")}</ul></div></details>` : ""}
  </div>
  <div class="card" style="margin-top:12px"><h3>Hasil race / tes terbaru (opsional)</h3><p class="xs mu">Isi hasil yang nggak ada di log (misal race tahun lalu). Ini dipakai sebagai sesi usaha.</p>
    ${P.rp.recent.map((r, i) => `<div class="kv"><span>${esc(r.label || "Hasil")} ${fmtKm(r.km)} km ${r.date ? "· " + fmtD(r.date) : ""}</span><span>${fmtDur(r.sec)} <button class="link sm" data-act="rcRecentDel" data-i="${i}">hapus</button></span></div>`).join("")}
    <div class="g3" style="margin-top:8px"><div class="field"><label for="rr-km">Km</label><input type="text" inputmode="decimal" id="rr-km" placeholder="10"></div><div class="field"><label for="rr-t">Waktu</label><input type="text" id="rr-t" placeholder="55:30"></div><div class="field"><label for="rr-d">Tanggal</label><input type="date" id="rr-d"></div></div>
    <div class="btns"><button class="btn sm" data-act="rcRecentAdd">Tambah</button><label class="sm mu" style="display:flex;align-items:center;gap:6px">Eksponen <select id="rr-exp" data-live="rcExp" style="width:auto;min-height:32px">${[1.04, 1.06, 1.08].map(x => `<option ${P.rp.exp === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div></div>`;
}
function tabPace(P){
  const rp = P.rp, h = Math.floor(P.rows.length / 2), first = P.rows[h - 1].cum, second = P.T - first;
  return `<div class="card"><h3>Strategi</h3><div class="seg" style="flex-wrap:wrap">${Object.entries(RS.STRATS).map(([k, l]) => `<button class="${rp.strategy === k ? "on" : ""}" data-act="rcStrat" data-v="${k}" ${k === "elevation" && !P.elev ? "disabled title='Butuh profil rute (tab Elevasi)'" : ""}>${l}</button>`).join("")}</div>
    ${rp.strategy === "conservative" ? `<div class="field" style="margin-top:10px"><label for="rc-sd">5 km pertama lebih lambat (detik/km)</label><input type="number" id="rc-sd" min="0" max="60" value="${rp.startDelta}" data-live="rcNum" data-k="startDelta"></div>` : ""}
    ${["negative", "positive"].includes(rp.strategy) ? `<div class="field" style="margin-top:10px"><label for="rc-sp">Beda pace paruh 1 vs 2 (%)</label><input type="number" id="rc-sp" min="0" max="8" step="0.5" value="${rp.splitPct}" data-live="rcNum" data-k="splitPct"></div>` : ""}
    <div class="stats c3" style="margin-top:12px"><div><div class="v num">${fmtPace(P.T / P.D, false)}</div><div class="l">Rata-rata ${unitLbl()}</div></div><div><div class="v num">${fmtDur(first)}</div><div class="l">Paruh pertama</div></div><div><div class="v num">${fmtDur(second)}</div><div class="l">Paruh kedua</div></div></div>
    <p class="xs mu" style="margin-top:8px">Total selalu sama dengan target ${fmtDur(P.T)}. ${rp.strategy === "elevation" ? "Penyesuaian tanjakan ~6 detik per 10 m naik per km, ~3 detik kembali per 10 m turun (perkiraan)." : ""}</p>
    ${paceChart(P)}</div>`;
}
function paceChart(P){
  const W = 340, H = 120, ps = P.paces, lo = Math.min(...ps) - 8, hi = Math.max(...ps) + 8, bw = (W - 30) / ps.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pace per km"><text x="0" y="10" class="ax">lebih lambat</text><text x="0" y="${H - 2}" class="ax">lebih cepat</text>${ps.map((p, i) => { const y = 14 + (H - 30) * (1 - (p - lo) / (hi - lo)); return `<rect x="${28 + i * bw}" y="${y}" width="${Math.max(2, bw - 2)}" height="${H - 16 - y}" rx="2" fill="url(#wri-ring-holo)" opacity="${P.rows[i].five ? 1 : 0.7}"><title>km ${i + 1}: ${fmtPace(p)}</title></rect>`; }).join("")}</svg>`;
}
function tabSplits(P){
  const cut = P.ev.cutOffTimes || [];
  return `<div class="card"><h3>Split per km</h3><p class="xs mu">Ubah pace satu km: km sesudahnya otomatis disesuaikan supaya total tetap ${fmtDur(P.T)}. Km yang kamu ubah dikunci.</p>
  <div class="scroll"><table class="t splits"><tr><th>KM</th><th>Pace</th><th>Waktu</th><th>Sisa</th><th>Jam</th></tr>${P.rows.map(r => {
    const c = cut.find(x => Math.abs(x.km - r.km) < 0.6), over = c && r.cum > parseDur(c.time);
    return `<tr class="${r.five ? "five" : ""}"><td>${fmtKm(r.km)}${P.rp.locked.includes(r.i) ? " · kunci" : ""}</td><td><input class="pace-in" type="text" value="${fmtPace(r.pace, false)}" data-live="rcSplit" data-i="${r.i}" aria-label="Pace km ${r.i + 1}"></td><td class="tab"><b>${fmtDur(r.cum)}</b>${c ? `<br><span class="xs ${over ? "err" : "mu"}">cut-off ${esc(c.time)}${over ? " · lewat" : ""}</span>` : ""}</td><td class="tab">${fmtKm(r.remaining)}</td><td class="tab mu">${fmtClock(P.rp.startTime, r.cum)}</td></tr>`; }).join("")}</table></div>
  <div class="btns" style="margin-top:8px"><button class="btn sm ghost" data-act="rcSplitReset">Reset split</button><label class="sm mu" style="display:flex;align-items:center;gap:6px">Jam start <input type="time" id="rc-start" value="${esc(P.rp.startTime)}" data-live="rcStart" style="width:auto;min-height:32px"></label></div></div>`;
}
function tabElev(P){
  const pr = P.ev.courseProfile;
  if(!pr) return `<div class="card"><h3>Profil rute</h3><p class="sm">Belum ada data rute. Upload file GPX rute resmi (atau rekaman lari di rute yang sama) buat dapat tanjakan per km dan strategi sesuai tanjakan.</p>
    <div class="field" style="margin-top:8px"><label for="course-file">File GPX rute</label><input type="file" id="course-file" accept=".gpx,application/gpx+xml"></div>
    <svg class="chart" viewBox="0 0 340 80" role="img" aria-label="Ilustrasi"><path d="M0 60 H340" stroke="var(--line)" stroke-dasharray="4 4"/></svg><p class="xs mu">Garis datar = ilustrasi perencanaan, <b>bukan rute resmi</b>.</p></div>`;
  const pts = pr.points, maxKm = pts[pts.length - 1][0], eles = pts.map(p => p[1]), lo = Math.min(...eles), hi = Math.max(...eles) + 1, W = 340, H = 110;
  const d = pts.filter((_, i) => i % Math.ceil(pts.length / 300) === 0).map((p, i) => `${i ? "L" : "M"}${(p[0] / maxKm * W).toFixed(1)} ${(H - 10 - (p[1] - lo) / (hi - lo) * (H - 20)).toFixed(1)}`).join(" ");
  return `<div class="card"><h3>Profil rute</h3><p class="xs mu">Sumber: ${esc(pr.source)} · ${fmtKm(maxKm)} km · naik total ${Math.round(P.elev ? P.elev.filter(x => x > 0).reduce((a, x) => a + x, 0) : 0)} m</p>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profil elevasi"><path d="${d} L${W} ${H} L0 ${H}Z" fill="rgba(150,115,255,.18)"/><path d="${d}" fill="none" stroke="url(#wri-ring-holo)" stroke-width="2"/></svg>
    ${P.elev ? `<div class="scroll"><table class="t"><tr><th>KM</th><th>Naik/turun</th><th>Pace</th></tr>${P.elev.map((e, i) => `<tr><td>${i + 1}</td><td class="tab">${e > 0 ? "+" : ""}${e} m</td><td class="tab">${fmtPace(P.paces[i])}</td></tr>`).join("")}</table></div>` : ""}
    ${Math.abs(maxKm - P.D) > 0.5 ? `<div class="note warn">Panjang file (${fmtKm(maxKm)} km) beda dengan jarak race (${fmtKm(P.D)} km). Cek file-nya.</div>` : ""}
    <div class="btns" style="margin-top:8px"><button class="btn sm ghost" data-act="courseDel">Hapus profil</button></div></div>`;
}
function tabHydration(P){
  const pr = S.profile, h = RS.hydration({durationSec:P.T, sweatRateLph:pr.sweatRate, stations:P.ev.aidStations, paces:P.paces, D:P.D, tempC:P.rp.tempC, humidity:P.rp.humidity});
  return `<div class="card"><h3>Hidrasi</h3>
    <div class="g3"><div class="field"><label for="hy-sw">Sweat rate (L/jam)</label><input type="text" inputmode="decimal" id="hy-sw" value="${pr.sweatRate ?? ""}" placeholder="opsional" data-live="prNum" data-k="sweatRate"></div>
    <div class="field"><label for="hy-t">Suhu (°C)</label><input type="text" inputmode="decimal" id="hy-t" value="${P.rp.tempC ?? ""}" placeholder="perkiraan" data-live="rcNum" data-k="tempC"></div>
    <div class="field"><label for="hy-h">Lembap (%)</label><input type="text" inputmode="decimal" id="hy-h" value="${P.rp.humidity ?? ""}" placeholder="perkiraan" data-live="rcNum" data-k="humidity"></div></div>
    ${h.perHour ? `<p class="num" style="font-size:22px">${String(h.perHour[0]).replace(".", ",")}–${String(h.perHour[1]).replace(".", ",")} L/jam <span class="sm mu">total ±${String(h.total[0]).replace(".", ",")}–${String(h.total[1]).replace(".", ",")} L</span></p>` : ""}
    <ul class="clean sm">${h.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>
    ${h.checkpoints.length ? `<div class="scroll"><table class="t" style="margin-top:8px"><tr><th>KM</th><th>Perkiraan jam</th><th>Rencana</th></tr>${h.checkpoints.map(c => `<tr><td>${fmtKm(c.km)}${c.label ? " · " + esc(c.label) : ""}<br><span class="xs ${c.verified ? "mu" : "err"}">${c.verified ? "terverifikasi" : "Lokasi pos belum terverifikasi — sesuaikan rencanamu"}</span></td><td class="tab">${fmtDur(c.at)} · ${fmtClock(P.rp.startTime, c.at)}</td><td>${esc(c.sip)}</td></tr>`).join("")}</table></div>` : `<p class="sm mu" style="margin-top:8px">Belum ada pos minum. Tambahkan di tab “Pos & cut-off” dari info resmi.</p>`}</div>`;
}
function tabFuel(P){
  const pr = S.profile, f = RS.fuel({durationSec:P.T, carbsPerServing:P.rp.carbs, massKg:pr.massKg, D:P.D, gph:P.rp.gph});
  return `<div class="card"><h3>Energi & makan saat race</h3>
    <div class="g2"><div class="field"><label for="fu-p">Produk (gel, dll)</label><input type="text" id="fu-p" maxlength="60" value="${esc(P.rp.product)}" data-live="rcStr" data-k="product"></div>
    <div class="field"><label for="fu-c">Karbo per sajian (g, dari label)</label><input type="text" inputmode="decimal" id="fu-c" value="${P.rp.carbs ?? ""}" data-live="rcNum" data-k="carbs"></div></div>
    <div class="g2"><div class="field"><label for="fu-g">Target karbo (g/jam, opsional)</label><input type="text" inputmode="decimal" id="fu-g" value="${P.rp.gph ?? ""}" data-live="rcNum" data-k="gph"></div>
    <div class="field"><label for="fu-m">Berat badan (kg, opsional)</label><input type="text" inputmode="decimal" id="fu-m" value="${pr.massKg ?? ""}" data-live="prNum" data-k="massKg"></div></div>
    ${f.energy ? `<p class="sm">Perkiraan energi: <b>${f.energy[0]}–${f.energy[1]} kkal</b> (perkiraan, bukan pengukuran)</p>` : ""}
    ${f.servings ? `<p class="sm" style="margin-top:6px"><b>${f.servings}×</b> ${esc(P.rp.product || "sajian")} · minum air bareng tiap sajian</p><ul class="clean sm">${f.schedule.map(x => `<li>Menit ${x.min} (±km ${fmtKm(Math.min(P.D, x.min * 60 / (P.T / P.D)))}) · ${x.grams} g</li>`).join("")}</ul>` : ""}
    <ul class="clean sm" style="margin-top:6px">${f.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
}
function tabHr(P){
  const g = RS.hrGuidance({hrMax:S.profile.hrMax, history:S.logs, D:P.D, tempC:P.rp.tempC});
  return `<div class="card"><h3>Detak jantung</h3>
    <div class="field"><label for="hr-max">HR maksimal yang pernah terukur (bpm)</label><input type="text" inputmode="numeric" id="hr-max" value="${S.profile.hrMax ?? ""}" placeholder="kosongkan kalau belum tahu" data-live="prNum" data-k="hrMax"></div>
    ${g.configured ? `<div class="scroll"><table class="t"><tr><th>Zona</th><th>bpm</th></tr>${g.zones.map((z, i) => `<tr><td>Z${i + 1}</td><td class="tab">${z[0]}–${z[1]}</td></tr>`).join("")}</table></div><p class="sm" style="margin-top:8px">Effort race ${fmtKm(evKm(P.ev))} km biasanya sekitar <b>${g.raceRange[0]}–${g.raceRange[1]} bpm</b>, naik pelan di paruh kedua.</p>
      ${g.history.length ? `<p class="sm" style="margin-top:8px"><b>Riwayat HR (dari catatanmu):</b></p><ul class="clean xs">${g.history.slice(-8).reverse().map(h => `<li>${fmtD(h.date)}: rata-rata ${h.hrAvg}${h.hrMax ? `, maks ${h.hrMax}` : ""} bpm${h.pace ? ` · ${fmtPace(h.pace)}` : ""}</li>`).join("")}</ul>` : `<p class="xs mu">Belum ada lari dengan HR tercatat.</p>`}` : ""}
    <ul class="clean sm" style="margin-top:6px">${g.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
}
function tabStations(P){
  const ev = P.ev;
  return `<div class="card"><h3>Pos minum / makan</h3><p class="xs mu">Isi dari race guide resmi. Centang “resmi” cuma kalau sudah dicek di sumber resmi.</p>
    ${ev.aidStations.map((a, i) => `<div class="kv"><span>KM ${fmtKm(a.km)} ${esc(a.label)} ${a.verified ? '<span class="chip done">resmi</span>' : '<span class="chip missed">belum terverifikasi</span>'}</span><button class="link sm" data-act="stDel" data-i="${i}">hapus</button></div>`).join("") || `<p class="sm mu">Belum ada.</p>`}
    <div class="g3" style="margin-top:8px"><div class="field"><label for="st-km">KM</label><input type="text" inputmode="decimal" id="st-km"></div><div class="field"><label for="st-lb">Nama</label><input type="text" id="st-lb" maxlength="40" placeholder="Pos 1"></div><div class="field"><span class="lbl">Resmi?</span><label class="toggle" style="border:0;padding:6px 0"><span class="sm">Terverifikasi</span><input type="checkbox" id="st-ver"></label></div></div>
    <button class="btn sm" data-act="stAdd">Tambah pos</button></div>
  <div class="card" style="margin-top:12px"><h3>Cut-off</h3>
    ${(ev.cutOffTimes || []).map((c, i) => `<div class="kv"><span>KM ${fmtKm(c.km)}</span><span>${esc(c.time)} <button class="link sm" data-act="coDel" data-i="${i}">hapus</button></span></div>`).join("") || `<p class="sm mu">Belum ada. Isi dari race guide resmi.</p>`}
    <div class="g2" style="margin-top:8px"><div class="field"><label for="co-km">KM</label><input type="text" inputmode="decimal" id="co-km"></div><div class="field"><label for="co-t">Waktu dari start</label><input type="text" id="co-t" placeholder="j:mm:ss"></div></div>
    <button class="btn sm" data-act="coAdd">Tambah cut-off</button></div>`;
}
function vRace(){
  const P = racePlanData(), T = raceTabs();
  const body = {overview:tabOverview, pace:tabPace, splits:tabSplits, elev:tabElev, hydration:tabHydration, fuel:tabFuel, hr:tabHr, stations:tabStations, checklist:() => raceChecklist()}[T.cur](P);
  return `${pageHead("Race", "Rencana race day dari data aslimu: perkiraan finish, pace, split, hidrasi, energi, dan detak jantung.")}
  <div style="margin-top:10px">${eventCard()}</div>
  <div data-tour="race-tabs" style="margin-top:14px">${T.html}</div>
  <div style="margin-top:12px" data-tour="race-body">${body}</div>`;
}
function mRaceTabs(){
  const rp = S.racePrefs;
  return `${mHead("Atur tab race", "Urutkan dan sembunyikan tab yang nggak kamu pakai.")}<div class="rows">${rp.tabs.map((t, i) => `<div class="row"><span class="grow">${RTAB_LBL[t]}</span>${t !== "overview" ? `<label class="sm" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="rtHide" data-t="${t}" ${rp.hidden.includes(t) ? "" : "checked"}>tampil</label>` : ""}<button class="btn sm ghost" data-act="rtMove" data-t="${t}" data-v="-1" ${i ? "" : "disabled"} aria-label="Naik">↑</button><button class="btn sm ghost" data-act="rtMove" data-t="${t}" data-v="1" ${i < rp.tabs.length - 1 ? "" : "disabled"} aria-label="Turun">↓</button></div>`).join("")}</div>`;
}
let RT_PILL = null;
const _afterPaint = afterPaint;
afterPaint = function(){
  _afterPaint();
  const bar = document.getElementById("rtabs");
  if(bar){
    const btns = [...bar.querySelectorAll("button")], i = btns.findIndex(b => b.classList.contains("on"));
    const geo = () => { const r = bar.getBoundingClientRect(), q = btns.map(b => { const x = b.getBoundingClientRect(); return [x.left - r.left + bar.scrollLeft, x.width]; }); return {tabX:k => { const a = Math.floor(k), b = Math.min(q.length - 1, a + 1), f = k - a; return (q[a][0] + q[a][1] / 2) * (1 - f) + (q[b][0] + q[b][1] / 2) * f; }, half:Math.max(30, q[Math.max(0, i)][1] / 2), minX:2, maxX:bar.scrollWidth - 2, baseH:36, cy:r.height / 2}; };
    RT_PILL = new WRI_MOTION.GlassPill(bar.querySelector(".glass-pill"), Object.assign(geo(), {start:S.ui.raceTabPrevIdx ?? i}));
    RT_PILL.go(i); S.ui.raceTabPrevIdx = i;
    if(btns[i]) btns[i].scrollIntoView({block:"nearest", inline:"center"});
  }
};
Object.assign(ACT, {
  raceTab:d => { S.ui.raceTab = d.t; render(true); },
  raceTabsCfg:() => { M = {kind:"racetabs"}; render(true); },
  rtHide:d => { const rp = S.racePrefs; rp.hidden = rp.hidden.includes(d.t) ? rp.hidden.filter(x => x !== d.t) : [...rp.hidden, d.t]; touchRace(); persist(); render(true); },
  rtMove:d => { const rp = S.racePrefs, i = rp.tabs.indexOf(d.t), j = i + +d.v; if(j < 0 || j >= rp.tabs.length) return; [rp.tabs[i], rp.tabs[j]] = [rp.tabs[j], rp.tabs[i]]; touchRace(); persist(); render(true); },
  rcStrat:d => { S.racePrefs.strategy = d.v; if(d.v !== "custom"){ S.racePrefs.custom = null; S.racePrefs.locked = []; } touchRace(); persist(); render(true); },
  rcSplitReset:() => { S.racePrefs.custom = null; S.racePrefs.locked = []; if(S.racePrefs.strategy === "custom") S.racePrefs.strategy = "conservative"; touchRace(); persist(); render(true); },
  rcRecentAdd:() => { const km = num(document.getElementById("rr-km").value), t = parseDur(document.getElementById("rr-t").value), d = document.getElementById("rr-d").value; if(!(km > 0) || !t || isNaN(t)){ toast("Isi km dan waktu (mm:ss atau j:mm:ss)."); return; } S.racePrefs.recent = [...S.racePrefs.recent, {km, sec:t, date:validYmd(d) ? d : "", label:"Hasil race"}].slice(-10); touchRace(); persist(); render(true); },
  rcRecentDel:d => { S.racePrefs.recent = S.racePrefs.recent.filter((_, i) => i !== +d.i); touchRace(); persist(); render(true); },
  stAdd:() => { const ev = activeEvent(), km = num(document.getElementById("st-km").value); if(!(km > 0 && km <= ev.distanceKm)){ toast("KM pos harus di dalam jarak race."); return; } saveEvent(Object.assign({}, ev, {aidStations:[...ev.aidStations, {km, label:document.getElementById("st-lb").value.trim().slice(0, 40), verified:document.getElementById("st-ver").checked}].sort((a, b) => a.km - b.km)})); },
  stDel:d => { const ev = activeEvent(); saveEvent(Object.assign({}, ev, {aidStations:ev.aidStations.filter((_, i) => i !== +d.i)})); },
  coAdd:() => { const ev = activeEvent(), km = num(document.getElementById("co-km").value), t = document.getElementById("co-t").value.trim(); if(!(km > 0) || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)){ toast("Isi KM dan waktu cut-off."); return; } saveEvent(Object.assign({}, ev, {cutOffTimes:[...(ev.cutOffTimes || []), {km, time:t}].sort((a, b) => a.km - b.km)})); },
  coDel:d => { const ev = activeEvent(); saveEvent(Object.assign({}, ev, {cutOffTimes:ev.cutOffTimes.filter((_, i) => i !== +d.i)})); },
  courseDel:() => { const ev = activeEvent(); saveEvent(Object.assign({}, ev, {courseProfile:null})); }
});
function saveEvent(ev){ const c = SC.cleanEvent(Object.assign({}, ev, {updatedAt:new Date().toISOString()})); if(!c) return; S.events = Object.assign({}, S.events, {[c.id]:c}); if(!S.settings.activeEvent) S.settings.activeEvent = c.id; persist(); render(true); }
Object.assign(LIVE, {
  rcNum:el => { const v = el.value.trim() === "" ? null : num(el.value); S.racePrefs[el.dataset.k] = isNaN(v) ? null : v; S.racePrefs = HMTP.cleanRacePrefs(Object.assign({}, S.racePrefs, {touched:true})); persist(); rerenderKeepFocus(el.id); },
  rcStr:el => { S.racePrefs[el.dataset.k] = el.value.slice(0, 60); touchRace(); persist(); },
  rcExp:el => { S.racePrefs.exp = +el.value; touchRace(); persist(); render(true); },
  rcStart:el => { if(/^\d{2}:\d{2}$/.test(el.value)){ S.racePrefs.startTime = el.value; touchRace(); persist(); rerenderKeepFocus(el.id); } },
  prNum:el => { const v = el.value.trim() === "" ? null : num(el.value); S.profile = HMTP.cleanProfile(Object.assign({}, S.profile, {[el.dataset.k]:isNaN(v) ? null : v})); persist(); rerenderKeepFocus(el.id); },
  rcSplit:el => {
    const P = racePlanData(), i = +el.dataset.i, p = parsePace(el.value);
    if(!p || isNaN(p)) return;
    const r = RS.editSplit(P.paces, P.D, i, p, S.racePrefs.locked);
    if(!r.balanced){ toast(r.warning || "Nggak ada km sesudahnya buat menyeimbangkan."); return; }
    Object.assign(S.racePrefs, {strategy:"custom", custom:r.paces, locked:[...new Set([...S.racePrefs.locked, i])]}); touchRace(); persist(); rerenderKeepFocus(null);
  }
});
/** Re-render on input without stealing focus mid-typing (only for blur/change-driven fields). */
function rerenderKeepFocus(id){ clearTimeout(rerenderKeepFocus.t); rerenderKeepFocus.t = setTimeout(() => { const a = document.activeElement; if(a && a.id && a.id === id && a.tagName === "INPUT") return; render(true); }, 650); }
document.addEventListener("change", e => {
  const el = e.target;
  if(el.classList && el.classList.contains("pace-in")) LIVE.rcSplit(el);
  if(el.id === "course-file" && el.files && el.files[0]) el.files[0].text().then(t => {
    try{
      const doc = new DOMParser().parseFromString(t, "application/xml"), pts = [...doc.getElementsByTagNameNS("*", "trkpt")];
      if(pts.length < 2) throw 0;
      let km = 0, out = [], prev = null;
      for(const p of pts){ const q = {lat:+p.getAttribute("lat"), lon:+p.getAttribute("lon")}, e2 = childTxt(p, "ele"); if(prev) km += hav(prev, q) / 1000; prev = q; if(e2 !== null) out.push([km, +e2]); }
      if(out.length < 2) throw 0;
      const ev = activeEvent(); saveEvent(Object.assign({}, ev, {courseProfile:{source:`GPX: ${el.files[0].name.slice(0, 60)}`, points:out}}));
      toast("Profil rute dimuat dari file kamu.");
    }catch(err){ toast("File GPX ini nggak punya titik rute dengan ketinggian."); }
  });
});

/* ===================== Race-day sheet: print/PDF, image, share ===================== */
function sheetHtml(){
  const P = racePlanData(), ev = P.ev, f = RS.fuel({durationSec:P.T, carbsPerServing:P.rp.carbs, massKg:S.profile.massKg, D:P.D, gph:P.rp.gph}), h = RS.hydration({durationSec:P.T, sweatRateLph:S.profile.sweatRate, stations:ev.aidStations, paces:P.paces, D:P.D, tempC:P.rp.tempC}), hr = RS.hrGuidance({hrMax:S.profile.hrMax, D:P.D});
  return `<div class="race-sheet" id="race-sheet">
    <div class="titlerow"><div><h2>${esc(ev.name)}</h2><p class="sm mu">${fmtDay(ev.eventDate)} ${parseYmd(ev.eventDate).getFullYear()} · ${fmtKm(evKm(ev))} km · start ${esc(P.rp.startTime)}</p></div>${WRI_BRAND.mark({size:40})}</div>
    <p style="margin-top:8px"><b>Target ${fmtDur(P.T)}</b> (${fmtPace(P.T / P.D)}) · strategi ${esc(RS.STRATS[P.rp.strategy])}${P.pred.seconds && P.pred.source === "data" ? ` · perkiraan data ${fmtDur(P.pred.seconds)} (${esc({high:"keyakinan tinggi", medium:"sedang", low:"rendah"}[P.pred.confidence])})` : ""}</p>
    <table class="t" style="margin-top:8px"><tr><th>KM</th><th>Pace</th><th>Waktu</th><th>Jam</th></tr>${P.rows.map(r => `<tr class="${r.five ? "five" : ""}"><td>${fmtKm(r.km)}</td><td>${fmtPace(r.pace, false)}</td><td>${fmtDur(r.cum)}</td><td>${fmtClock(P.rp.startTime, r.cum)}</td></tr>`).join("")}</table>
    ${h.checkpoints.length ? `<p class="sm" style="margin-top:8px"><b>Minum:</b> ${h.checkpoints.map(c => `km ${fmtKm(c.km)}${c.verified ? "" : "*"}`).join(", ")}${h.checkpoints.some(c => !c.verified) ? " (*belum terverifikasi)" : ""}</p>` : ""}
    ${f.servings ? `<p class="sm"><b>Makan:</b> ${f.schedule.map(x => `menit ${x.min}`).join(", ")} · ${esc(P.rp.product || "sajian")} ${P.rp.carbs} g${f.energy ? ` · energi ±${f.energy[0]}–${f.energy[1]} kkal (perkiraan)` : ""}</p>` : ""}
    ${hr.configured ? `<p class="sm"><b>HR:</b> sekitar ${hr.raceRange[0]}–${hr.raceRange[1]} bpm, effort jadi patokan</p>` : ""}
    ${(ev.cutOffTimes || []).length ? `<p class="sm"><b>Cut-off:</b> ${ev.cutOffTimes.map(c => `km ${fmtKm(c.km)} ${esc(c.time)}`).join(", ")}</p>` : ""}
    <p class="sm" style="margin-top:6px"><b>Pagi hari:</b> ${RACE_CHECK.slice(5).map(esc).join(" · ")}</p>
    <p class="xs mu" style="margin-top:6px">Dibuat WeRunIt dari data dan pilihanmu. Perkiraan, bukan jaminan hasil.</p></div>`;
}
function mSheet(){ return `${mHead("Lembar race day")}${sheetHtml()}<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="sheetPrint">Cetak / PDF</button><button class="btn" data-act="sheetImage">Simpan gambar</button>${navigator.share ? `<button class="btn" data-act="sheetShare">Bagikan kartu</button>` : ""}</div>`; }
function sheetCanvas(){
  const P = racePlanData(), ev = P.ev, W = 1080, rowsH = Math.ceil(P.rows.length / 2) * 46, H = 420 + rowsH;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  g.fillStyle = "#141415"; g.fillRect(0, 0, W, H);
  const holo = "#FF5A1F";
  g.fillStyle = holo; g.fillRect(60, 60, 140, 6);
  g.fillStyle = "#F6F4FF"; g.font = "700 54px 'Space Grotesk', sans-serif"; g.fillText(ev.name.slice(0, 32), 60, 140);
  g.fillStyle = "#A8A5BB"; g.font = "500 30px Inter, sans-serif"; g.fillText(`${fmtD(ev.eventDate)} · ${fmtKm(evKm(ev))} km · start ${P.rp.startTime}`, 60, 190);
  g.fillStyle = "#F6F4FF"; g.font = "700 64px 'Space Grotesk', sans-serif"; g.fillText(`Target ${fmtDur(P.T)}`, 60, 280);
  g.fillStyle = "#B9A4FF"; g.font = "600 30px Inter, sans-serif"; g.fillText(`${RS.STRATS[P.rp.strategy]} · rata-rata ${fmtPace(P.T / P.D)}`, 60, 330);
  g.font = "500 28px Inter, sans-serif";
  P.rows.forEach((r, i) => { const col = i < Math.ceil(P.rows.length / 2) ? 0 : 1, row = col ? i - Math.ceil(P.rows.length / 2) : i; g.fillStyle = r.five ? "#FF5A1F" : "#EDEDED"; g.fillText(`km ${fmtKm(r.km)}`, 60 + col * 500, 400 + row * 46); g.fillStyle = "#A8A5BB"; g.fillText(`${fmtPace(r.pace, false)}   ${fmtDur(r.cum)}`, 220 + col * 500, 400 + row * 46); });
  g.fillStyle = "#77758A"; g.font = "500 24px Inter, sans-serif"; g.fillText("WeRunIt · perkiraan, bukan jaminan hasil", 60, H - 30);
  return c;
}
function downloadBlob(blob, name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
Object.assign(ACT, {
  raceSheet:() => { M = {kind:"sheet"}; render(true); },
  sheetPrint:() => { document.documentElement.classList.add("printing-sheet"); setTimeout(() => { window.print(); setTimeout(() => document.documentElement.classList.remove("printing-sheet"), 500); }, 50); },
  sheetImage:() => { sheetCanvas().toBlob(b => { if(b){ downloadBlob(b, `werunit-race-${todayYmd()}.png`); toast("Gambar disimpan"); } }, "image/png"); },
  sheetShare:() => { sheetCanvas().toBlob(async b => { try{ const file = new File([b], "werunit-race.png", {type:"image/png"}); if(navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({files:[file], title:"Rencana race day"}); else downloadBlob(b, "werunit-race.png"); }catch(e){} }, "image/png"); }
});

/* ===================== Onboarding (after sign-in, before the tutorial) ===================== */
function needsOnboarding(){ return !BOOTING && !gateActive() && !S.profile.onboarded && !HMTP.hasRealData(S) && !S.ui.tourDone && !S.tutorial.quick && !RUN; }
function maybeOnboard(){ if(needsOnboarding() && !M){ S.ui.schedDraft = null; M = {kind:"onboard", step:1}; render(false); return true; } return false; }
const _maybeStartTutorial = maybeStartTutorial;
maybeStartTutorial = function(){ if(maybeOnboard()) return; _maybeStartTutorial(); };
function mOnboard(){
  const p = S.profile, u = CLOUD.user, st = M.step;
  const dots = `<div class="prog" style="display:flex;gap:4px;margin-bottom:10px">${[1, 2].map(i => `<i style="flex:1;height:3px;border-radius:2px;background:${i <= st ? "var(--acc)" : "var(--s2)"}"></i>`).join("")}</div>`;
  if(st === 1) return `${mHead(`Halo${u && u.displayName ? ", " + esc(u.displayName.split(" ")[0]) : ""}!`, "Langkah 1 dari 2 · Profil (semua opsional)")}${dots}
    <p class="sm">Data ini cuma dipakai buat strategi race (energi, hidrasi, detak jantung) dan tetap privat. Boleh dikosongkan.</p>
    <div class="g2" style="margin-top:10px"><div class="field"><label for="ob-m">Berat badan (kg)</label><input type="text" inputmode="decimal" id="ob-m" value="${p.massKg ?? ""}"></div><div class="field"><label for="ob-h">Tinggi (cm)</label><input type="text" inputmode="decimal" id="ob-h" value="${p.heightCm ?? ""}"></div></div>
    <div class="g2"><div class="field"><label for="ob-a">Umur</label><input type="text" inputmode="numeric" id="ob-a" value="${p.age ?? ""}"></div><div class="field"><label for="ob-hr">HR maks terukur</label><input type="text" inputmode="numeric" id="ob-hr" value="${p.hrMax ?? ""}" placeholder="kalau tahu"></div></div>
    <div class="btns"><button class="btn pri" data-act="obNext">Lanjut</button><button class="btn ghost" data-act="obNext" data-skip="1">Lewati</button></div>`;
  return `${mHead("Kapan kamu bisa lari?", "Langkah 2 dari 2 · Ketersediaan")}${dots}${availEditor(schedDraft(), true)}
    <p class="xs mu">Programnya 3 lari per minggu (31 minggu ke ${esc(activeEvent().name)}). Bisa diubah kapan saja di Latihan → Jadwal.</p>
    <div class="btns" style="margin-top:10px"><button class="btn pri" data-act="obDone">Selesai</button><button class="btn ghost" data-act="obBack">Kembali</button></div>`;
}
Object.assign(ACT, {
  obNext:d => {
    if(!d.skip){ const g = id => { const v = (document.getElementById(id) || {}).value || ""; return v.trim() === "" ? null : num(v); }; S.profile = HMTP.cleanProfile(Object.assign({}, S.profile, {massKg:g("ob-m"), heightCm:g("ob-h"), age:g("ob-a"), hrMax:g("ob-hr")})); }
    M = {kind:"onboard", step:2}; render(true);
  },
  obBack:() => { M = {kind:"onboard", step:1}; render(true); },
  obDone:() => { const D = SC.cleanSchedule(schedDraft()); if(D && D.avail.some(Boolean) && JSON.stringify(D) !== JSON.stringify(SC.cleanSchedule(SC.fromLegacy(S.settings.weekday)))) S.schedule = D; /* defaults kept = classic arrangement */ S.ui.schedDraft = null; S.profile = Object.assign({}, S.profile, {onboarded:true}); persist(); M = null; render(false); _maybeStartTutorial(); render(false); }
});

/* ===================== modal registry + help ===================== */
const _modal = modal;
modal = function(){
  const extra = {events:mEvents, event:mEvent, replan:mReplan, racetabs:mRaceTabs, sheet:mSheet, onboard:mOnboard}[M.kind];
  if(!extra) return _modal();
  return `<div class="sheet-bg" data-act="${M.kind === "onboard" ? "" : "closeM"}"></div><div class="sheet" role="dialog" aria-modal="true">${extra()}</div>`;
};
Object.assign(TUT.HELP, {
  jadwal:{tour:null, title:"Jadwal & ketersediaan", what:"Pilih hari yang kamu bisa lari; WeRunIt menaruh sesi program di hari-hari itu.", why:"Biar jadwal ngikutin hidupmu tanpa mengubah isi program.", how:["Tap hari yang tersedia.", "Pilih hari long run dan sesi cepat.", "Cek pratinjau, lalu simpan."], ex:"Bisa lari Senin, Rabu, Sabtu → long run Sabtu, sesi cepat Rabu, recovery Senin.", warn:"Hari kosong nggak otomatis jadi latihan tambahan. Ganti frekuensi cuma lewat tombol frekuensi, dengan konfirmasi."},
  race:{tour:null, title:"Race", what:"Target race, perkiraan finish, strategi pace, split, hidrasi, energi, detak jantung, pos, dan checklist.", why:"Supaya race day punya rencana yang realistis dari data aslimu.", how:["Atur race target (bisa ganti race).", "Pilih strategi pace dan cek split.", "Isi pos minum & cut-off dari race guide resmi.", "Buka “Lembar race day” buat dicetak atau disimpan."], ex:"Target 2:59:59 mulai pelan → 5 km pertama 15 detik/km lebih lambat, sisanya menyesuaikan.", warn:"Perkiraan bukan jaminan. Hidrasi dan energi cuma memakai angka yang kamu isi; WeRunIt nggak mengarang data rute atau pos."}
});
