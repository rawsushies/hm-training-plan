/* WeRunIt v4 Friends (replaces group sharing). Shares globals with the main app script.
 * Firestore: invites/requests/friendships/shares/goals (see firestore.rules). Private by default.
 */
"use strict";
const SO = WRI_SOCIAL;
NAV_MORE.forEach(x => { if(x[0] === "bareng") x[1] = "Teman"; });
const FRIEND_KEY = "hmtp:friend";
const nameCacheKey = () => `hmtp:friendnames:${ACTIVE_UID}`;
const myInvitesKey = () => `hmtp:myinvites:${ACTIVE_UID}`;
function friendName(uid){ const sh = FRIENDS.shares[uid], c = (LS.get(nameCacheKey()) || {})[uid] || {}; return {name:(sh && sh.name) || c.name || "Teman", photo:(sh && sh.photo) || c.photo || ""}; }
function rememberName(uid, name, photo){ if(!ACTIVE_UID || !uid) return; const c = LS.get(nameCacheKey()) || {}; c[uid] = {name:String(name || "").slice(0, 80), photo:/^https:\/\//.test(photo || "") ? photo : ""}; LS.set(nameCacheKey(), c); }

/* ---------------- controller ---------------- */
const FRIENDS = {
  list:[], req:{incoming:[], outgoing:[]}, shares:{}, goals:[], contrib:{}, subs:{}, gsubs:{}, unsubs:[], started:false, lastShare:{}, lastContrib:{}, blocks:null, q:"", results:null, searching:false,
  start(){
    if(this.started || !SYNC || !CLOUD.user) return;
    this.started = true; const me = CLOUD.user.uid, err = e => { if(e && e.code === "permission-denied") return; };
    CLOUD.api.setProfile(CLOUD.user, S.settings.discoverable !== false).catch(() => {});
    this.unsubs.push(CLOUD.api.subscribeFriendships(me, fs => { const gone = this.list.filter(f => !fs.some(g => g.other === f.other)); this.list = fs; gone.forEach(f => { delete this.lastShare[f.other]; CLOUD.api.deleteShare(me, f.other).catch(() => {}); }); this.syncShareSubs(); queueShares(500); this.rr(); }, err));
    this.unsubs.push(CLOUD.api.subscribeRequests(me, r => { this.req = r; r.incoming.forEach(q => rememberName(q.from, q.fromName, q.fromPhoto)); this.rr(); }, err));
    this.unsubs.push(CLOUD.api.subscribeGoals(me, gs => { this.goals = gs; this.syncContribSubs(); queueShares(500); this.rr(); }, err));
  },
  stop(){
    this.unsubs.forEach(u => u()); Object.values(this.subs).forEach(u => u()); Object.values(this.gsubs).forEach(u => u());
    Object.assign(this, {list:[], req:{incoming:[], outgoing:[]}, shares:{}, goals:[], contrib:{}, subs:{}, gsubs:{}, unsubs:[], started:false, lastShare:{}, lastContrib:{}, blocks:null});
  },
  syncShareSubs(){
    const me = CLOUD.user.uid, want = new Set(this.list.map(f => f.other));
    for(const uid of want) if(!this.subs[uid]) this.subs[uid] = CLOUD.api.subscribeShareFrom(uid, me, d => { this.shares[uid] = d; if(d) rememberName(uid, d.name, d.photo); this.rr(); }, () => {});
    for(const uid of Object.keys(this.subs)) if(!want.has(uid)){ this.subs[uid](); delete this.subs[uid]; delete this.shares[uid]; }
  },
  syncContribSubs(){
    const want = new Set(this.goals.map(g => g.id));
    for(const id of want) if(!this.gsubs[id]) this.gsubs[id] = CLOUD.api.subscribeContrib(id, c => { this.contrib[id] = c; this.rr(); }, () => {});
    for(const id of Object.keys(this.gsubs)) if(!want.has(id)){ this.gsubs[id](); delete this.gsubs[id]; delete this.contrib[id]; }
  },
  rr(){ if(S.ui.tab === "bareng") rerenderSoft(); }
};
// v4: the group engine is retired; its hooks now drive friends.
GROUPS.load = async function(){ FRIENDS.start(); };
const _groupsReset = GROUPS.reset.bind(GROUPS);
GROUPS.reset = function(){ _groupsReset(); FRIENDS.stop(); };
let shareTimer = null;
queueProgress = function(delay){ queueShares(delay); };
function queueShares(delay = 3000){ if(!SYNC || !CLOUD.user) return; clearTimeout(shareTimer); shareTimer = setTimeout(pushShares, delay); }
async function pushShares(){
  if(!SYNC || !CLOUD.user || !PLANW.length) return;
  const u = CLOUD.user, me = u.uid, w = PLANW[curWeekIdx()], t = todayYmd();
  const week = {start:w.start, end:w.end, sessions:w.sessions.map(s => ({done:sState(s) === "done"}))};
  const upcoming = allSessions().filter(s => s.date >= t && s.date <= ymd(addDays(new Date(), 7))).sort((a, b) => a.date.localeCompare(b.date));
  for(const f of FRIENDS.list){
    const body = SO.buildShare({logs:S.logs, week, upcoming, perms:S.shareWith[f.other], name:u.displayName, photo:u.photoURL}) || {name:(u.displayName || "").slice(0, 80), photo:/^https:\/\//.test(u.photoURL || "") ? u.photoURL : ""};
    const j = JSON.stringify(body);
    if(FRIENDS.lastShare[f.other] === j) continue;
    try{ await CLOUD.api.writeShare(me, f.other, body); FRIENDS.lastShare[f.other] = j; }catch(e){}
  }
  for(const g of FRIENDS.goals.filter(g => g.status === "active")){
    const since = g.createdAt ? ymd(g.createdAt) : t, c = SO.contribution(S.logs, since), j = JSON.stringify(c);
    if(FRIENDS.lastContrib[g.id] === j) continue;
    try{ await CLOUD.api.writeContrib(g.id, me, c); FRIENDS.lastContrib[g.id] = j; }catch(e){}
  }
}
(function readFriendHash(){
  try{ const m = location.hash.match(/^#friend=([A-Za-z0-9_-]{22,64})$/); if(m){ sessionStorage.setItem(FRIEND_KEY, m[1]); history.replaceState(null, "", location.pathname + location.search); S.ui.tab = "bareng"; } }catch(e){}
})();
const _afterActivateF = afterActivate;
afterActivate = function(){ _afterActivateF(); maybeFriendInvite(); };
async function maybeFriendInvite(){
  let code = null; try{ code = sessionStorage.getItem(FRIEND_KEY); }catch(e){}
  if(!code || !SYNC || !CLOUD.user) return;
  try{
    const inv = await CLOUD.api.getFriendInvite(code);
    if(!inv || inv.usedBy || (inv.expiresAt && inv.expiresAt < new Date())){ sessionStorage.removeItem(FRIEND_KEY); toast("Undangan ini udah dipakai atau kedaluwarsa. Minta link baru."); return; }
    if(inv.from === CLOUD.user.uid){ sessionStorage.removeItem(FRIEND_KEY); toast("Ini link undanganmu sendiri. Kirim ke temanmu ya."); return; }
    M = {kind:"friendreq", inv}; render(true);
  }catch(e){ toast(errText(e && e.code)); }
}

/* ---------------- view ---------------- */
const permLabels = {weekly:"Jarak mingguan & total", completion:"Sesi minggu ini selesai", pbs:"Personal best", plan:"Jadwal 7 hari ke depan", hr:"Detak jantung di pace tertentu (buat cek pace bareng)"};
function frResult(r){
  const isFriend = FRIENDS.list.some(f => f.other === r.uid), out = FRIENDS.req.outgoing.some(q => q.to === r.uid), inc = FRIENDS.req.incoming.find(q => q.from === r.uid);
  const action = isFriend ? `<span class="chip done">Teman</span>` : out ? `<span class="chip">Terkirim</span>` : inc ? `<button class="btn sm pri" data-act="frAccept" data-id="${esc(r.uid)}">Terima</button>` : `<button class="btn sm pri" data-act="frAdd" data-id="${esc(r.uid)}">Tambah</button>`;
  return `<div class="row">${avatarImg(r.photo, r.name)}<span class="grow"><b>${esc(r.name)}</b></span>${action}</div>`;
}
function friendCard(f){
  const sh = FRIENDS.shares[f.other], n = friendName(f.other), mine = S.shareWith[f.other] ? SO.cleanPerms(S.shareWith[f.other]) : SO.defaultPerms();
  const theirs = sh ? [
    sh.weekKm !== undefined ? `<div><div class="v num">${fmtKm(sh.weekKm)}</div><div class="l">km minggu ini</div></div>` : "",
    sh.totalKm !== undefined ? `<div><div class="v num">${fmtKm(sh.totalKm)}</div><div class="l">km total</div></div>` : "",
    sh.weekDone !== undefined ? `<div><div class="v num">${Number(sh.weekDone)}/${Number(sh.weekPlanned)}</div><div class="l">sesi minggu ini</div></div>` : ""
  ].join("") : "";
  const pbs = sh && sh.pbs ? Object.entries(sh.pbs).map(([k, v]) => `${({"5k":"5K", "10k":"10K", hm:"HM"})[k] || esc(k)} ${fmtDur(v.sec)}`).join(" · ") : "";
  const sharedMine = SO.anyShared(mine) ? Object.keys(permLabels).filter(k => mine[k]).map(k => permLabels[k]).concat(mine.activities.length ? [`${mine.activities.length} aktivitas`] : []).join(", ") : "Belum ada (privat)";
  return `<div class="card" style="margin-top:10px">
    <div style="display:flex;align-items:center;gap:10px">${avatarImg(n.photo, n.name)}<div style="flex:1;min-width:0"><b>${esc(n.name)}</b><p class="xs mu">Teman${f.since ? " sejak " + fmtD(ymd(f.since)) : ""}</p></div></div>
    ${theirs ? `<div class="stats c3" style="margin-top:10px">${theirs}</div>` : `<p class="sm mu" style="margin-top:8px">${esc(n.name)} belum membagikan data latihan.</p>`}
    ${pbs ? `<p class="sm" style="margin-top:8px">${pbs}</p>` : ""}
    ${sh && sh.activities && sh.activities.length ? `<p class="sm" style="margin-top:6px"><b>Aktivitas dibagikan:</b> ${sh.activities.map(a => `${fmtD(a.date)} ${esc(TYPES[a.type] || a.type)} ${fmtKm(a.km)} km${a.sec ? " · " + fmtDur(a.sec) : ""}`).join("; ")}</p>` : ""}
    ${sh && sh.plan && sh.plan.length ? `<p class="sm" style="margin-top:6px"><b>Jadwal:</b> ${sh.plan.map(p => `${fmtDay(p.date)} ${esc(p.title)}${p.km ? " " + fmtKm(p.km) + " km" : ""}`).join("; ")}</p>` : ""}
    <p class="xs mu" style="margin-top:8px">Yang kamu bagikan ke ${esc(n.name)}: ${esc(sharedMine)}</p>
    <div class="btns" style="margin-top:8px"><button class="btn sm" data-act="frPerms" data-id="${esc(f.other)}">Atur yang kubagikan</button><button class="btn sm" data-act="frPace" data-id="${esc(f.other)}">Cek pace bareng</button><button class="btn sm ghost" data-act="frRemove" data-id="${esc(f.other)}">Hapus</button><button class="btn sm ghost" data-act="frBlock" data-id="${esc(f.other)}">Blokir</button></div></div>`;
}
function goalCard(g){
  const me = CLOUD.user.uid, other = g.participants.find(x => x !== me), c = FRIENDS.contrib[g.id] || {}, a = (c[me] || {}).km || 0, b = (c[other] || {}).km || 0, tot = a + b, pct = Math.min(100, Math.round(tot / g.targetKm * 100));
  return `<div class="card" style="margin-top:10px"><div class="titlerow"><b>${esc(g.name)}</b><span class="chip ${g.status === "completed" ? "done" : ""}">${({active:"Aktif", completed:"Selesai", archived:"Arsip"})[g.status]}</span></div>
    <p class="xs mu">Target ${fmtKm(g.targetKm)} km sampai ${fmtD(g.targetDate)} · bareng ${esc(friendName(other).name)}</p>
    <div class="bar" style="margin:8px 0"><span style="width:${pct}%"></span></div>
    <p class="sm"><b>${fmtKm(tot)}</b> / ${fmtKm(g.targetKm)} km · kamu ${fmtKm(a)} km · ${esc(friendName(other).name)} ${fmtKm(b)} km</p>
    <div class="btns" style="margin-top:6px">${g.status === "active" ? `<button class="btn sm ghost" data-act="goalStatus" data-id="${esc(g.id)}" data-v="completed">Tandai selesai</button>` : ""}${g.createdBy === me ? `<button class="btn sm ghost" data-act="goalDel" data-id="${esc(g.id)}">Hapus</button>` : ""}</div></div>`;
}
function vBareng(){
  const head = pageHead("Teman", "Cari temanmu, lalu pilih sendiri apa yang dibagikan ke tiap teman.");
  if(CLOUD.state === "off") return `${head}<div style="margin:14px 0">${acctBox()}</div><div class="note info">Fitur teman butuh login Google, dan login belum disetel di app ini.</div>`;
  if(!CLOUD.user || !SYNC) return `${head}<div style="margin:14px 0">${acctBox()}</div><div class="note info">Masuk pakai Google dulu buat menambah teman.</div>${friendPrivacy()}`;
  const R = FRIENDS.req;
  return `${head}
  <section class="card" style="margin-top:12px" data-tour="groups"><h3>Cari teman</h3>
    <div class="fr-search"><input type="search" id="fr-q" placeholder="Nama atau email teman" maxlength="80" autocomplete="off" enterkeyhint="search" value="${esc(FRIENDS.q)}" aria-label="Cari teman pakai nama atau email"><button class="btn pri" data-act="frSearch">${FRIENDS.searching ? "…" : "Cari"}</button></div>
    ${FRIENDS.results ? (FRIENDS.results.error ? `<p class="err" style="margin-top:8px">${esc(FRIENDS.results.error)}</p>` : FRIENDS.results.length ? `<div class="rows" style="margin-top:6px">${FRIENDS.results.map(frResult).join("")}</div>` : `<p class="sm mu" style="margin-top:8px">Nggak ketemu. Coba email lengkapnya, atau minta dia buka menu Teman sekali supaya bisa dicari.</p>`) : ""}
    <label class="toggle" style="margin-top:10px"><span class="sm">Orang lain bisa menemukanku lewat pencarian<br><span class="xs mu">Yang terlihat cuma nama & foto Google. Email nggak pernah ditampilkan.</span></span><input type="checkbox" data-act="frDiscover" ${S.settings.discoverable !== false ? "checked" : ""}></label></section>
  ${R.incoming.length ? `<section class="card" style="margin-top:10px"><h3>Permintaan masuk</h3>${R.incoming.map(q => `<div class="row"><span class="grow"><b>${esc(q.fromName || "Seseorang")}</b><br><span class="xs mu">ingin berteman</span></span><button class="btn sm pri" data-act="frAccept" data-id="${esc(q.from)}">Terima</button><button class="btn sm ghost" data-act="frReject" data-id="${esc(q.id)}">Tolak</button></div>`).join("")}</section>` : ""}
  ${R.outgoing.length ? `<section class="card" style="margin-top:10px"><h3>Permintaan terkirim</h3>${R.outgoing.map(q => `<div class="row"><span class="grow sm"><b>${esc(friendName(q.to).name)}</b><br><span class="xs mu">menunggu diterima</span></span><button class="btn sm ghost" data-act="frReject" data-id="${esc(q.id)}">Batalkan</button></div>`).join("")}</section>` : ""}
  <section style="margin-top:14px" data-tour="share-toggle"><h2>Teman kamu</h2>${FRIENDS.list.length ? FRIENDS.list.map(friendCard).join("") : `<p class="mu" style="margin-top:6px">Belum ada teman. Cari pakai nama atau email di atas.</p>`}</section>
  ${FRIENDS.list.length ? `<section style="margin-top:16px"><h2>Target bersama</h2>${FRIENDS.goals.length ? FRIENDS.goals.map(goalCard).join("") : `<p class="sm mu" style="margin-top:6px">Misalnya: “300 km sampai race” bareng satu teman.</p>`}<button class="btn" style="margin-top:10px" data-act="goalNew">Buat target bersama</button></section>` : ""}
  ${friendPrivacy()}
  <div class="sec"><button class="link sm" data-act="frBlocks">Daftar yang kamu blokir</button><p class="xs mu" style="margin-top:6px">Fitur grup sudah diganti dengan Teman. Data grup lama tetap tersimpan dan nggak dihapus.</p></div>`;
}
const friendPrivacy = () => `<div class="sec"><h3>Apa yang privat?</h3><p class="sm" style="margin-top:6px">Selalu privat: catatan lari, check-in & nyeri, review, rute dan lokasi, data kesehatan, settings. Teman cuma lihat nama & foto Google kamu, plus hal yang kamu nyalakan khusus untuk dia. Server (Firestore rules) menolak kolom lain.</p></div>`;
function mFriendReq(){ const i = M.inv; return `${mHead("Permintaan pertemanan")}<div style="display:flex;gap:10px;align-items:center">${avatarImg(i.fromPhoto, i.fromName)}<b>${esc(i.fromName || "Seseorang")}</b></div><p class="sm" style="margin-top:10px">Kirim permintaan pertemanan? Setelah diterima, kalian bisa memilih data apa yang dibagikan satu sama lain. Defaultnya nggak ada yang dibagikan.</p><div class="btns" style="margin-top:12px"><button class="btn pri" data-act="frSend">Kirim permintaan</button><button class="btn ghost" data-act="frSendNo">Nggak jadi</button></div>`; }
function mFrPerms(){
  const p = SO.cleanPerms(S.shareWith[M.id]), n = friendName(M.id).name, recent = [...S.logs].filter(l => !l.sample).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  return `${mHead(`Yang kamu bagikan ke ${esc(n)}`, "Bisa diubah atau dicabut kapan saja.")}
  ${Object.entries(permLabels).map(([k, l]) => `<label class="toggle"><span>${l}</span><input type="checkbox" id="pm-${k}" ${p[k] ? "checked" : ""}></label>`).join("")}
  <p class="sm" style="margin-top:10px"><b>Aktivitas tertentu</b></p>${recent.length ? recent.map(l => `<label class="toggle"><span class="sm">${fmtD(l.date)} · ${TYPES[l.type]} ${fmtKm(l.distance)} km</span><input type="checkbox" class="pm-act" value="${esc(l.id)}" ${p.activities.includes(l.id) ? "checked" : ""}></label>`).join("") : `<p class="xs mu">Belum ada lari.</p>`}
  <div class="btns" style="margin-top:12px"><button class="btn pri" data-act="frPermsSave">Simpan</button><button class="btn ghost" data-act="frPermsNone">Jangan bagikan apa pun</button></div>`;
}
function myHrPoints(){ return S.logs.filter(l => !l.sample && l.hrAvg && l.duration && l.distance >= 3).map(l => ({pace:Math.round(l.duration / l.distance), hrAvg:l.hrAvg, km:Math.round(l.distance * 10) / 10, date:l.date})); }
function mFrPace(){
  const n = friendName(M.id).name, sh = FRIENDS.shares[M.id], tp = M.pace || parseDur(activeEvent().targetFinish || S.settings.goalTime) / activeEvent().distanceKm, D = activeEvent().distanceKm;
  const mine = SO.paceCheck(tp, myHrPoints(), S.profile.hrMax, D), theirs = sh && sh.hrPace ? SO.paceCheck(tp, sh.hrPace, null, D) : null;
  return `${mHead("Cek pace bareng", `Kamu & ${esc(n)} · ${fmtKm(D)} km`)}
  <div class="field"><label for="fp-p">Target pace bersama (${unitLbl()})</label><input type="text" id="fp-p" value="${fmtPace(tp, false)}" data-live="frPaceIn"></div>
  <div class="card"><h3>Kamu</h3><p class="sm">${esc(mine.text)}</p></div>
  <div class="card" style="margin-top:8px"><h3>${esc(n)}</h3><p class="sm">${theirs ? esc(theirs.text) : `${esc(n)} belum membagikan data detak jantung. Dia bisa menyalakannya di “Atur yang kubagikan”.`}</p></div>
  <p class="xs mu" style="margin-top:8px">Berdasarkan HR rata-rata di lari dengan pace mirip (±20 detik). Panduan effort, bukan penilaian medis.</p>`;
}
function mGoalNew(){ return `${mHead("Target bersama")}<div class="field"><label for="gn-n">Nama</label><input type="text" id="gn-n" maxlength="60" placeholder="misal: 300 km menuju JAKIM"></div><div class="g2"><div class="field"><label for="gn-k">Target km</label><input type="text" inputmode="decimal" id="gn-k"></div><div class="field"><label for="gn-d">Sampai</label><input type="date" id="gn-d" value="${esc(activeEvent().eventDate)}"></div></div><div class="field"><label for="gn-f">Bareng</label><select id="gn-f">${FRIENDS.list.map(f => `<option value="${esc(f.other)}">${esc(friendName(f.other).name)}</option>`).join("")}</select></div><p class="xs mu">Yang terlihat cuma jumlah km & lari dari tiap orang sejak target dibuat.</p><div class="btns"><button class="btn pri" data-act="goalCreate">Buat</button></div>`; }
function mBlocks(){ const b = FRIENDS.blocks || []; return `${mHead("Diblokir")}${b.length ? b.map(u => `<div class="row"><span class="grow">${esc(friendName(u).name)}</span><button class="btn sm ghost" data-act="frUnblock" data-id="${esc(u)}">Buka blokir</button></div>`).join("") : `<p class="mu">Nggak ada.</p>`}`; }
const _modalS = modal;
modal = function(){
  const x = {friendreq:mFriendReq, frperms:mFrPerms, frpace:mFrPace, goalnew:mGoalNew, blocks:mBlocks}[M.kind];
  return x ? `<div class="sheet-bg" data-act="closeM"></div><div class="sheet" role="dialog" aria-modal="true">${x()}</div>` : _modalS();
};
Object.assign(LIVE, { frPaceIn:el => { const p = parsePace(el.value); if(p && !isNaN(p)){ M.pace = p; clearTimeout(LIVE.frT); LIVE.frT = setTimeout(() => { if(M && M.kind === "frpace") render(true); }, 600); } } });
const confirmThen = (title, msg, ok, okId, okLabel) => { M = {kind:"confirm", title, msg, ok, okId, okLabel, danger:true}; render(true); };
Object.assign(ACT, {
  frInvite:async () => {
    try{ const r = await CLOUD.api.createFriendInvite(CLOUD.user); S.ui.lastInvite = {uid:CLOUD.user.uid, code:r.code, expiresAt:r.expiresAt.getTime(), url:`${location.origin}${location.pathname}#friend=${r.code}`};
      const mine = LS.get(myInvitesKey()) || []; LS.set(myInvitesKey(), [...mine, r.code].slice(-20)); render(true); }
    catch(e){ toast(errText(e && e.code)); }
  },
  frCopy:() => { const el = document.getElementById("fr-link"); if(!el) return; el.select(); try{ navigator.clipboard.writeText(el.value).then(() => toast("Link tersalin"), () => { document.execCommand("copy"); toast("Link tersalin"); }); }catch(e){ document.execCommand("copy"); toast("Link tersalin"); } },
  frShareLink:() => { const i = S.ui.lastInvite; if(i && navigator.share) navigator.share({title:"Latihan bareng di WeRunIt", text:"Yuk jadi teman latihan di WeRunIt. Link ini sekali pakai, berlaku 7 hari.", url:i.url}).catch(() => {}); },
  frInviteCancel:async () => { const i = S.ui.lastInvite; if(!i) return; try{ await CLOUD.api.cancelFriendInvite(i.code); }catch(e){} S.ui.lastInvite = null; render(true); toast("Link dibatalkan"); },
  frSend:async () => { const inv = M.inv; try{ await CLOUD.api.sendFriendRequest(CLOUD.user, inv); rememberName(inv.from, inv.fromName, inv.fromPhoto); sessionStorage.removeItem(FRIEND_KEY); M = null; S.ui.tab = "bareng"; render(false); toast("Permintaan terkirim"); }catch(e){ sessionStorage.removeItem(FRIEND_KEY); M = null; render(true); toast(e && e.code === "permission-denied" ? "Permintaan nggak bisa dikirim (undangan udah dipakai, kedaluwarsa, atau kalian udah berteman)." : errText(e && e.code)); } },
  frSendNo:() => { sessionStorage.removeItem(FRIEND_KEY); M = null; render(true); },
  frAccept:async d => { try{ await CLOUD.api.acceptFriendRequest(CLOUD.user.uid, d.id); toast("Sekarang kalian berteman. Atur apa yang mau dibagikan."); }catch(e){ toast(errText(e && e.code)); } },
  frReject:async d => { try{ await CLOUD.api.deleteFriendRequest(d.id); }catch(e){ toast(errText(e && e.code)); } },
  frPerms:d => { M = {kind:"frperms", id:d.id}; render(true); },
  frPermsSave:() => {
    const p = {activities:[...document.querySelectorAll(".pm-act:checked")].map(x => x.value)};
    Object.keys(permLabels).forEach(k => p[k] = !!(document.getElementById("pm-" + k) || {}).checked);
    const c = SO.cleanPerms(p), id = M.id; S.shareWith = Object.assign({}, S.shareWith);
    if(SO.anyShared(c)) S.shareWith[id] = c; else delete S.shareWith[id];
    persist(); queueShares(0); M = null; render(true); toast(SO.anyShared(c) ? "Pengaturan berbagi disimpan" : "Nggak ada yang dibagikan ke teman ini");
  },
  frPermsNone:() => { const id = M.id; S.shareWith = Object.assign({}, S.shareWith); delete S.shareWith[id]; persist(); queueShares(0); M = null; render(true); toast("Semua berbagi ke teman ini dicabut"); },
  frPace:d => { M = {kind:"frpace", id:d.id}; render(true); },
  frRemove:d => confirmThen("Hapus teman?", `${esc(friendName(d.id).name)} nggak bisa lihat data yang kamu bagikan lagi. Data latihan kalian nggak terhapus.`, "frRemoveOk", d.id, "Hapus teman"),
  frRemoveOk:async d => { M = null; try{ await CLOUD.api.removeFriend(CLOUD.user.uid, d.id); S.shareWith = Object.assign({}, S.shareWith); delete S.shareWith[d.id]; persist(); toast("Teman dihapus"); }catch(e){ toast(errText(e && e.code)); } render(true); },
  frBlock:d => confirmThen("Blokir?", `${esc(friendName(d.id).name)} dihapus dari teman dan nggak bisa mengirim permintaan lagi.`, "frBlockOk", d.id, "Blokir"),
  frBlockOk:async d => { M = null; try{ await CLOUD.api.blockUser(CLOUD.user.uid, d.id); S.shareWith = Object.assign({}, S.shareWith); delete S.shareWith[d.id]; persist(); toast("Diblokir"); }catch(e){ toast(errText(e && e.code)); } render(true); },
  frBlocks:async () => { try{ FRIENDS.blocks = await CLOUD.api.listBlocks(CLOUD.user.uid); }catch(e){ FRIENDS.blocks = []; } M = {kind:"blocks"}; render(true); },
  frUnblock:async d => { try{ await CLOUD.api.unblockUser(CLOUD.user.uid, d.id); FRIENDS.blocks = FRIENDS.blocks.filter(x => x !== d.id); }catch(e){} render(true); },
  goalNew:() => { M = {kind:"goalnew"}; render(true); },
  goalCreate:async () => {
    const n = document.getElementById("gn-n").value.trim(), km = num(document.getElementById("gn-k").value), dt = document.getElementById("gn-d").value, f = document.getElementById("gn-f").value;
    if(!n || !(km >= 1) || !validYmd(dt) || !f){ toast("Isi nama, target km, tanggal, dan teman."); return; }
    try{ await CLOUD.api.createGoal(CLOUD.user.uid, f, {name:n, targetKm:km, targetDate:dt}); M = null; render(true); toast("Target bersama dibuat"); }catch(e){ toast(errText(e && e.code)); }
  },
  goalStatus:async d => { try{ await CLOUD.api.setGoalStatus(d.id, d.v); }catch(e){ toast(errText(e && e.code)); } },
  goalDel:async d => { try{ await CLOUD.api.deleteGoal(d.id); }catch(e){ toast(errText(e && e.code)); } }
});
TUT.HELP.bareng = {tour:"account", title:"Teman", what:"Cari teman pakai nama atau email, pilih apa yang dibagikan ke tiap teman, cek pace bareng, dan buat target bersama.", why:"Latihan bareng lebih semangat, tanpa membuka data pribadi.", how:["Cari nama atau email temanmu, lalu Tambah.", "Dia menerima permintaanmu.", "Atur yang kamu bagikan ke dia.", "Buat target bersama atau cek pace bareng."], ex:"Kamu & Rani menargetkan 300 km sampai JAKIM; tiap orang menyumbang km dari larinya sendiri.", warn:"Default privat. Catatan, check-in, nyeri, rute, dan lokasi nggak pernah dibagikan."};
Object.assign(ACT, {
  frSearch:async () => {
    const el = document.getElementById("fr-q"), q = (el ? el.value : FRIENDS.q).trim(); FRIENDS.q = q;
    if(q.length < 2){ toast("Ketik minimal 2 huruf"); return; }
    FRIENDS.searching = true; render(true);
    try{ const r = await CLOUD.api.searchProfiles(q, CLOUD.user.uid); r.forEach(x => rememberName(x.uid, x.name, x.photo)); FRIENDS.results = r; }
    catch(e){ FRIENDS.results = {error:isOnline() ? errText(e && e.code) : "Kamu lagi offline."}; }
    FRIENDS.searching = false; render(true);
  },
  frAdd:async d => {
    try{ await CLOUD.api.sendFriendRequestTo(CLOUD.user, d.id); toast("Permintaan terkirim"); }
    catch(e){ toast(e && e.code === "permission-denied" ? "Nggak bisa dikirim (sudah berteman, sudah ada permintaan, atau diblokir)." : errText(e && e.code)); }
  },
  frDiscover:async () => {
    const on = S.settings.discoverable === false; S.settings = Object.assign({}, S.settings);
    if(on) delete S.settings.discoverable; else S.settings.discoverable = false;
    persist(); try{ await CLOUD.api.setProfile(CLOUD.user, on); }catch(e){} render(true); toast(on ? "Kamu bisa ditemukan lewat pencarian" : "Kamu disembunyikan dari pencarian");
  }
});
// Enter in the search box runs the search.
document.addEventListener("keydown", e => { if(e.key === "Enter" && e.target && e.target.id === "fr-q"){ e.preventDefault(); ACT.frSearch(); } });
