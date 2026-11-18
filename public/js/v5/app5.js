/* RUNLAB v5: WeRunIt and RUNLAB merged into one visual-first app.
 * Four tabs: Hari ini · Lari · Lab · Kamu. Kept: run log + import, Lab, race plan + countdown, weekly schedule, shoes,
 * weather + reminders, account/sync/backup. Removed from the UI (stored data untouched, still synced and exported):
 * daily check-in and the Siap/Beban scores, strength, elevation, locked-in pages, friends, the Kiki companion and tutorials,
 * monthly review and the pace calculator. Loaded after every older view module and before startApp().
 * Visual rule: numbers and shapes carry meaning; labels are short; nothing is drawn from an assumed value.
 */
(function () {
  "use strict";
  const D = WRI_DS, ic = D.ic, esc5 = D.esc;

  /* ---------- Navigation ---------- */
  IC.v5home = ic("home", "ico"); IC.v5runs = ic("runs", "ico"); IC.v5lab = ic("lab", "ico"); IC.v5me = ic("me", "ico");
  NAV_MAIN.splice(0, NAV_MAIN.length, ["home", "Hari ini"], ["log", "Lari"], ["lab", "Lab"], ["more", "Kamu"]);
  Object.keys(DOCK_ICON).forEach(k => delete DOCK_ICON[k]);
  Object.assign(DOCK_ICON, { home: "v5home", log: "v5runs", lab: "v5lab", more: "v5me" });
  Object.keys(DOCK_GROUP).forEach(k => delete DOCK_GROUP[k]);
  Object.assign(DOCK_GROUP, { home: "home", cal: "home", log: "log", lab: "lab" });   // race, jadwal, shoes… live in Kamu
  NAV_MORE.splice(0, NAV_MORE.length, ["more", "Kamu"]);   // desktop rail shows the four tabs only; everything else lives in Kamu
  const KEPT = ["home", "log", "lab", "more", "race", "cal", "jadwal", "shoes", "notif", "settings", "integ", "data", "about"];
  const DROPPED = ["bareng", "locked", "elev", "strength", "recovery", "goals", "guide", "kamus", "tutorials", "review", "pace", "score"];

  // Dropped pages render Hari ini (old deep links and synced ui.tab values land somewhere useful).
  vBareng = vLocked = vElev = vStrength = vRecovery = vGoals = vGuide = vKamus = vTutorials = vReview = vPace = () => vHome();
  const _nav = ACT.nav;
  ACT.nav = d => { if (DROPPED.includes(d.t)) d = Object.assign({}, d, { t: "home" }); return _nav(d); };
  // Tutorials and the companion are gone: never auto-start, clear a half-finished tour.
  if (S.ui && S.ui.tut) S.ui.tut = null;
  mascot = () => "";   // no companion character anywhere (ask flows keep working without it)
  if (S.ui && DROPPED.includes(S.ui.tab)) S.ui.tab = "home";

  /* ---------- Shared bits ---------- */
  const real = () => S.logs.filter(l => !l.sample);
  const days = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / DAY);
  const typeDot = t => `<i class="v5-dot" style="--c:${tc(t)}"></i>`;
  const MON3 = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
  function todayRun5() { return itemsOnDate(todayYmd()).find(s => s.type !== "strength") || null; }
  function nextRun5() { const t = todayYmd(); return allSessions().filter(s => s.date > t && s.type !== "strength" && !["done", "skip"].includes(sState(s))).sort((a, b) => a.date.localeCompare(b.date))[0] || null; }
  const narrow5 = () => window.innerWidth < 520;
  const tile = (act, attrs, body, cls = "") => `<button class="v5-tile${cls ? " " + cls : ""}" data-act="${act}" ${attrs}>${body}</button>`;

  /** Today's workout drawn as blocks: width = share of time, height = intensity. Durations come from the plan steps. */
  function shape(s, h = 56) {
    let steps = []; try { steps = runSteps(s) || []; } catch (e) { steps = []; }
    if (!steps.length) return `<svg class="v5-shape" viewBox="0 0 340 ${h}" aria-hidden="true"><rect x="0" y="${h * .4}" width="340" height="${h * .6}" rx="5" class="k-run"/></svg>`;
    const W = 340, gap = 3, est = st => st.d || (st.k === "run" ? Math.max(900, (s.dist || 5) * 400) : st.k === "work" ? 1200 : 600);
    const H = { warm: .36, cool: .36, rest: .26, run: .62, work: 1 }, tot = steps.reduce((a, st) => a + est(st), 0);
    let x = 0, out = "";
    steps.forEach(st => { const w = Math.max(4, (W - gap * (steps.length - 1)) * est(st) / tot), hh = Math.round((H[st.k] || .5) * h); out += `<rect x="${x.toFixed(1)}" y="${h - hh}" width="${w.toFixed(1)}" height="${hh}" rx="4" class="k-${st.k}"/>`; x += w + gap; });
    return `<svg class="v5-shape" viewBox="0 0 ${W} ${h}" role="img" aria-label="Bentuk latihan: ${esc5(steps.map(st => st.l).join(", "))}">${out}</svg>`;
  }

  /* ---------- Hari ini ---------- */
  function raceChip() {
    const ev = activeEvent(), left = Math.max(0, days(todayYmd(), ev.eventDate)), total = Math.max(1, days(S.settings.startDate || todayYmd(), ev.eventDate));
    return `<button class="v5-race" data-act="nav" data-t="race" data-tour="race-chip" aria-label="${left} hari lagi ke ${esc5(ev.name)}">${D.ring(total - left, total, `<b class="num">${left}</b>`, { size: 64, stroke: 5, tone: "acc", label: "" })}<span class="v5-race-l"><b>hari</b><span>${esc5(ev.name)}</span></span></button>`;
  }
  function hero() {
    const s = todayRun5(), st = s ? sState(s) : null, lg = s ? logFor(s.id) : null, nx = nextRun5();
    const next = nx ? `<button class="v5-next" data-act="openSess" data-id="${esc5(nx.id)}">${typeDot(nx.type)}<span class="v5-next-d">${esc5(HARI[parseYmd(nx.date).getDay()].slice(0, 3))}</span><b class="num">${fmtKm(nx.dist)}</b><span class="mu">km · ${esc5(TYPES[nx.type])}</span>${ic("chev")}</button>` : "";
    if (!s) {
      if (!nx) return `<section class="v5-hero rest" data-tour="hero"><p class="ds-k">Hari ini</p><p class="v5-word">Istirahat</p></section>`;
      const inD = days(todayYmd(), nx.date);
      return `<section class="v5-hero rest" data-tour="hero" style="--c:${tc(nx.type)}"><p class="ds-k">Istirahat · berikutnya</p>
        <button class="v5-restnext" data-act="openSess" data-id="${esc5(nx.id)}" aria-label="Berikutnya ${esc5(fmtDay(nx.date))}, ${fmtKm(nx.dist)} km ${esc5(TYPES[nx.type])}">${D.fig(fmtKm(nx.dist), "km", `${TYPES[nx.type]} · ${fmtDay(nx.date)}`, { size: "xl" })}${D.fig(inD, "hari", "lagi", { size: "m", tone: "acc" })}</button>
        ${shape(nx)}</section>`;
    }
    if (st === "done" && lg) {
      return `<section class="v5-hero done" data-tour="hero"><p class="ds-k">${typeDot(s.type)}${esc5(TYPES[s.type])} <span class="v5-ok">${ic("check")} selesai</span></p>
        <button class="v5-big" data-act="editLog" data-id="${esc5(lg.id)}">${D.fig(fmtKm(lg.distance), "km", "", { size: "xl", tone: "pos" })}</button>
        <div class="v5-row3">${D.fig(paceOf(lg) ? fmtPace(paceOf(lg), false) : "–", "/km", "pace", { size: "s" })}${D.fig(lg.duration ? fmtDur(lg.duration) : "–", "", "waktu", { size: "s" })}${D.fig(lg.rpe || "–", "/10", "effort", { size: "s" })}</div>
        ${s.dist ? D.meter(lg.distance, Math.max(lg.distance, s.dist), { tone: "pos", mark: s.dist, label: `${fmtKm(lg.distance)} dari ${fmtKm(s.dist)} km rencana` }) : ""}${next}</section>`;
    }
    const qd = typeof quickDoneBtn === "function" ? quickDoneBtn(s, "v5-btn") : "";
    return `<section class="v5-hero" data-tour="hero" style="--c:${tc(s.type)}"><p class="ds-k">${typeDot(s.type)}${esc5(TYPES[s.type])}${s.time ? " · " + esc5(s.time) : ""}${st === "missed" ? ' · <span class="t-warn">kelewat</span>' : ""}</p>
      <button class="v5-big" data-act="openSess" data-id="${esc5(s.id)}" aria-label="${esc5(s.title)}, ${fmtKm(s.dist)} km, buka detail">${D.fig(fmtKm(s.dist), "km", "", { size: "xl" })}</button>
      ${shape(s)}
      <div class="v5-acts">${qd.replace("✓ Selesai", `${ic("check")}Selesai`)}<button class="v5-btn pri" data-act="runStart" data-id="${esc5(s.id)}">${ic("play")}Mulai</button></div>${next}</section>`;
  }
  function weekPanel() {
    const w = PLANW[curWeekIdx()], d0 = parseYmd(w.start), t = todayYmd(), ls = logsIn(w.start, w.end).filter(l => !l.sample);
    const done = sum(ls, l => l.distance), plan = w.total || 0;
    const items = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = ymd(addDays(d0, i)), km = sum(ls.filter(l => l.date === d), l => l.distance), pk = sum(itemsOnDate(d).filter(s => s.type !== "strength"), s => s.dist || 0);
      return { v: km, plan: pk, label: HARI[parseYmd(d).getDay()].slice(0, 1), hi: d === t, tone: km ? "pos" : "", tip: `${fmtDay(d)}: ${km ? fmtKm(km) + " km" : "belum ada lari"}${pk ? ` · rencana ${fmtKm(pk)} km` : ""}` };
    });
    const over = plan && done > plan;
    return `<section class="v5-week" data-tour="week">${D.head(`Minggu ini · W${w.n}`, `<button class="v5-lnk" data-act="nav" data-t="cal">Kalender ${ic("chev")}</button>`)}
      <div class="v5-week-b">${D.ring(done, plan || 1, `${D.fig(fmtKm(done), "km", plan ? `dari ${fmtKm(plan)}` : "tanpa rencana", { size: "m", tone: done && plan && done >= plan ? "pos" : "" })}`, { size: 150, stroke: 11, tone: done >= plan && plan ? "pos" : "acc", over, label: `${fmtKm(done)} dari ${fmtKm(plan)} km minggu ini` })}
      <div class="v5-week-c">${D.bars(items, { h: narrow5() ? 90 : 120, w: 300, gap: 8 })}<div class="v5-lg"><span><i class="ds-sw plan"></i>rencana</span><span><i class="ds-sw pos"></i>lari</span></div></div></div></section>`;
  }
  /** Last n calendar weeks (Mon–Sun) of real runs, with the planned total where that week is in the plan. */
  function calVolume(n = 12) {
    const t = todayYmd(), d = parseYmd(t), mon = addDays(d, -((d.getDay() + 6) % 7)), ls = real(), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const a = ymd(addDays(mon, -7 * i)), b = ymd(addDays(mon, -7 * i + 6)), pw = PLANW.find(w => w.start <= a && w.end >= a);
      out.push({ l: `${parseYmd(a).getDate()}/${parseYmd(a).getMonth() + 1}`, a: pw ? pw.total : 0, b: +sum(ls.filter(l => l.date >= a && l.date <= b), l => l.distance).toFixed(1), start: a });
    }
    return out;
  }
  function volTile() {
    const vol = calVolume(12), hi = vol.length - 1;
    if (!vol.some(x => x.b)) return "";
    return tile("nav", 'data-t="log"', `<span class="ds-k">12 minggu</span>${D.fig(fmtKm(sum(vol, x => x.b)), "km", `rata-rata ${fmtKm(sum(vol, x => x.b) / vol.length)} km/minggu`, { size: "m" })}${D.bars(vol.map((x, i) => ({ v: x.b, plan: x.a, hi: i === hi, tip: `Minggu ${x.l}: ${fmtKm(x.b)} km` })), { h: 70, w: 300, gap: 4, labels: false })}`, "wide");
  }
  function paceTile() {
    const ps = real().filter(l => l.distance >= 1 && paceOf(l)).sort((a, b) => a.date.localeCompare(b.date)).slice(-12).map(paceOf);
    if (ps.length < 3) return "";
    return tile("nav", 'data-t="lab"', `<span class="ds-k">Pace · ${ps.length} lari</span>${D.fig(fmtPace(median(ps), false), "/km", "median", { size: "m" })}${D.spark(ps, { w: 300, h: 60, invert: true, label: `Pace ${ps.length} lari terakhir, terakhir ${fmtPace(ps[ps.length - 1], false)} /km` })}<span class="v5-tile-f">↑ lebih cepat</span>`);
  }
  /** Weather panel: feels-like per hour as bars (session window highlighted), tips as short rows with the reason folded,
   *  source + age always visible. Forecast model values only; nothing filled in when the service fails. */
  function wxTile() {
    if (typeof WX === "undefined") return "";
    const l = WX.loc();
    if (!l) return `<button class="v5-tile ghost" data-act="wxLoc" data-tour="weather"><span class="ds-k">Cuaca</span>${ic("sun", "v5-tile-ic")}<span class="v5-tile-t">Atur lokasi</span></button>`;
    const d = WX.cache(); setTimeout(() => WX.load(false), 0);
    const loc = `<button class="v5-lnk" data-act="wxLoc" aria-label="Ganti lokasi cuaca">${esc5(l.name)} ${ic("chev")}</button>`;
    if (!d) return `<section class="v5-wxp wide" data-tour="weather">${D.head("Cuaca", loc)}<p class="v5-empty">${WX.busy || !WX.err ? "Mengambil prakiraan..." : esc5(WX.err)}</p>${WX.err ? `<button class="v5-btn" data-act="wxRefresh">Coba lagi</button>` : ""}${wxAttrib()}</section>`;
    const fr = WXL.freshness(d), cur = d.current, U = d.units, s = wxSession(d), mins = s ? sessMinutes(s) : 45;
    const win = s ? WXL.windowFor(d, s.date, s.time, mins) : [], sm = win.length ? WXL.summarize(win) : null;
    const tp = fr === "expired" ? [] : WXL.tips(sm, { type: s && s.type, durationMin: mins });
    const nowH = `${todayYmd()}T${pad(new Date().getHours())}:00`, hrs = d.hours.filter(h => h.time >= nowH).slice(0, 12), inWin = new Set(win.map(h => h.time));
    const fv = hrs.map(h => h.feels !== null ? h.feels : h.temp).filter(v => v !== null), lo = fv.length ? Math.min(...fv) - 2 : 0;
    const chart = fv.length >= 2 ? D.bars(hrs.map(h => { const v = h.feels !== null ? h.feels : h.temp; return { v: v === null ? 0 : Math.max(0.5, v - lo), hi: inWin.has(h.time), tone: v >= 32 ? "warn" : "", label: h.time.slice(11, 13), tip: `${h.time.slice(11, 16)}: terasa ${v === null ? "—" : Math.round(v) + "°"}${h.pop !== null ? `, hujan ${Math.round(h.pop)}%` : ""}` }; }), { h: 92, w: 340, gap: 4 }) : "";
    const lvl = { good: "pos", info: "mu", warn: "warn", bad: "bad" };
    return `<section class="v5-wxp wide" data-tour="weather">${D.head("Cuaca", loc)}
      <div class="v5-wx-top">${cur && cur.temp !== null && fr !== "expired" ? D.fig(Math.round(cur.temp), U.temp || "°C", WXL.codeText(cur.code), { size: "l", tone: cur.feels >= 32 ? "warn" : "" }) : D.fig("–", "°", "tidak ada data terkini", { size: "l", tone: "mu" })}
        <div class="v5-wx-k">${cur && cur.feels !== null && fr !== "expired" ? D.fig(Math.round(cur.feels), U.temp || "°C", "terasa", { size: "s" }) : ""}${cur && cur.rh !== null && fr !== "expired" ? D.fig(Math.round(cur.rh), "%", "lembap", { size: "s" }) : ""}${sm && sm.pop !== null ? D.fig(Math.round(sm.pop), "%", "hujan saat lari", { size: "s" }) : ""}</div></div>
      ${chart ? `<div class="v5-wx-ch">${chart}<div class="v5-lg"><span><i class="ds-sw acc"></i>${s ? `jam lari · ${esc5(s.date === todayYmd() ? "hari ini" : fmtDay(s.date))} ${esc5(s.time)}` : "tidak ada sesi dalam 3 hari"}</span><span>terasa °C, 12 jam ke depan</span></div></div>` : ""}
      ${s && !sm ? `<p class="v5-empty">Prakiraan belum mencakup jam sesi berikutnya.</p>` : ""}
      ${tp.length ? `<ul class="v5-tips">${tp.map(t => `<li class="t-${lvl[t.level]}"><details><summary><i class="v5-tipd"></i>${esc5(t.text)}</summary><p class="xs mu">Kenapa: ${esc5(t.why)}</p></details></li>`).join("")}</ul>` : ""}
      ${fr === "expired" ? `<p class="v5-warn">Data cuaca lebih dari 12 jam, tidak dipakai buat tips.</p>` : ""}
      <p class="v5-src5">Prakiraan model (bukan pengukuran) · diambil ${ageText(Date.now() - d.retrievedAt)}${fr === "stale" ? ' · <b class="t-warn">data lama</b>' : ""}${WX.busy ? " · memperbarui..." : ""}${WX.err ? ` · ${esc5(WX.err)}` : ""} · <button class="v5-lnk" data-act="wxRefresh">Perbarui</button></p>${wxAttrib()}</section>`;
  }
  function shoeTile() {
    const act = (S.shoes || []).filter(s => !s.retired);
    if (!act.length) return tile("nav", 'data-t="shoes"', `<span class="ds-k">Sepatu</span>${ic("shoe", "v5-tile-ic")}<span class="v5-tile-t">Tambah sepatu</span>`, "ghost");
    const sh = act.find(s => s.id === S.settings.defaultShoe) || act[0], st = WRI_SHOES.stats(sh, S.logs), lim = sh.limit || 700;
    return tile("nav", 'data-t="shoes"', `<span class="ds-k">Sepatu · ${esc5(sh.name)}</span>${D.fig(Math.round(st.total), "km", `dari ${lim}`, { size: "m", tone: st.pct >= 90 ? "warn" : "" })}${D.meter(st.total, lim, { tone: st.pct >= 90 ? "warn" : "acc", label: `${Math.round(st.total)} dari ${lim} km` })}`);
  }
  function labTile() {
    const invs = Object.values(S.lab || {}).filter(x => x.status !== "closed").sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (!invs.length) return tile("nav", 'data-t="lab"', `<span class="ds-k">Lab</span>${ic("lab", "v5-tile-ic")}<span class="v5-tile-t">Tanya datamu</span>`, "ghost wide");
    const inv = invs[0], n = (inv.snapshots || []).length;
    return tile("labOpen", `data-id="${esc5(inv.id)}"`, `<span class="ds-k">Lanjutkan investigasi · ${invs.length}</span><span class="v5-tile-q">${esc5(inv.questionEdited || inv.question)}</span><span class="v5-tile-f">${n ? `${ic("check")}${n} temuan` : "belum dianalisis"}</span>`, "wide lab-cont");
  }
  vHome = function () {
    return `${storageNote()}<div class="v5 v5-today">
      <header class="v5-top"><div><p class="ds-k">${esc5(fmtDay(todayYmd()))}</p><h1 class="v5-h">Hari ini</h1></div>${raceChip()}</header>
      ${hero()}
      ${weekPanel()}
      <div class="v5-tiles">${volTile()}${paceTile()}${shoeTile()}${labTile()}</div>
      ${wxTile()}
    </div>`;
  };

  /* ---------- Lari ---------- */
  const RF = [["", "Semua"], ["easy", "Easy"], ["long", "Long"], ["recovery", "Recovery"], ["race", "Race"], ["other", "Lain"]];
  function runRow(l, maxKm) {
    const d = parseYmd(l.date), p = paceOf(l);
    return `<button class="v5-run" data-act="editLog" data-id="${esc5(l.id)}" aria-label="${esc5(fmtDay(l.date))}, ${fmtKm(l.distance)} km${p ? ", " + fmtPace(p, false) + " per km" : ""}">
      <span class="v5-run-d"><b class="num">${d.getDate()}</b><span>${MON3[d.getMonth()]}</span></span>
      <span class="v5-run-m">${D.fig(fmtKm(l.distance), "km", "", { size: "s" })}<span class="v5-run-bar"><i style="width:${Math.max(4, l.distance / maxKm * 100).toFixed(1)}%;--c:${tc(l.type)}"></i></span></span>
      <span class="v5-run-p"><b class="num">${p ? fmtPace(p, false) : "–"}</b><span>/km</span></span>
      <span class="v5-run-t">${typeDot(l.type)}${l.src ? `<span class="v5-src">${esc5(l.src)}</span>` : ""}</span></button>`;
  }
  function heat12() {
    const t = todayYmd(), td = parseYmd(t), mon = addDays(td, -((td.getDay() + 6) % 7)), start = addDays(mon, -7 * 11), ls = real(), cells = [];
    for (let i = 0; i < 84; i++) { const d = ymd(addDays(start, i)), km = sum(ls.filter(l => l.date === d), l => l.distance); cells.push({ d, v: km, today: d === t, future: d > t, act: d <= t ? { a: "v5Day" } : null, tip: `${fmtDay(d)}: ${km ? fmtKm(km) + " km" : "tidak ada lari"}` }); }
    return D.heat(cells, { cell: 20, gap: 4 });
  }
  const _vLog4 = vLog;
  vLog = function () {
    const f = S.ui.f || (S.ui.f = {}), all = real(), mon = todayYmd().slice(0, 7), mLs = all.filter(l => l.date.slice(0, 7) === mon);
    const mKm = sum(mLs, l => l.distance), mT = sum(mLs, l => l.duration || 0), mP = median(mLs.filter(l => l.distance >= 1 && paceOf(l)).map(paceOf));
    let ls = [...S.logs].sort((a, b) => b.date.localeCompare(a.date));
    if (f.type) ls = ls.filter(l => (f.type === "other" ? !["easy", "long", "recovery", "race"].includes(l.type) : l.type === f.type));
    if (f.day) ls = ls.filter(l => l.date === f.day);
    const n = S.ui.feedN || 20, maxKm = Math.max(1, ...ls.map(l => l.distance));
    const vol = calVolume(12), old = _vLog4(), imp = old.match(/<details class="imp" data-tour="import">[\s\S]*?<\/details>/);
    return `${storageNote()}<div class="v5 v5-runs">
      <header class="v5-top"><div><p class="ds-k">${MON3[+mon.slice(5) - 1]} ${mon.slice(0, 4)}</p><h1 class="v5-h">Lari</h1></div><button class="v5-btn pri" data-act="quickLog" data-tour="log-new">${ic("plus")}Catat</button></header>
      <div class="v5-figs">${D.fig(fmtKm(mKm), "km", "bulan ini", { size: "l" })}${D.fig(mLs.length, "", "lari", { size: "m" })}${D.fig(mT ? fmtDur(mT) : "–", "", "waktu", { size: "m" })}${D.fig(mP ? fmtPace(mP, false) : "–", "/km", "pace median", { size: "m" })}</div>
      <div class="v5-split">
        <section class="v5-panel">${D.head("12 minggu", '<span class="v5-lg"><span><i class="ds-sw hm"></i>km per hari</span></span>')}${heat12()}</section>
        <section class="v5-panel">${D.head("Volume mingguan", '<span class="v5-lg"><span><i class="ds-sw plan"></i>rencana</span><span><i class="ds-sw acc"></i>lari</span></span>')}${vol.some(x => x.b || x.a) ? D.bars(vol.map((x, i) => ({ v: x.b, plan: x.a, hi: i === vol.length - 1, label: i % 2 ? "" : x.l, tip: `Minggu ${x.l}: ${fmtKm(x.b)} km${x.a ? ` dari ${fmtKm(x.a)} rencana` : ""}` })), { h: 150, w: D.cw(560, window.innerWidth >= 900 ? 500 : 36), gap: 5, axis: true, unit: "km" }) : `<p class="v5-empty">Belum ada volume</p>`}</section>
      </div>
      <div class="v5-filter" role="group" aria-label="Jenis lari">${RF.map(([k, l]) => `<button class="v5-chip" data-act="v5Type" data-v="${k}" aria-pressed="${(f.type || "") === k}">${k ? typeDot(k === "other" ? "easy" : k) : ""}${l}</button>`).join("")}${f.day ? `<button class="v5-chip on" data-act="v5Day" data-d="" aria-pressed="true">${esc5(fmtDay(f.day))} ×</button>` : ""}</div>
      ${ls.length ? `<div class="v5-list" data-tour="log-list">${ls.slice(0, n).map(l => runRow(l, maxKm)).join("")}</div>${ls.length > n ? `<button class="v5-btn wide" data-act="feedMore">+${ls.length - n} lagi</button>` : ""}`
        : `<div class="v5-emptyb">${ic("runs", "v5-tile-ic")}<span>${S.logs.length ? "Tidak ada yang cocok" : "Belum ada lari"}</span><button class="v5-btn pri" data-act="quickLog">${ic("plus")}Catat lari</button></div>`}
      ${imp ? imp[0].replace('<details class="imp"', '<details class="imp v5-imp"') : ""}
    </div>`;
  };

  /* ---------- Kamu ---------- */
  vMore = function () {
    const ls = real(), y = String(new Date().getFullYear()), yr = ls.filter(l => l.date.startsWith(y)), ev = activeEvent(), left = Math.max(0, days(todayYmd(), ev.eventDate));
    const act = (S.shoes || []).filter(s => !s.retired), w = PLANW[curWeekIdx()] || { sessions: [] }, runsPerWk = (w.sessions || []).filter(s => s.type !== "strength" && s.type !== "rest").length;
    const notifOn = !!(S.settings && S.settings.notif && S.settings.notif.enabled);
    const t = (k, icon, kick, body) => `<button class="v5-tile" data-act="nav" data-t="${k}">${ic(icon, "v5-tile-ic")}<span class="ds-k">${kick}</span>${body}</button>`;
    return `<div class="v5 v5-me"><header class="v5-top"><div><h1 class="v5-h">Kamu</h1></div></header>
      <div data-tour="acct" class="v5-acct">${acctBox()}</div>
      <div class="v5-figs">${D.fig(fmtKm(sum(ls, l => l.distance)), "km", "total", { size: "l" })}${D.fig(ls.length, "", "lari", { size: "m" })}${D.fig(fmtKm(sum(yr, l => l.distance)), "km", y, { size: "m" })}</div>
      <div class="v5-tiles me" data-tour="menu">
        <span data-tour="kamu-race" class="v5-cell">${t("race", "flag", "Race", D.fig(left, "hari", esc5(ev.name), { size: "m" }))}</span>
        ${t("jadwal", "cal", "Jadwal", D.fig(runsPerWk, "lari", "minggu ini", { size: "m" }))}
        ${t("shoes", "shoe", "Sepatu", D.fig(act.length, "", "aktif", { size: "m" }))}
        ${t("notif", "bell", "Pengingat", `<span class="v5-tile-t ${notifOn ? "t-pos" : "mu"}">${notifOn ? "Aktif" : "Mati"}</span>`)}
        ${t("integ", "link", "Integrasi", '<span class="v5-tile-t">Impor & sambungan</span>')}
        ${t("data", "db", "Data", '<span class="v5-tile-t">Backup & ekspor</span>')}
        ${t("settings", "gear", "Pengaturan", '<span class="v5-tile-t">Tema, profil</span>')}
        ${t("about", "info", "Tentang", `<span class="v5-tile-t">v${esc5((window.HMTP_BUILD && window.HMTP_BUILD.version) || "")}</span>`)}
      </div></div>`;
  };

  /* ---------- Account block: no mascot, short words, same actions as before ---------- */
  acctBox = function () {
    const st = CLOUD.state, u = CLOUD.user;
    const dot = st === "off" ? "" : `<p class="xs js-sync v5-acct-s">${syncLine()}</p>`;
    if (st === "off") return `<div class="acct v5-acctb"><span class="v5-av">${ic("me")}</span><div class="who"><b>Mode lokal</b><p class="xs mu">Data di perangkat ini</p></div></div>`;
    if (!u) {
      const busy = st === "init" || st === "loading" || st === "signingin";
      return `<div class="acct v5-acctb"><span class="v5-av">${ic("me")}</span><div class="who"><b>Belum masuk</b>${dot}</div>
        <button class="gbtn" data-act="signIn" ${busy ? "disabled" : ""}>${G_LOGO}${st === "signingin" ? "Masuk..." : "Masuk"}</button>
        ${CLOUD.errDetail ? `<div class="note warn v5-acct-err"><p class="sm">${esc5(errText(CLOUD.err))}</p><p class="xs mu">Detail: <code id="err-detail">${esc5(CLOUD.errDetail)}</code></p><button class="btn sm" data-act="copyErr">Salin detail</button></div>` : ""}</div>`;
    }
    const pending = SYNC ? SYNC.pendingCount() : 0;
    return `<div class="acct v5-acctb">${avatarImg(u.photoURL, u.displayName || u.email)}<div class="who"><b>${esc5(u.displayName || "Akun Google")}</b><p class="xs mu em">${esc5(u.email)}</p>${dot}</div>
      <div class="acct-actions">${SYNC ? `<button class="btn sm" data-act="syncNow">Sinkron${pending ? ` (${pending})` : ""}</button>` : st === "firstwait" ? `<button class="btn sm" data-act="retryAcct">Coba lagi</button>` : ""}<button class="btn sm ghost" data-act="askSignOut" data-v="switch">Ganti</button><button class="btn sm ghost" data-act="askSignOut">Keluar</button></div></div>`;
  };

  /* ---------- Actions ---------- */
  // Catat opens the one-screen quick log (distance stepper, time, effort bars); the Kiki question flow is gone.
  ACT.quickLog = () => {
    const t = todayYmd(), s = todayRun5(), free = s && !logFor(s.id) ? s : null;
    M = { kind: "qlog", q: { date: t, sessionId: free ? free.id : null, type: free ? free.type : "easy", km: free ? free.dist : 5, dur: "", eff: 0 } }; render(true);
  };
  // An emptied or unreadable distance is refused (the old sheet silently kept the default 5 km).
  const _qlSave = ACT.qlSave;
  ACT.qlSave = d => { const el = document.getElementById("ql-km"); if (el && !(parseFloat(String(el.value).replace(",", ".")) > 0)) { toast("Isi jarak dulu", "err"); el.focus(); return; } return _qlSave(d); };
  Object.assign(ACT, {
    v5Type: d => { S.ui.f = Object.assign({}, S.ui.f, { type: d.v || "" }); S.ui.feedN = 20; render(true); },
    v5Day: d => { S.ui.f = Object.assign({}, S.ui.f, { day: d.d || "" }); if (S.ui.tab !== "log") S.ui.tab = "log"; render(true); }
  });

  /* ---------- Shell polish after each paint: rail icons, no FAB, no help bubbles ---------- */
  const _ap5 = afterPaint;
  afterPaint = function () {
    _ap5();
    document.body.dataset.v = "5";
    const cur = dockTab(S.ui.tab);
    document.querySelectorAll(".side button[data-t]").forEach(b => { b.classList.toggle("on", b.dataset.t === cur); if (!b.querySelector(".ds-ic")) { const k = DOCK_ICON[b.dataset.t]; if (k && IC[k]) b.insertAdjacentHTML("afterbegin", IC[k].replace('class="ico"', 'class="ds-ic"')); } });
  };
  document.addEventListener("keydown", e => { const t = e.target; if ((e.key === "Enter" || e.key === " ") && t && t.matches && t.matches('g.ds-hit[data-act]')) { e.preventDefault(); t.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
  window.__v5 = { KEPT, DROPPED };
})();
