/* WeRunIt v4 notifications: settings UI + the scheduler that hands reminders to the OS.
 * Shares globals with the main app script. Web: preferences + preview only (nothing scheduled).
 * Android APK with the local-notifications plugin: reminders for the next 14 days are re-planned
 * whenever the app starts, resumes, the plan/prefs change or the timezone changes.
 */
"use strict";
const NOTIF_TZ_KEY = "hmtp:notif:tz";
const NOTIF = {
  platform: HMTPNotify.platform(), perm: null, pendingN: null, sig: null, t: null, lastErr: "", lastAt: 0,
  init(){
    if(HMTPNotify.installNative()){
      this.refreshPerm();
      document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible"){ this.refreshPerm(); this.queue(500); } });
    }
  },
  async refreshPerm(){ this.perm = await HMTPNotify.adapter.permission(); this.pendingN = await (HMTPNotify.adapter.pending ? HMTPNotify.adapter.pending() : 0); if(S.ui.tab === "notif") rerenderSoft(); },
  reminders(horizonDays = 14, prefs = S.settings.notif){
    const W = PLANW.map(w => ({n:w.n, start:w.start, end:w.end, kind:w.kind, total:w.total, block:w.block}));
    const ses = [...allSessions(), ...allStrength()].map(s => ({id:s.id, date:s.date, time:s.time, title:s.title, dist:s.dist, type:s.type, done:sState(s) === "done", skipped:sState(s) === "skip"}));
    const e = activeEvent();
    return HMTP.buildReminders({sessions:ses, weeks:W, logs:S.logs, prefs, now:new Date(), horizonDays, event:{id:e.id, name:e.name, date:e.eventDate, distanceKm:e.distanceKm}});
  },
  queue(delay = 2500){ if(!HMTPNotify.isActive()) return; clearTimeout(this.t); this.t = setTimeout(() => this.apply(), delay); },
  async apply(force){
    if(!HMTPNotify.isActive() || !PLANW.length) return;
    const A = HMTPNotify.adapter, tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "", prevTz = LS.get(NOTIF_TZ_KEY);
    try{
      if(!S.settings.notif.enabled || (this.perm = await A.permission()) !== "granted"){
        if(this.sig !== "off"){ await A.cancelAll(); this.sig = "off"; this.pendingN = 0; }
        return;
      }
      const list = this.reminders(14);
      // the day changes the "already past" set, the timezone changes wall-clock times
      const sig = tz + "|" + todayYmd() + "|" + JSON.stringify(list.map(r => [r.id, +r.at, r.title, r.body]));
      if(!force && sig === this.sig && prevTz === tz) return;
      const r = await A.schedule(list);
      this.sig = sig; this.pendingN = r.scheduled; this.lastAt = Date.now(); this.lastErr = ""; LS.set(NOTIF_TZ_KEY, tz);
    }catch(e){ this.lastErr = String(e && e.message || e).slice(0, 200); }
    if(S.ui.tab === "notif") rerenderSoft();
  }
};
const _persistN = persist;
persist = function(){ _persistN(); NOTIF.queue(); };
const _renderN = render;
render = function(keep){ _renderN(keep); NOTIF.queue(4000); };   // also catches plan changes synced from another device
const _startAppN = startApp;
startApp = function(){ NOTIF.init(); _startAppN(); NOTIF.queue(3000); };
// the menu no longer calls this "coming soon" once a real adapter is possible
NAV_MORE.forEach(x => { if(x[0] === "notif") x[1] = "Notifikasi"; });

