/* WeRunIt v4 weather card + location picker. Shares globals with the main app script.
 * Location is chosen explicitly (device location on tap, or a city search), stored on this device only
 * (never synced or shared), and rounded to ~1 km before it is sent to Open-Meteo.
 */
"use strict";
const WXL = WRI_WEATHER;
const WX_LOC_KEY = "hmtp:weather:loc", WX_CACHE_KEY = "hmtp:weather:cache:v1";
const WX = {
  busy:false, err:"", results:null, searching:false, geoErr:"", lastTry:0,
  loc(){ const l = LS.get(WX_LOC_KEY); return l && typeof l.lat === "number" && typeof l.lon === "number" ? l : null; },
  cache(){ const c = LS.get(WX_CACHE_KEY), l = this.loc(); return c && l && c.key === `${l.lat},${l.lon}` && c.data && Array.isArray(c.data.hours) ? c.data : null; },
  async load(force){
    const l = this.loc(); if(!l || this.busy) return;
    const c = this.cache();
    if(!force && (!WXL.needsRefresh(c) || Date.now() - this.lastTry < 5 * 6e4)) return;   // back off 5 min after a try
    if(!isOnline()){ this.err = "Offline: menampilkan data terakhir."; return; }
    this.busy = true; this.lastTry = Date.now();
    try{
      const r = await fetch(WXL.forecastUrl(l.lat, l.lon, 3), {cache:"no-store"});
      let j = null; try{ j = await r.json(); }catch(e){}
      if(!r.ok && !(j && j.error)) throw new Error(`Layanan cuaca membalas ${r.status}`);
      const data = WXL.parseForecast(j, Date.now());
      LS.set(WX_CACHE_KEY, {key:`${l.lat},${l.lon}`, data}); this.err = "";
    }catch(e){ this.err = String(e && e.message || "Cuaca nggak bisa diambil").slice(0, 160); }
    this.busy = false;
    if(S.ui.tab === "home") rerenderSoft();
    if(M && M.kind === "wxloc") render(true);
  },
  setLoc(l){ LS.set(WX_LOC_KEY, {name:String(l.name || "Lokasi").slice(0, 80), lat:WXL.round2(l.lat), lon:WXL.round2(l.lon), src:l.src}); this.err = ""; this.load(true); }
};
const hhmm = t => t.slice(11, 16);
const ageText = ms => { const m = Math.round(ms / 6e4); return m < 1 ? "baru saja" : m < 60 ? `${m} menit lalu` : m < 1440 ? `${Math.round(m / 60)} jam lalu` : `${Math.round(m / 1440)} hari lalu`; };
/** The next planned run that falls inside the forecast range (today or the next 2 days). */
function wxSession(data){
  const t = todayYmd(), last = data.hours[data.hours.length - 1].time.slice(0, 10);
  return allSessions().filter(s => s.date >= t && s.date <= last && !["done", "skip"].includes(sState(s)) && s.type !== "strength")
    .filter(s => s.date > t || s.time >= `${pad(new Date().getHours())}:00`).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
}
function sessMinutes(s){ const gp = parseDur(activeEvent().targetFinish || S.settings.goalTime) / activeEvent().distanceKm || 420; return Math.round((s.dist || 5) * gp * (s.type === "easy" || s.type === "long" || s.type === "recovery" ? 1.15 : 1) / 60); }
function weatherCard(){
  const l = WX.loc();
  if(!l) return `<section class="card wx" data-reveal data-tour="weather"><h3 style="margin:0 0 4px">Cuaca buat latihan</h3><p class="sm mu">Prakiraan di jam latihanmu + tips. Lokasi cuma di perangkat ini.</p><div class="btns" style="margin-top:8px"><button class="btn sm pri" data-act="wxLoc">Atur lokasi</button></div></section>`;
  const d = WX.cache(); setTimeout(() => WX.load(false), 0);
  if(!d) return `<section class="card wx" data-reveal data-tour="weather"><h3 style="margin:0 0 4px">Cuaca · ${esc(l.name)}</h3><p class="sm mu">${WX.busy ? "Mengambil prakiraan..." : WX.err ? esc(WX.err) : "Mengambil prakiraan..."}</p>${WX.err ? `<div class="btns" style="margin-top:8px"><button class="btn sm" data-act="wxRefresh">Coba lagi</button><button class="btn sm ghost" data-act="wxLoc">Ganti lokasi</button></div>` : ""}${wxAttrib()}</section>`;
  const fr = WXL.freshness(d), cur = d.current, s = wxSession(d), U = d.units;
  const sum = s ? WXL.summarize(WXL.windowFor(d, s.date, s.time, sessMinutes(s))) : null;
  const tp = fr === "expired" ? [] : WXL.tips(sum, {type:s && s.type, durationMin:s ? sessMinutes(s) : 45});
  const cool = s && s.date === todayYmd() && tp.some(t => t.id === "heat") ? WXL.coolestHour(d, s.date) : null;
  const lvl = {good:"ok", info:"info", warn:"warn", bad:"bad"};
  return `<section class="card wx" data-reveal data-tour="weather">
    <div class="titlerow"><h3 style="margin:0">Cuaca · ${esc(l.name)}</h3><button class="btn sm ghost" data-act="wxLoc" aria-label="Ganti lokasi cuaca">Lokasi</button></div>
    ${cur && cur.temp !== null && fr !== "expired" ? `<p class="num" style="font-size:26px;margin-top:6px">${Math.round(cur.temp)}${esc(U.temp)} <span class="sm mu">${esc(WXL.codeText(cur.code))}${cur.feels !== null ? ` · terasa ${Math.round(cur.feels)}${esc(U.temp)}` : ""}${cur.rh !== null ? ` · lembap ${Math.round(cur.rh)}%` : ""}</span></p>` : ""}
    ${s ? (sum ? `<p class="sm" style="margin-top:6px"><b>${s.date === todayYmd() ? "Hari ini" : fmtDay(s.date)} ${esc(s.time)} · ${esc(s.title)}</b><br><span class="mu">${hhmm(sum.from)}–${pad(+hhmm(sum.to).slice(0, 2) + 1)}:00: ${sum.temp !== null ? `${Math.round(sum.temp)}${esc(U.temp)}` : "—"}${sum.feels !== null ? `, terasa sampai ${Math.round(sum.feels)}${esc(U.temp)}` : ""}${sum.pop !== null ? `, peluang hujan ${Math.round(sum.pop)}%` : ""}${sum.wind !== null ? `, angin ${Math.round(sum.wind)} ${esc(U.wind === "km/h" ? "km/jam" : U.wind)}` : ""}</span></p>` : `<p class="sm mu" style="margin-top:6px">Prakiraan belum mencakup jam sesi berikutnya.</p>`) : `<p class="sm mu" style="margin-top:6px">Nggak ada sesi lari dalam rentang prakiraan (3 hari).</p>`}
    ${tp.length ? `<ul class="wx-tips">${tp.map(t => `<li class="note ${lvl[t.level]}" style="margin-top:8px"><b>${esc(t.text)}</b><br><span class="xs">Kenapa: ${esc(t.why)}</span></li>`).join("")}</ul>` : ""}
    ${cool ? `<p class="xs mu" style="margin-top:6px">Jam paling sejuk hari ini (05–20): ${hhmm(cool.time)}, terasa ${Math.round(cool.feels)}${esc(U.temp)}.</p>` : ""}
    ${fr === "expired" ? `<div class="note warn" style="margin-top:8px">Data cuaca terakhir sudah lebih dari 12 jam, jadi nggak dipakai buat tips. ${isOnline() ? "" : "Sambungkan internet buat memperbarui."}</div>` : ""}
    <p class="xs mu" style="margin-top:8px">Prakiraan model (bukan pengukuran) · diambil ${ageText(Date.now() - d.retrievedAt)}${fr === "stale" ? " · <b>data lama</b>" : ""}${WX.busy ? " · memperbarui..." : ""}${WX.err ? ` · ${esc(WX.err)}` : ""} <button class="link xs" data-act="wxRefresh">Perbarui</button></p>
    ${wxAttrib()}</section>`;
}
const wxAttrib = () => `<p class="xs mu">Data cuaca: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>`;
const _cockpitW = cockpit;
cockpit = function(o){ const h = _cockpitW(o); return h.replace("<!--wx-->", weatherCard()); };   // slot after the quick actions

