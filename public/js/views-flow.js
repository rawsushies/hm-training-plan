/* WeRunIt hassle-less flow (3.12): open straight into the app, no automatic interruptions, one-tap logging.
 * Loaded last; overrides earlier definitions. Shares app globals.
 *  - Boot: never waits on the network for a returning user (update check + account restore continue in the
 *    background; banners appear only if something needs attention).
 *  - First run: one onboarding screen (days you can run; profile optional and folded away). No auto tour.
 *  - No "new tutorial" banner. Help stays one tap away on every page (?).
 *  - "✓ Selesai" marks today's planned session done with its planned distance in one tap; the toast offers Ubah.
 */
"use strict";
bootSequence = async function(){
  const t0 = Date.now();
  bootStep("shell", "ok");
  bootStep("update", "skip", isOnline() ? "dicek di latar belakang" : "offline");
  const returning = !!ACTIVE_UID || CLOUD.state === "off" || HMTP.hasRealData(S) || LS.get(GATE_KEY) === "local";
  // A fresh device needs to know whether a Google session exists (gate vs app); a returning user does not.
  const authed = await waitFor(() => !["init", "loading"].includes(CLOUD.state), returning ? 250 : 2500);
  bootStep("account", authed ? "ok" : "skip", CLOUD.state === "off" ? "mode lokal" : CLOUD.user ? (CLOUD.user.displayName || "").split(" ")[0] : authed ? "belum masuk" : "dipulihkan di latar belakang");
  BOOTING = false; render(false); bootStep("data", "ok");
  const min = WRI_MOTION.reduced() ? 0 : 450;
  setTimeout(() => { const b = document.getElementById("boot"); if(b){ b.classList.add("done"); setTimeout(() => b.remove(), 400); } window.__bootDone = true; maybeStartTutorial(); }, Math.max(0, min - (Date.now() - t0)));
};
// Only the first-run onboarding may open by itself; tours start only when the user asks (? or Menu → Tutorial).
maybeStartTutorial = function(){ if(!RUN && !S.ui.tut && !M && !BOOTING && !gateActive()) maybeOnboard(); };

mOnboard = function(){
  const p = S.profile, u = CLOUD.user;
  return `<div class="help-h">${mascot("mascot-inline")}${mHead(`${u && u.displayName ? esc(u.displayName.split(" ")[0]) + ", k" : "K"}apan kamu bisa lari?`)}</div>
    ${availEditor(schedDraft(), true)}
    <details class="ob-more" style="margin-top:10px"><summary class="sm">Profil buat strategi race (opsional)</summary>
      <div class="g2" style="margin-top:8px"><div class="field"><label for="ob-m">Berat (kg)</label><input type="text" inputmode="decimal" id="ob-m" value="${p.massKg ?? ""}"></div><div class="field"><label for="ob-hr">HR maks terukur</label><input type="text" inputmode="numeric" id="ob-hr" value="${p.hrMax ?? ""}" placeholder="kalau tahu"></div></div>
      <div class="g2"><div class="field"><label for="ob-h">Tinggi (cm)</label><input type="text" inputmode="decimal" id="ob-h" value="${p.heightCm ?? ""}"></div><div class="field"><label for="ob-a">Umur</label><input type="text" inputmode="numeric" id="ob-a" value="${p.age ?? ""}"></div></div></details>
    <button class="btn pri" style="margin-top:12px;width:100%" data-act="obDone">Mulai latihan</button>`;
};
ACT.obDone = () => {
  const g = id => { const el = document.getElementById(id); const v = el ? el.value.trim() : ""; return v === "" ? null : num(v); };
  const pr = {massKg:g("ob-m"), heightCm:g("ob-h"), age:g("ob-a"), hrMax:g("ob-hr")};
  if(Object.values(pr).some(v => v !== null)) S.profile = HMTP.cleanProfile(Object.assign({}, S.profile, pr));
  const D = WRI_SCHED.cleanSchedule(schedDraft());
  if(D && D.avail.some(Boolean) && JSON.stringify(D) !== JSON.stringify(WRI_SCHED.cleanSchedule(WRI_SCHED.fromLegacy(S.settings.weekday)))) S.schedule = D;
  S.ui.schedDraft = null; S.profile = Object.assign({}, S.profile, {onboarded:true});
  persist(); M = null; render(false);
  toast("Siap. Butuh bantuan? Tekan ? di tiap halaman.");
};

/* ---------- one-tap done ---------- */
function quickDoneBtn(s, cls = "btn sm"){
  if(!s || s.type === "strength" || s.date !== todayYmd() || logFor(s.id) || !s.dist) return "";
  return `<button class="${cls}" data-act="quickDone" data-id="${esc(s.id)}" aria-label="Tandai ${esc(s.title)} selesai, ${fmtKm(s.dist)} km">✓ Selesai</button>`;
}
let QUICK_LAST = null;
Object.assign(ACT, {
  quickDone:d => {
    const s = sessById(d.id); if(!s || logFor(s.id)) return;
    const l = {id:uid(), date:s.date, type:s.type, sessionId:s.id, distance:s.dist, duration:null, elev:null, hrAvg:null, hrMax:null, rpe:null, weather:"", notes:"", src:"cepat", shoeId:S.settings.defaultShoe || null};
    delete S.status[s.id]; S.logs.push(l); QUICK_LAST = l.id; persist(); render(true);
    toast(`✓ ${fmtKm(s.dist)} km tercatat. Tap buat isi waktu/RPE.`);
    const t = document.getElementById("toast");
    if(t){ t.setAttribute("role", "button"); t.onclick = () => { t.onclick = null; t.removeAttribute("role"); t.classList.remove("on"); if(QUICK_LAST) ACT.editLog({id:QUICK_LAST}); }; setTimeout(() => { t.onclick = null; t.removeAttribute("role"); }, 2700); }
  }
});
// Dashboard: put "✓ Selesai" next to Mulai/Catat when the next session is today.
const _cockpitF = cockpit;
cockpit = function(o){
  const h = _cockpitF(o), b = quickDoneBtn(o.next, "btn sm pri");
  return b ? h.replace(`<button class="btn sm pri" data-act="runStart" data-id="${o.next.id}">`, `${b}<button class="btn sm" data-act="runStart" data-id="${o.next.id}">`) : h;
};
// Today card: the same one-tap action under today's sessions.
const _todayCardF = todayCard;
todayCard = function(){
  const h = _todayCardF(); if(!h) return h;
  const btns = itemsOnDate(todayYmd()).map(s => quickDoneBtn(s)).filter(Boolean).join("");
  return btns ? h.replace(/<\/div>(<button class="btn sm" style="margin-top:10px" data-act="nav" data-t="goals">|<\/section>$)/, `</div><div class="btns" style="margin-top:10px">${btns}</div>$1`) : h;
};