function notifStatus(){
  const P = NOTIF.platform, n = S.settings.notif;
  if(P === "web") return `<div class="note info" style="margin:12px 0"><b>Notifikasi hanya di aplikasi Android.</b> Browser nggak bisa mengirim pengingat di latar belakang secara andal, jadi versi web nggak minta izin dan nggak mengirim apa pun. Pilihan di bawah tersimpan di akun dan dipakai aplikasi Android kamu.</div>`;
  if(P === "native-missing-plugin") return `<div class="note warn" style="margin:12px 0"><b>Perlu update aplikasi.</b> Versi APK yang terpasang belum punya modul notifikasi. Pasang APK terbaru (data kamu tetap aman), lalu buka halaman ini lagi.</div>`;
  if(!n.enabled) return `<div class="note info" style="margin:12px 0">Notifikasi mati. Nyalakan di bawah; Android akan menanyakan izin sekali.</div>`;
  if(NOTIF.perm === "denied") return `<div class="note warn" style="margin:12px 0"><b>Izin notifikasi ditolak.</b> Buka Pengaturan Android → Aplikasi → WeRunIt → Notifikasi, lalu izinkan. Setelah itu kembali ke sini.</div>`;
  if(NOTIF.perm !== "granted") return `<div class="note info" style="margin:12px 0">Izin notifikasi belum diberikan. Tekan “Simpan pilihan” untuk meminta izin.</div>`;
  return `<div class="note ok" style="margin:12px 0"><b>Aktif.</b> ${NOTIF.pendingN === null ? "" : `${NOTIF.pendingN} pengingat terjadwal untuk 14 hari ke depan. `}Pengingat dijadwalkan di sistem Android, jadi tetap muncul walau app ditutup. Buka app setidaknya sekali dalam 2 minggu supaya jadwalnya terus diperbarui. Android bisa menggeser waktunya beberapa menit untuk hemat baterai.${NOTIF.lastErr ? `<br><span class="xs">Gagal menjadwalkan terakhir kali: ${esc(NOTIF.lastErr)}</span>` : ""}</div>`;
}
vNotif = function(){
  const n = S.settings.notif, native = NOTIF.platform === "native";
  const preview = NOTIF.reminders(7, Object.assign({}, n, {enabled:true}));
  const cb = (k, l, d) => `<label class="toggle"><span>${l}${d ? `<br><span class="xs mu">${d}</span>` : ""}</span><input type="checkbox" id="nf-${k}" ${n[k] ? "checked" : ""}></label>`;
  const tm = (k, l) => `<div class="field"><label for="nf-${k}">${l}</label><input type="time" id="nf-${k}" value="${esc(n[k])}"></div>`;
  return `${pageHead("Notifikasi", "Pengingat workout, hitung mundur race, minum sebelum long run, tips, dan rekap. Semua dibuat dari jadwal dan catatanmu sendiri.")}
  ${notifStatus()}
  <div data-tour="notif-prefs">
    ${cb("enabled", native ? "Aktifkan notifikasi" : "Aktifkan notifikasi (di aplikasi Android)")}
    ${cb("workout", "Pengingat workout", "Sebelum sesi dan malam sebelumnya")}${cb("race", "Hitung mundur race", "28, 14, 7, 3, dan 1 hari sebelum race aktif")}${cb("hydration", "Pengingat minum", "90 menit sebelum long run dan race")}${cb("tips", "Tips latihan mingguan")}${cb("weekly", "Rekap mingguan")}${cb("monthly", "Review bulanan")}
    <div class="g2" style="margin-top:12px"><div class="field"><label for="nf-leadMin">Ingetin sebelum workout</label><select id="nf-leadMin">${[15,30,60,90,120,180].map(v => `<option value="${v}" ${n.leadMin === v ? "selected" : ""}>${v < 60 ? v + " menit" : (v/60).toString().replace(".", ",") + " jam"}</option>`).join("")}</select></div><div></div>
    ${tm("wdTime", "Jam pengingat hari kerja")}${tm("weTime", "Jam pengingat weekend")}${tm("quietStart", "Jam tenang mulai")}${tm("quietEnd", "Jam tenang selesai")}</div>
    <p class="xs mu">Zona waktu: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || "perangkat")}. Kalau zona waktu perangkat berubah, jadwal pengingat dihitung ulang saat app dibuka. Di jam tenang, pengingat digeser ke akhir jam tenang, atau dilewati kalau jadinya telat.</p>
    <div class="btns" style="margin-top:10px"><button class="btn pri" data-act="notifSave">Simpan pilihan</button>${native && NOTIF.perm === "granted" && n.enabled ? `<button class="btn" data-act="notifTest">Kirim notifikasi tes</button>` : ""}</div>
  </div>
  <div class="sec" data-tour="notif-preview"><h2>Pratinjau 7 hari ke depan</h2><p class="sm mu" style="margin:4px 0 8px">${native && n.enabled && NOTIF.perm === "granted" ? "Yang akan muncul di perangkat ini." : "Contoh dari jadwal dan catatan asli kamu. Belum dikirim."}</p>
    ${preview.length ? `<div class="rows">${preview.slice(0,14).map(r => `<div class="row"><span class="day"><b>${HARI[r.at.getDay()].slice(0,3)}</b><span>${pad(r.at.getHours())}:${pad(r.at.getMinutes())}</span></span><span class="grow"><b>${esc(r.title)}</b><br><span class="sm mu">${esc(r.body)}</span></span></div>`).join("")}</div>` : `<p class="mu">Nggak ada pengingat di 7 hari ke depan dengan pilihan ini.</p>`}</div>`;
};
Object.assign(ACT, {
  notifSave:async () => {
    const n = Object.assign({}, S.settings.notif), g = id => document.getElementById("nf-" + id);
    ["enabled","workout","tips","weekly","monthly","race","hydration"].forEach(k => n[k] = !!g(k).checked);
    ["wdTime","weTime","quietStart","quietEnd"].forEach(k => { if(/^\d{2}:\d{2}$/.test(g(k).value)) n[k] = g(k).value; });
    n.leadMin = Number(g("leadMin").value); n.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    S.settings.notif = HMTP.cleanNotif(n); persist();
    let msg = "Pilihan notifikasi disimpan.";
    if(HMTPNotify.isActive()){
      // permission is asked only here, right after the user turned reminders on and pressed Save
      if(n.enabled && (NOTIF.perm = await HMTPNotify.adapter.permission()) === "prompt") NOTIF.perm = await HMTPNotify.adapter.requestPermission();
      await NOTIF.apply(true);
      msg = !n.enabled ? "Notifikasi dimatikan; pengingat terjadwal dihapus." : NOTIF.perm === "granted" ? `Tersimpan. ${NOTIF.pendingN || 0} pengingat dijadwalkan.` : "Tersimpan, tapi izin notifikasi belum diberikan.";
    }else if(NOTIF.platform === "web") msg += " Notifikasi dikirim lewat aplikasi Android.";
    render(true); toast(msg);
  },
  notifTest:async () => { try{ await HMTPNotify.adapter.test(); toast("Notifikasi tes muncul dalam ±5 detik."); }catch(e){ toast("Notifikasi tes gagal: " + String(e && e.message || e).slice(0, 80)); } }
});