function mWxLoc(){
  const l = WX.loc(), R = WX.results;
  return `${mHead("Lokasi cuaca", "Disimpan di perangkat ini saja, nggak di-sync atau dibagikan. Dibulatkan ±1 km sebelum dikirim ke Open-Meteo.")}
  ${l ? `<p class="sm">Sekarang: <b>${esc(l.name)}</b> <span class="mu">(${l.lat}, ${l.lon})</span></p>` : ""}
  <button class="btn" style="margin-top:10px;width:100%" data-act="wxGeo">Pakai lokasi saya sekarang</button>
  ${WX.geoErr ? `<p class="err" style="margin-top:6px">${esc(WX.geoErr)}</p>` : ""}
  <div class="field" style="margin-top:14px"><label for="wx-q">Atau cari kota</label><input type="search" id="wx-q" placeholder="misal: Bandung" maxlength="80" autocomplete="off"></div>
  <button class="btn sm" data-act="wxSearch">${WX.searching ? "Mencari..." : "Cari"}</button>
  ${R ? (R.error ? `<p class="err" style="margin-top:8px">${esc(R.error)}</p>` : R.length ? `<div class="rows" style="margin-top:8px">${R.map((r, i) => `<button class="row" data-act="wxPick" data-i="${i}"><span class="grow"><b>${esc(r.name)}</b><br><span class="xs mu">${esc([r.admin, r.country].filter(Boolean).join(", "))}</span></span><span class="mu">›</span></button>`).join("")}</div>` : `<p class="sm mu" style="margin-top:8px">Nggak ketemu.</p>`) : ""}
  ${l ? `<div class="sec"><button class="btn sm ghost" data-act="wxClear">Hapus lokasi & data cuaca</button></div>` : ""}`;
}
const _modalW = modal;
modal = function(){ return M && M.kind === "wxloc" ? `<div class="sheet-bg" data-act="closeM"></div><div class="sheet" role="dialog" aria-modal="true">${mWxLoc()}</div>` : _modalW(); };
Object.assign(ACT, {
  wxLoc:() => { WX.results = null; WX.geoErr = ""; M = {kind:"wxloc"}; render(true); },
  wxRefresh:() => { WX.load(true); toast("Memperbarui cuaca..."); },
  wxGeo:() => {
    if(!navigator.geolocation){ WX.geoErr = "Perangkat ini nggak mendukung lokasi. Cari kota aja."; render(true); return; }
    WX.geoErr = ""; toast("Meminta lokasi...");
    navigator.geolocation.getCurrentPosition(p => { WX.setLoc({name:"Lokasi saya", lat:p.coords.latitude, lon:p.coords.longitude, src:"gps"}); M = null; render(true); toast("Lokasi disimpan"); },
      e => { WX.geoErr = e && e.code === 1 ? "Izin lokasi ditolak. Kamu bisa cari kota di bawah, atau izinkan lokasi di pengaturan." : "Lokasi nggak bisa didapat. Coba lagi atau cari kota."; render(true); },
      {enableHighAccuracy:false, timeout:15000, maximumAge:30 * 6e4});
  },
  wxSearch:async () => {
    const q = (document.getElementById("wx-q") || {}).value || ""; if(q.trim().length < 2) return;
    WX.searching = true; render(true); const keep = q;
    try{ const r = await fetch(WXL.geocodeUrl(q.trim())); WX.results = WXL.parseGeocode(await r.json()); }
    catch(e){ WX.results = {error:isOnline() ? String(e && e.message || "Pencarian gagal").slice(0, 120) : "Kamu lagi offline."}; }
    WX.searching = false; render(true); const el = document.getElementById("wx-q"); if(el) el.value = keep;
  },
  wxPick:d => { const r = WX.results && WX.results[+d.i]; if(!r) return; WX.setLoc({name:r.name, lat:r.lat, lon:r.lon, src:"search"}); M = null; render(true); toast(`Lokasi: ${r.name}`); },
  wxClear:() => { LS.del(WX_LOC_KEY); LS.del(WX_CACHE_KEY); WX.err = ""; M = null; render(true); toast("Lokasi cuaca dihapus"); }
});
