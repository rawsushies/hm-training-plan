/* WeRunIt v4 M4: shoes (rotation, initial mileage, discovery links) and integrations. Shares app globals. */
"use strict";
const SHO = WRI_SHOES, ING = WRI_INTEG;

/* ---------------- shoes ---------------- */
function shoeLine(x){
  const st = SHO.stats(x, S.logs), warn = st.pct >= 90 && !x.retired, meta = [x.brand, x.model].filter(Boolean).join(" ");
  return `<div class="card shoe" style="margin-top:10px">
    <div class="titlerow"><div style="min-width:0"><b>${esc(x.name)}</b>${meta ? `<p class="xs mu">${esc(meta)}</p>` : ""}</div><span>${S.settings.defaultShoe === x.id ? '<span class="chip done">Default</span>' : ""}${x.use ? `<span class="chip">${esc(SHO.USES[x.use])}</span>` : ""}${x.retired ? '<span class="chip">Pensiun</span>' : ""}</span></div>
    <div class="sm" style="display:flex;justify-content:space-between;margin:8px 0 6px"><span class="num">${fmtKm(st.total)} / ${x.limit} km</span><span class="mu">${st.runs} lari${st.lastUsed ? " · terakhir " + fmtD(st.lastUsed) : ""}</span></div>
    <div class="bar"><span style="width:${st.pct}%;${warn ? "background:var(--warn)" : ""}"></span></div>
    ${st.initial ? `<p class="xs mu" style="margin-top:4px">${fmtKm(st.initial)} km awal (diisi manual) + ${fmtKm(st.tracked)} km tercatat di app</p>` : ""}
    ${warn ? `<p class="sm" style="margin-top:6px;color:var(--warn)">Udah dekat batas. Cek sol dan rasa di kaki. Kalau mau ganti, pakai sepatu baru beberapa kali dulu sebelum race.</p>` : ""}
    <div class="btns" style="margin-top:8px"><button class="btn sm ghost" data-act="shoeEdit" data-id="${x.id}">Edit</button>${S.settings.defaultShoe !== x.id && !x.retired ? `<button class="btn sm ghost" data-act="shoeDefault" data-id="${x.id}">Jadikan default</button>` : ""}<button class="btn sm ghost" data-act="shoeRetire" data-id="${x.id}">${x.retired ? "Pakai lagi" : "Pensiunkan"}</button></div></div>`;
}
vShoes = function(){
  const tab = S.ui.shoeTab || "mine", act = S.shoes.filter(x => !x.retired), ret = S.shoes.filter(x => x.retired), noShoe = S.logs.filter(l => !l.shoeId && !l.sample).length;
  const t = todayYmd(), next = allSessions().filter(s => s.date >= t && !["done", "skip"].includes(sState(s))).sort((a, b) => a.date.localeCompare(b.date))[0];
  const sug = next ? SHO.suggest(S.shoes, S.logs, next.type) : null, rot = SHO.rotation(S.shoes, S.logs, t);
  const tabs = segPill("shoetab", [["mine", "Sepatuku"], ["catalog", "Rekomendasi"], ["rotation", "Rotasi"]], tab, "shoeTab");
  let body = "";
  if(tab === "mine") body = `<div class="btns" style="margin:12px 0 2px"><button class="btn pri" data-act="shoeNew" data-tour="shoe-add">Tambah sepatu</button></div>
    ${act.length ? `<div data-tour="shoe-list">${act.map(shoeLine).join("")}</div>` : `<p class="mu" style="margin-top:8px">Belum ada sepatu aktif. Tambah sepatu yang kamu pakai, nanti tiap lari bisa dipilih sepatunya.</p>`}
    ${ret.length ? `<h3 style="margin-top:18px">Pensiun</h3>${ret.map(shoeLine).join("")}` : ""}
    ${noShoe && S.shoes.length ? `<p class="sm mu" style="margin-top:12px">${noShoe} lari belum ada sepatunya. <button class="link sm" data-act="shoeAssign">Pasang ke sepatu default</button></p>` : ""}`;
  else if(tab === "rotation") body = `
    <section class="card" style="margin-top:12px"><h3>Sesi berikutnya</h3>${next ? `<p class="sm">${fmtDay(next.date)} · ${esc(next.title)}${next.dist ? " " + fmtKm(next.dist) + " km" : ""}</p>${sug ? `<p style="margin-top:6px">Saran: <b>${esc(sug.shoe.name)}</b></p><p class="xs mu">Kenapa: ${esc(sug.reason)}.</p>` : `<p class="sm mu" style="margin-top:6px">${act.length ? "Belum ada sepatu yang cocok. Isi “dipakai buat” di tiap sepatu." : "Tambah sepatu dulu."}</p>`}` : `<p class="sm mu">Nggak ada sesi terjadwal.</p>`}</section>
    <section class="card" style="margin-top:10px"><h3>${rot.days} hari terakhir</h3>${rot.share.length ? rot.share.map(r => { const x = S.shoes.find(s => s.id === r.id); return `<div class="kv"><span>${esc(x ? x.name : "?")}</span><b class="num">${fmtKm(r.km)} km · ${r.pct}%</b></div>`; }).join("") : `<p class="sm mu">Belum ada lari dengan sepatu di ${rot.days} hari terakhir.</p>`}${rot.unassignedKm ? `<p class="xs mu" style="margin-top:6px">${fmtKm(rot.unassignedKm)} km tanpa sepatu.</p>` : ""}
    <p class="xs mu" style="margin-top:8px">Saran berdasarkan jenis sesi, kegunaan yang kamu isi, dan km tiap sepatu. Bukan aturan; dengarkan kakimu.</p></section>`;
  else body = shoeCatalog();
  return `${pageHead("Sepatu", "Km tiap sepatu, rekomendasi model terbaru, dan saran rotasi.")}${tabs}${body}`;
};
mShoe = function(){
  const x = M.id ? S.shoes.find(s => s.id === M.id) : {name:"", limit:700};
  return `${mHead(M.id ? "Edit sepatu" : "Tambah sepatu")}<div class="field"><label for="sh-name">Nama sepatu</label><input type="text" id="sh-name" value="${esc(x.name)}" placeholder="misal: sepatu biru harian" maxlength="60" data-autofocus></div>
  <div class="g2"><div class="field"><label for="sh-brand">Merek (opsional)</label><input type="text" id="sh-brand" maxlength="40" value="${esc(x.brand || "")}"></div><div class="field"><label for="sh-model">Model (opsional)</label><input type="text" id="sh-model" maxlength="60" value="${esc(x.model || "")}"></div></div>
  <div class="g2"><div class="field"><label for="sh-use">Dipakai buat</label><select id="sh-use"><option value="">Apa saja</option>${Object.entries(SHO.USES).map(([k, l]) => `<option value="${k}" ${x.use === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label for="sh-since">Mulai dipakai</label><input type="date" id="sh-since" value="${esc(x.since || "")}"></div></div>
  <div class="g2"><div class="field"><label for="sh-init">Km sebelum pakai app</label><input type="text" inputmode="decimal" id="sh-init" value="${x.initialKm ? String(x.initialKm).replace(".", ",") : ""}" placeholder="0"></div><div class="field"><label for="sh-lim">Batas km (perkiraan)</label><input type="number" id="sh-lim" value="${x.limit}" min="100" max="2000"></div></div>
  <div id="sh-err"></div><button class="btn pri" data-act="saveShoe">Simpan</button>`;
};
Object.assign(ACT, {
  shoeTab:d => { S.ui.shoeTab = d.v; render(true); },
  saveShoe:() => {
    const g = id => document.getElementById(id).value.trim(), n = g("sh-name"), lim = num(g("sh-lim")), ik = g("sh-init") ? num(g("sh-init")) : 0;
    if(!n || !(lim >= 100 && lim <= 2000) || !(ik >= 0 && ik <= 5000)){ document.getElementById("sh-err").innerHTML = `<p class="err">Nama wajib diisi, batas km 100–2000, km awal 0–5000.</p>`; return; }
    const base = M.id ? S.shoes.find(s => s.id === M.id) : {id:uid(), retired:false};
    const x = HMTP.sanitizeState(Object.assign(defaults(), {shoes:[{id:base.id, retired:base.retired, name:n, limit:Math.round(lim), brand:g("sh-brand"), model:g("sh-model"), use:g("sh-use"), initialKm:ik, since:g("sh-since")}]}), defaults).shoes[0];
    if(M.id) S.shoes = S.shoes.map(s => s.id === x.id ? x : s); else { S.shoes.push(x); if(!S.settings.defaultShoe) S.settings.defaultShoe = x.id; }
    persist(); M = null; render(true); toast("Sepatu tersimpan");
  }
});
/* ---------------- catalogue (embedded facts + our Plus/Minus) ---------------- */
const CAT = WRI_SHOE_CATALOG;
const fmtRel = (d, approx) => { const [y, m, dd] = d.split("-").map(Number); return `${approx ? "sekitar " : ""}${dd} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][m - 1]} ${y}`; };
function catCard(x){
  const side = (S.ui.catSide || {})[x.id] || "plus", owned = S.shoes.some(s => s.brand === x.brand && s.model === x.model);
  return `<article class="card cat" style="margin-top:10px" data-cat="${esc(x.id)}">
    <div class="cat-facts">
      <p class="xs mu">${esc(x.brand)}</p>
      <div class="titlerow"><h3 style="margin:0">${esc(x.model)}</h3><span class="chip">${esc(SHO.USES[x.use])}</span></div>
      <p class="sm" style="margin-top:4px">Rilis ${fmtRel(x.released, x.approx)}</p>
      <p class="xs mu" style="margin-top:2px">Sumber: <a href="${esc(x.source.url)}" target="_blank" rel="noopener">${esc(x.source.label)}</a> · diambil ${fmtRel(CAT.retrieved)}</p>
    </div>
    <div class="cat-notes">
      ${segPill("cat:" + x.id, [[x.id + "|plus", "Plus"], [x.id + "|minus", "Minus"]], x.id + "|" + side, "catSide")}
      <ul class="cat-list ${side}">${x[side].map(t => `<li>${esc(t)}</li>`).join("")}</ul>
      <p class="xs mu">Catatan WeRunIt (opini, bukan uji lab)</p>
    </div>
    <div class="btns" style="margin-top:8px">${owned ? `<span class="chip done">Ada di sepatuku</span>` : `<button class="btn sm" data-act="catAdd" data-id="${esc(x.id)}">+ Tambah ke sepatuku</button>`}</div>
  </article>`;
}
function shoeCatalog(){
  const f = S.ui.catUse || "all", list = CAT.models.filter(x => f === "all" || x.use === f || (f === "daily" && x.use === "long")).sort((a, b) => b.released.localeCompare(a.released));
  return `<div style="margin-top:12px">${segPill("catuse", [["all", "Semua"], ["daily", "Harian"], ["tempo", "Tempo"], ["race", "Race"], ["trail", "Trail"]], f, "catUse")}</div>
    ${list.map(catCard).join("")}
    <p class="xs mu" style="margin-top:12px">${CAT.models.length} model. Nama, model, dan tanggal rilis dari sumber yang ditautkan di tiap kartu; “sekitar” = tanggal dari listing toko, bukan pengumuman resmi. Harga & stok di Indonesia bisa berbeda.</p>`;
}
Object.assign(ACT, {
  catUse:d => { S.ui.catUse = d.v; render(true); },
  catSide:d => { const [id, side] = String(d.v).split("|"); if(!id || !["plus", "minus"].includes(side)) return; S.ui.catSide = Object.assign({}, S.ui.catSide, {[id]:side}); render(true); },
  catAdd:d => {
    const x = CAT.models.find(m => m.id === d.id); if(!x) return;
    const sh = HMTP.sanitizeState(Object.assign(defaults(), {shoes:[{id:uid(), name:`${x.brand} ${x.model}`.slice(0, 60), limit:x.use === "race" ? 400 : x.use === "trail" ? 600 : 700, brand:x.brand, model:x.model, use:x.use === "long" ? "long" : x.use, since:todayYmd()}]}), defaults).shoes[0];
    S.shoes.push(sh); if(!S.settings.defaultShoe && x.use !== "race") S.settings.defaultShoe = sh.id;
    persist(); render(true); toast(`${x.model} ditambahkan ke sepatuku`);
  }
});

/* ---------------- integrations ---------------- */
const INTEG = {
  env(){
    const C = window.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform());
    return {native, plugins:{Health:!!(native && C.isPluginAvailable && C.isPluginAvailable("Health"))}};
  },
  plugin(){ const C = window.Capacitor; return (C.Plugins && C.Plugins.Health) || C.registerPlugin("Health"); },
  busy:false
};
function vInteg(){
  const env = INTEG.env(), lvl = {available:"ok", "needs-app-update":"warn"};
  return `${pageHead("Integrasi", "Ambil data lari dari aplikasi dan jam lain. Status di bawah jujur: yang belum tersedia ditulis apa adanya.")}
  <div data-tour="integ">${ING.PROVIDERS.map(p => { const st = p.status(env); return `<section class="card" style="margin-top:10px"><div class="titlerow"><b>${esc(p.name)}</b><span class="chip ${st.state === "available" ? "done" : ""}">${esc(ING.STATE_LBL[st.state])}</span></div>
    <p class="sm ${lvl[st.state] ? "" : "mu"}" style="margin-top:6px">${esc(st.note)}</p>
    ${p.id === "file" ? `<div class="btns" style="margin-top:8px"><button class="btn sm pri" data-act="nav" data-t="data">Import file</button><button class="btn sm ghost" data-act="importHelp">Cara ambil file</button></div>` : ""}
    ${p.id === "healthconnect" && st.state === "available" ? `<div class="btns" style="margin-top:8px"><button class="btn sm pri" data-act="hcSync" ${INTEG.busy ? "disabled" : ""}>${INTEG.busy ? "Membaca..." : "Ambil lari 30 hari terakhir"}</button></div><p class="xs mu" style="margin-top:6px">Kamu melihat daftarnya dulu sebelum disimpan. Duplikat otomatis ditandai.</p>` : ""}</section>`; }).join("")}</div>
  <div class="sec"><p class="xs mu">Data yang diimport cuma disimpan di akunmu. Token pihak ketiga nggak pernah disimpan di aplikasi.</p></div>`;
}
Object.assign(ACT, {
  hcSync:async () => {
    if(INTEG.busy) return; INTEG.busy = true; render(true);
    try{
      const H = INTEG.plugin(), av = await H.isAvailable();
      if(!av || !av.available){ toast("Health Connect belum terpasang atau belum didukung di HP ini."); return; }
      const auth = await H.requestAuthorization({read:["workouts", "distance"]});
      if(!auth || !(auth.readAuthorized || []).includes("workouts")){ toast("Izin membaca latihan belum diberikan di Health Connect."); return; }
      const end = new Date(), start = new Date(end.getTime() - 30 * 864e5);
      const r = await H.queryWorkouts({startDate:start.toISOString(), endDate:end.toISOString(), limit:200, ascending:true});
      const items = ING.dedupeBatch((r && r.workouts || []).map(ING.fromHealthWorkout).filter(a => a && a.isRun && a.distance > 0));
      if(!items.length){ toast("Nggak ada lari dengan jarak di Health Connect 30 hari terakhir."); return; }
      reviewImport(items, []);
    }catch(e){ toast("Health Connect: " + String(e && e.message || e).slice(0, 100)); }
    finally{ INTEG.busy = false; if(!M) render(true); }
  }
});
TUT.HELP.integ = {tour:"data", title:"Integrasi", what:"Ambil lari dari file GPX/TCX/CSV atau Health Connect.", why:"Supaya nggak perlu catat manual.", how:["Pilih sumber yang statusnya Tersedia.", "Cek daftar lari sebelum disimpan.", "Duplikat ditandai otomatis."], ex:"Jam kamu sinkron ke Health Connect → ambil 30 hari terakhir di sini.", warn:"Sumber yang butuh server atau kerja sama partner ditandai jelas dan belum bisa dipakai."};
