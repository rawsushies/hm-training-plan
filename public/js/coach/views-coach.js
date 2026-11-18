/* WeRunIt product reset: three destinations (Hari ini · Coach · Plan) + secondary Settings.
 * Coach = deterministic engine (js/coach/engine.js) over runner-entered / Health Connect sessions. No AI, no Strava data.
 * Routes reuse the existing keys so render()'s view map keeps working: home → Hari ini, log → Coach, race → Plan,
 * more → Pengaturan. Removed UI (Lab investigations, research, file import, shoes, race strategy tabs) redirects; data is kept.
 * Loaded after js/v5/pages5.js and before startApp().
 */
(function () {
  "use strict";
  const D = WRI_DS, ic = D.ic, e = D.esc, CM = WRI_COACH_MODEL, CO = WRI_COACH, V5 = window.__v5;

  /* ---------- Navigation ---------- */
  IC.v5coach = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/></svg>';
  IC.v5set = ic("gear", "ico");
  IC.v5plan = ic("cal", "ico");
  NAV_MAIN.splice(0, NAV_MAIN.length, ["home", "Hari ini"], ["log", "Coach"], ["race", "Plan"]);
  Object.keys(DOCK_ICON).forEach(k => delete DOCK_ICON[k]);
  Object.assign(DOCK_ICON, { home: "v5home", log: "v5coach", race: "v5plan", more: "v5set" });
  Object.keys(DOCK_GROUP).forEach(k => delete DOCK_GROUP[k]);
  Object.assign(DOCK_GROUP, { home: "home", log: "log", race: "race", cal: "race", jadwal: "race" });
  NAV_MORE.splice(0, NAV_MORE.length, ["more", "Pengaturan"]);
  const ALIAS = { coach: "log", plan: "race", lab: "log", review: "log", shoes: "more", integ: "more", pace: "race" };
  const _nav = ACT.nav;
  ACT.nav = d => { const t = ALIAS[d.t] || d.t; if (d.t === "lab" || d.t === "review") COACH.sec = "ask"; return _nav(Object.assign({}, d, { t })); };
  if (S.ui && ALIAS[S.ui.tab]) S.ui.tab = ALIAS[S.ui.tab];
  vShoes = () => vMore(); vInteg = () => vMore();
  if (typeof window.vLab === "function") window.vLab = () => vLog();
  // Keep the bottom bar on secondary pages (Settings has no tab of its own).
  const _setDockC = setDock;
  setDock = function (active) { _setDockC(active); if (active && typeof DOCK !== "undefined" && DOCK && !RUN) DOCK.nav.hidden = false; };   // never behind the gate (active === null)

  /* ---------- Coach state + data ---------- */
  const COACH = { q: "", ans: null, open: {}, sec: "obs" };
  // HR max is only used when the runner entered it (onboarding asks for a measured value); never estimated from age.
  const hrMaxMeasured = () => { const h = S.profile && +S.profile.hrMax; return h >= 120 && h <= 230 ? h : null; };
  function assessNow() { const { sessions } = CM.sessionsFrom(S); return { A: CO.assess(sessions, { today: todayYmd(), hrMaxMeasured: hrMaxMeasured(), strength: CM.strengthFrom(S) }), sessions }; }
  const gear = () => `<button class="v5-gear" data-act="nav" data-t="more" aria-label="Pengaturan">${ic("gear")}</button>`;
  const KIND = { strength: ["Kekuatan", "pos"], limitation: ["Perlu diperbaiki", "warn"], opportunity: ["Peluang", "acc"], neutral: ["Stabil", "mu"], insufficient: ["Belum cukup data", "mu"] };
  const mark = k => `<span class="c-kind t-${KIND[k][1]}"><i></i>${KIND[k][0]}</span>`;

  /* ---------- Observation (progressive disclosure: one line → evidence) ---------- */
  function obsRow(o, open) {
    const covPct = o.coverage && o.coverage.total ? Math.round(o.coverage.have / o.coverage.total * 100) : null;
    return `<details class="c-obs k-${o.kind}" data-obs="${e(o.id)}"${open ? " open" : ""}><summary>${mark(o.kind)}<b class="c-obs-t">${e(o.title)}</b><span class="c-obs-f">${e(o.fact)}</span>${ic("chev", "c-chev")}</summary>
      <div class="c-obs-b">
        ${o.measures.length ? `<div class="v5-figs c-meas">${o.measures.map(m => `<div class="ds-fig s"><span class="ds-v">${e(m.value)}</span><span class="ds-l">${e(m.label)}</span></div>`).join("")}</div>` : ""}
        ${o.interpretation ? `<p class="c-layer"><span class="ds-k">Artinya</span>${e(o.interpretation)}</p>` : ""}
        ${o.recommendation ? `<p class="c-layer"><span class="ds-k">Coba ubah</span>${e(o.recommendation)}</p>` : ""}
        ${o.monitor ? `<p class="c-layer"><span class="ds-k">Pantau</span>${e(o.monitor)}</p>` : ""}
        <p class="c-meta">${e(o.window.from)} – ${e(o.window.to)} · n ${o.n}${covPct !== null ? ` · ${e(o.coverage.field)} tercatat ${o.coverage.have}/${o.coverage.total}` : ""} · keyakinan ${e(o.confidence)} · ${CO.VERSION}</p>
      </div></details>`;
  }

  /* ---------- Hari ini ---------- */
  vHome = function () {
    const { A } = assessNow(), k = A.key;
    const insight = k ? `<section class="c-key k-${k.kind}" data-tour="insight">${D.head("Satu hal untuk diperhatikan", `<button class="v5-lnk" data-act="coachObs" data-id="${e(k.id)}">Lihat bukti ${ic("chev")}</button>`)}
        ${mark(k.kind)}<p class="c-key-t">${e(k.title)}: ${e(k.recommendation || k.interpretation)}</p><p class="c-meta">${e(k.fact)}</p></section>`
      : `<section class="c-key k-insufficient" data-tour="insight">${D.head("Satu hal untuk diperhatikan")}<p class="c-key-t">Belum cukup data untuk wawasan.</p><p class="c-meta">Catat jarak, waktu, dan effort di beberapa lari; coach mulai membaca pola dari 4 lari.</p><button class="v5-btn" data-act="quickLog">${ic("plus")}Catat lari</button></section>`;
    return `${storageNote()}<div class="v5 v5-today c-today">
      <header class="v5-top"><div><p class="ds-k">${e(fmtDay(todayYmd()))}</p><h1 class="v5-h">Hari ini</h1></div><div class="c-top-r">${V5.raceChip()}${gear()}</div></header>
      ${V5.hero()}
      ${insight}
      ${V5.weekPanel()}
      ${V5.wxTile()}
    </div>`;
  };

  /* ---------- Coach ---------- */
  function askBlock(A) {
    const a = COACH.ans;
    return `<section class="c-ask" data-tour="coach-ask">
      <form class="c-ask-f" data-act="coachAsk" onsubmit="return false"><label class="sr" for="coach-q">Tanya coach</label><input id="coach-q" type="text" maxlength="300" autocomplete="off" placeholder="Tanya tentang latihanmu…" value="${e(COACH.q)}"><button class="v5-btn pri" data-act="coachAsk" type="button">Tanya</button></form>
      ${a ? `<div class="c-ans${a.safety ? " safety" : ""}" role="status" aria-live="polite"><p class="ds-k">${e(COACH.q)}</p><p class="c-ans-d">${e(a.direct)}</p>
          ${a.evidence.length ? `<div class="c-ans-ev">${a.evidence.map(o => `<button class="v5-chip" data-act="coachObs" data-id="${e(o.id)}">${mark(o.kind)}${e(o.title)} · n ${o.n}</button>`).join("")}</div>` : ""}
          ${a.actions.length ? `<ol class="c-ans-act">${a.actions.map(x => `<li>${e(x)}</li>`).join("")}</ol>` : ""}
          <p class="c-meta">${e(a.uncertainty)}</p>
          ${a.followups.length ? `<div class="c-sug">${a.followups.map(q => `<button class="v5-chip" data-act="coachQ" data-q="${e(q)}">${e(q)}</button>`).join("")}</div>` : ""}</div>`
        : `<div class="c-sug">${CO.SUGGEST.map(q => `<button class="v5-chip" data-act="coachQ" data-q="${e(q)}">${e(q)}</button>`).join("")}</div>`}
      <p class="c-meta">Dijawab dengan aturan analisis di perangkat ini, bukan AI. Bukan pengganti pelatih berlisensi atau tenaga medis.</p></section>`;
  }
  function coverageBlock(A, sessions) {
    const cov = CM.coverage(sessions);
    return `<section class="v5-panel c-cov" data-tour="coverage">${D.head("Data yang tersedia", `<span class="ds-k">${sessions.length} lari</span>`)}
      ${sessions.length ? `<div class="c-cov-l">${cov.map(c => `<div class="c-cov-r"><span>${e(c.label)}</span>${D.meter(c.have, c.total || 1, { tone: c.have / (c.total || 1) >= .5 ? "pos" : "warn", label: `${c.label}: ${c.have} dari ${c.total}` })}<b class="num">${c.have}/${c.total}</b></div>`).join("")}</div>` : `<p class="v5-empty">Belum ada lari tercatat.</p>`}
      ${D.head("Belum bisa dijawab")}<ul class="c-cant">${A.unanswerable.map(u => `<li><b>${e(u.q)}</b><span>${e(u.why)}</span></li>`).join("")}</ul></section>`;
  }
  function evidenceBlock(sessions) {
    const vol = V5.calVolume(12), ls = [...S.logs].filter(l => !l.sample).sort((a, b) => b.date.localeCompare(a.date)), n = S.ui.feedN || 15, maxKm = Math.max(1, ...ls.map(l => l.distance || 0));
    return `<section class="c-evid" data-tour="evidence">${D.head("Bukti: 12 minggu", `<button class="v5-btn" data-act="quickLog" data-tour="log-new">${ic("plus")}Catat lari</button>`)}
      <div class="v5-split"><div class="v5-panel">${D.head("Km per hari")}${V5.heat12()}</div>
      <div class="v5-panel">${D.head("Volume mingguan", '<span class="v5-lg"><span><i class="ds-sw plan"></i>rencana</span><span><i class="ds-sw acc"></i>lari</span></span>')}${vol.some(x => x.b || x.a) ? D.bars(vol.map((x, i) => ({ v: x.b, plan: x.a, hi: i === vol.length - 1, label: i % 2 ? "" : x.l, tip: `Minggu ${x.l}: ${fmtKm(x.b)} km${x.a ? ` dari ${fmtKm(x.a)} rencana` : ""}` })), { h: 150, w: D.cw(560, window.innerWidth >= 900 ? 500 : 36), gap: 5, axis: true, unit: "km" }) : `<p class="v5-empty">Belum ada volume</p>`}</div></div>
      ${ls.length ? `<div class="v5-list" data-tour="log-list">${ls.slice(0, n).map(l => V5.runRow(l, maxKm)).join("")}</div>${ls.length > n ? `<button class="v5-btn wide" data-act="feedMore">+${ls.length - n} lagi</button>` : ""}` : `<div class="v5-emptyb">${ic("runs", "v5-tile-ic")}<span>Belum ada lari</span></div>`}</section>`;
  }
  vLog = function () {
    const { A, sessions } = assessNow(), groups = [["limitation", "Perlu diperbaiki"], ["opportunity", "Peluang"], ["strength", "Kekuatan"], ["neutral", "Stabil"], ["insufficient", "Belum cukup data"]];
    return `${storageNote()}<div class="v5 c-coach">
      <header class="v5-top"><div><p class="ds-k">8 minggu · ${A.window.from} – ${A.window.to} · ${A.n} lari</p><h1 class="v5-h">Coach</h1></div>${gear()}</header>
      ${askBlock(A)}
      ${A.n === 0 ? `<section class="c-empty" data-tour="observations"><p class="c-key-t">Coach belum punya bahan.</p><p class="c-meta">Catat jarak, waktu, dan effort (RPE 1–10) di setiap lari. Pola mulai terbaca dari 4 lari; tren pace butuh 6 lari di rentang jarak yang sama.</p><button class="v5-btn pri" data-act="quickLog">${ic("plus")}Catat lari</button>
          <details class="c-empty-d"><summary class="v5-lnk">Apa saja yang akan dinilai ${ic("chev")}</summary>${A.observations.map(o => obsRow(o, false)).join("")}</details></section>
          ${coverageBlock(A, sessions)}`
      : `<section class="c-obsl" data-tour="observations">${groups.map(([k, l]) => { const os = A.observations.filter(o => o.kind === k); return os.length ? `<h2 class="ds-k c-gh">${l}</h2>${os.map(o => obsRow(o, COACH.open[o.id])).join("")}` : ""; }).join("")}</section>
      ${coverageBlock(A, sessions)}
      ${evidenceBlock(sessions)}`}
    </div>`;
  };

  /* ---------- Plan ---------- */
  const ST = { done: ["selesai", "pos"], missed: ["tidak tercatat", "mu"], skip: ["dilewati", "mu"], today: ["hari ini", "acc"], up: ["", "mu"] };
  function weekList(w, label) {
    const d0 = parseYmd(w.start), t = todayYmd(), rows = [];
    for (let i = 0; i < 7; i++) {
      const d = ymd(addDays(d0, i)), items = itemsOnDate(d);
      rows.push(`<li class="p-day${d === t ? " now" : ""}"><span class="p-dd"><b class="num">${parseYmd(d).getDate()}</b><span>${e(HARI[parseYmd(d).getDay()].slice(0, 3))}</span></span>
        <span class="p-ss">${items.length ? items.map(s => { const st = sState(s), lg = s.type === "strength" ? null : logFor(s.id); return `<button class="p-s" data-act="openSess" data-id="${e(s.id)}" style="--c:${tc(s.type)}"><i class="v5-dot"></i><span class="p-sn">${e(TYPES[s.type] || s.title)}</span><b class="num">${s.dist ? fmtKm(lg ? lg.distance : s.dist) : ""}</b>${s.dist ? '<span class="mu">km</span>' : ""}${ST[st] && ST[st][0] ? `<span class="p-st t-${ST[st][1]}">${ST[st][0]}</span>` : ""}</button>`; }).join("") : '<span class="p-rest">Istirahat</span>'}</span></li>`);
    }
    const planKm = w.total, doneKm = sum(logsIn(w.start, w.end).filter(l => !l.sample), l => l.distance);
    return `<section class="p-week">${D.head(`${label} · W${w.n}`, `<span class="ds-k">${fmtKm(doneKm)} / ${fmtKm(planKm)} km</span>`)}${D.meter(doneKm, Math.max(planKm, doneKm, 1), { tone: "pos", mark: planKm, label: `${fmtKm(doneKm)} dari ${fmtKm(planKm)} km` })}<ul class="p-days">${rows.join("")}</ul></section>`;
  }
  function goalBlock() {
    const ev = activeEvent(), left = Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY), wi = curWeekIdx(), nW = PLANW.length;
    let P = null; try { P = racePlanData(); } catch (err) { P = null; }
    const pred = P && P.pred && P.pred.seconds && P.pred.source !== "target" ? P.pred : null, target = P ? P.target : null;
    return `<section class="p-goal" data-tour="plan-goal">
      ${D.ring(Math.min(wi + 1, nW), nW || 1, D.fig(left >= 0 ? left : "–", "", left >= 0 ? "hari lagi" : "lewat", { size: "m" }), { size: 128, stroke: 9, label: `Minggu ${wi + 1} dari ${nW}` })}
      <div class="p-goal-m"><p class="ds-k">Tujuan · ${e(fmtDay(ev.eventDate))} ${parseYmd(ev.eventDate).getFullYear()}</p><h2 class="p-goal-n">${e(ev.name)}</h2>
        <div class="v5-figs">${D.fig(fmtKm(evKm(ev)), "km", "jarak", { size: "s" })}${D.fig(target ? fmtDur(target) : "–", "", "target", { size: "s" })}${D.fig(pred ? fmtDur(pred.seconds) : "–", "", pred ? "perkiraan dari lari" : "perkiraan: belum ada", { size: "s", tone: pred ? "acc" : "mu" })}</div>
        ${["postponed", "cancelled"].includes(ev.eventStatus) ? `<p class="v5-warn">Race ini ${e(ST_EV[ev.eventStatus].toLowerCase())}. Riwayat latihanmu tetap aman; pilih race lain supaya jadwal disusun ulang.</p>` : ""}
        <div class="p-goal-a"><button class="v5-lnk" data-act="evList">Ganti tujuan</button><button class="v5-lnk" data-act="evEdit" data-id="${e(ev.id)}">Edit</button></div></div></section>`;
  }
  vRace = function () {
    const wi = curWeekIdx(), w = PLANW[wi], nx = PLANW[wi + 1];
    return `${storageNote()}<div class="v5 c-plan">
      <header class="v5-top"><div><p class="ds-k">Program ${e(PLAN_KIND())} · ${PLANW.length} minggu</p><h1 class="v5-h">Plan</h1></div>${gear()}</header>
      ${goalBlock()}
      ${w ? weekList(w, "Minggu ini") : `<p class="v5-empty">Belum ada program.</p>`}
      ${nx ? `<details class="p-next"><summary>${D.head(`Minggu depan · W${nx.n}`, `<span class="ds-k">${fmtKm(nx.total)} km rencana</span>`)}</summary>${weekList(nx, "Minggu depan")}</details>` : ""}
      <div class="p-links"><button class="v5-btn" data-act="nav" data-t="cal">${ic("cal")}Kalender</button><button class="v5-btn" data-act="nav" data-t="jadwal">${ic("gear")}Hari & jam lari</button></div>
      <p class="c-meta">Program disusun dari tujuan dan hari yang kamu pilih. Beban tidak naik otomatis hanya karena minggu lalu selesai; perubahan diusulkan dulu dengan alasannya.</p>
    </div>`;
  };
  const PLAN_KIND = () => { const k = activeEvent().distanceKm; return k >= 40 ? "marathon" : k >= 20 ? "half marathon" : k >= 9 ? "10K" : k >= 4.5 ? "5K" : "lari"; };

  /* ---------- Pengaturan (secondary) ---------- */
  const PST = { connected: ["Tersambung", "pos"], disconnected: ["Belum tersambung", "mu"], connecting: ["Menyambung…", "acc"], "permission-limited": ["Izin terbatas", "warn"], expired: ["Kedaluwarsa", "warn"], revoked: ["Dicabut", "warn"], unavailable: ["Tidak tersedia di sini", "mu"], blocked: ["Diblokir", "bad"] };
  function hcStatus() {
    let native = false; try { native = typeof INTEG !== "undefined" && INTEG.env().native; } catch (err) { native = false; }
    if (!native) return "unavailable";
    const h = typeof DEVICE !== "undefined" ? DEVICE.hc : null;
    return h === "ok" ? "connected" : h === "na" ? "unavailable" : "disconnected";
  }
  const hcPlugin = () => { try { const v = INTEG.env(); return v.native && v.plugins.Health; } catch (err) { return false; } };
  vMore = function () {
    const ps = CM.providers({ healthConnect: hcStatus() }), counts = [["Lari", S.logs.filter(l => !l.sample).length], ["Investigasi Lab (arsip)", Object.keys(S.lab || {}).length], ["Sepatu (arsip)", (S.shoes || []).length], ["Check-in (arsip)", (S.checkins || []).length], ["Latihan kekuatan", (S.strength || []).length]];
    const row = (t, k, body) => `<button class="c-set" data-act="nav" data-t="${k}">${ic(t, "c-set-ic")}<span>${body}</span>${ic("chev", "c-chev")}</button>`;
    return `<div class="v5 c-settings"><header class="v5-top"><div><h1 class="v5-h">Pengaturan</h1></div></header>
      <div data-tour="acct" class="v5-acct">${acctBox()}</div>
      <section data-tour="sources">${D.head("Sumber data")}<ul class="c-src">${ps.map(p => `<li class="c-src-r"><span class="c-src-n"><b>${e(p.name)}</b><span class="c-src-s t-${PST[p.status][1]}"><i></i>${PST[p.status][0]}</span></span><span class="c-meta">${e(p.note)}</span>${p.id === "healthconnect" && hcPlugin() ? `<button class="v5-btn" data-act="hcSync" ${INTEG.busy ? "disabled aria-busy=\"true\"" : ""}>${INTEG.busy ? "Membaca…" : "Ambil 30 hari terakhir"}</button>` : ""}</li>`).join("")}</ul>
        <p class="c-meta">Impor file GPX/FIT/TCX tidak lagi tersedia. Lari yang pernah diimpor tetap tersimpan.</p></section>
      <section>${D.head("Aplikasi")}<div class="c-sets">${row("bell", "notif", "Pengingat")}${row("gear", "settings", "Tema, profil, satuan")}${row("db", "data", "Backup & ekspor")}${row("info", "about", `Tentang · v${e((window.HMTP_BUILD && window.HMTP_BUILD.version) || "")}`)}</div></section>
      <section>${D.head("Data tersimpan")}<ul class="c-cnt">${counts.map(([l, n]) => `<li><span>${e(l)}</span><b class="num">${n}</b></li>`).join("")}</ul><p class="c-meta">Fitur yang dihapus dari tampilan tidak menghapus datanya; semua ikut sinkron dan ekspor.</p></section>
    </div>`;
  };

  /* ---------- Actions ---------- */
  function ask(q) {
    q = String(q || "").trim().slice(0, 300); if (!q) { toast("Tulis pertanyaannya dulu", "err"); return; }
    COACH.q = q; COACH.ans = CO.answer(q, assessNow().A); render(true);
    setTimeout(() => { const a = document.querySelector(".c-ans"); if (a) a.scrollIntoView({ block: "nearest" }); }, 0);
  }
  Object.assign(ACT, {
    coachAsk: () => { const el = document.getElementById("coach-q"); ask(el ? el.value : ""); },
    coachQ: d => ask(d.q),
    coachObs: d => { COACH.open = { [d.id]: true }; S.ui.tab = "log"; M = null; render(false); setTimeout(() => { const el = document.querySelector(`[data-obs="${d.id}"]`); if (el) el.scrollIntoView({ block: "center" }); }, 0); }
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target && ev.target.id === "coach-q") { ev.preventDefault(); ACT.coachAsk(); } });
  document.addEventListener("toggle", ev => { const d = ev.target; if (d && d.matches && d.matches("details.c-obs")) COACH.open[d.dataset.obs] = d.open; }, true);
  window.__coach = { COACH, assessNow };
})();
