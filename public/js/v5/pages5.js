/* RUNLAB v5 phase 2: the kept secondary pages drawn with the Instrument primitives (WRI_DS).
 * Race: countdown ring over the plan, finish time on a time axis (target vs forecast with its range), the whole build as
 * plan-vs-actual bars, records as figures, then the existing strategy workspace. The load-ratio dial and the readiness
 * blob are gone with the Siap/Beban scores. Every number comes from the same functions the old page used.
 */
(function () {
  "use strict";
  const D = WRI_DS, ic = D.ic, e5 = D.esc;
  const days = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / DAY);
  const CONF = { high: ["Keyakinan tinggi", "pos"], medium: ["Keyakinan sedang", ""], low: ["Keyakinan rendah", "warn"], none: ["Belum bisa diperkirakan", "mu"] };

  /** Finish times on one axis: target (outline), forecast (orange dot) and its sensitivity range (band). */
  function timeAxis(target, pred) {
    const pts = [target, pred && pred.seconds, pred && pred.sensitivity && pred.sensitivity.low, pred && pred.sensitivity && pred.sensitivity.high].filter(v => v > 0);
    if (!pts.length) return "";
    const lo0 = Math.min(...pts), hi0 = Math.max(...pts), pad = Math.max(120, (hi0 - lo0) * .25), lo = lo0 - pad, hi = hi0 + pad, W = D.cw(640, window.innerWidth >= 760 ? 300 : 36), H = 64, X = v => 12 + (W - 24) * (v - lo) / (hi - lo);
    let g = `<line x1="12" x2="${W - 12}" y1="34" y2="34" class="ds-grid"/>`;
    const step = [60, 120, 300, 600, 900, 1800].find(s => (hi - lo) / s <= (W < 420 ? 3 : 6)) || 1800;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="30" y2="38" class="ds-grid"/><text x="${X(v).toFixed(1)}" y="58" class="ds-ax" text-anchor="middle">${fmtDur(v)}</text>`;
    const s = pred && pred.sensitivity;
    if (s && s.low && s.high) g += `<rect x="${X(s.low).toFixed(1)}" y="27" width="${Math.max(2, X(s.high) - X(s.low)).toFixed(1)}" height="14" rx="7" class="p5-band"><title>Rentang ${fmtDur(s.low)}–${fmtDur(s.high)}</title></rect>`;
    if (target) g += `<circle cx="${X(target).toFixed(1)}" cy="34" r="8" class="p5-tgt"><title>Target ${fmtDur(target)}</title></circle><text x="${X(target).toFixed(1)}" y="16" class="ds-ax hi" text-anchor="middle">target</text>`;
    if (pred && pred.seconds) g += `<circle cx="${X(pred.seconds).toFixed(1)}" cy="34" r="7" class="p5-pred"><title>Perkiraan ${fmtDur(pred.seconds)}</title></circle><text x="${X(pred.seconds).toFixed(1)}" y="${target && Math.abs(X(target) - X(pred.seconds)) < 50 ? 8 : 16}" class="ds-ax p5-predl" text-anchor="middle">perkiraan</text>`;
    return `<svg class="p5-axis" viewBox="0 0 ${W} ${H}" role="img" aria-label="Waktu finish${target ? ", target " + fmtDur(target) : ""}${pred && pred.seconds ? ", perkiraan " + fmtDur(pred.seconds) : ""}">${g}</svg>`;
  }

  function raceHub() {
    const ev = activeEvent(), left = days(todayYmd(), ev.eventDate), wi = curWeekIdx(), nW = PLANW.length;
    let P = null; try { P = racePlanData(); } catch (err) { P = null; }
    const target = P ? P.target : null, predRaw = P ? P.pred : null, pred = predRaw && predRaw.seconds && predRaw.source !== "target" ? predRaw : null;
    const real = S.logs.filter(l => !l.sample), toDate = PLANW.slice(0, wi + 1);
    const planKm = sum(toDate, w => w.total), doneKm = sum(toDate, w => sum(logsIn(w.start, w.end).filter(l => !l.sample), l => l.distance));
    const longest = real.length ? Math.max(...real.map(l => l.distance)) : 0, paces = real.filter(l => l.distance >= 1 && paceOf(l)).map(paceOf), best = paces.length ? Math.min(...paces) : null;
    const bst = badgeStats(), bad = ["postponed", "cancelled"].includes(ev.eventStatus), cf = CONF[(predRaw && predRaw.confidence) || "none"] || CONF.none;
    const build = PLANW.map((w, i) => { const km = i <= wi ? +sum(logsIn(w.start, w.end).filter(l => !l.sample), l => l.distance).toFixed(1) : 0; return { v: km, plan: w.total, hi: i === wi, tone: i < wi && km >= w.total * .9 ? "pos" : "", label: i % 4 === 0 || i === nW - 1 ? "W" + w.n : "", tip: `W${w.n}${i === wi ? " (minggu ini)" : ""}: ${i <= wi ? fmtKm(km) + " km dari " : "rencana "}${fmtKm(w.total)} km` }; });
    return `<div class="v5 v5-race5">
      <header class="v5-top"><div><p class="ds-k">${e5(fmtDay(ev.eventDate))} ${parseYmd(ev.eventDate).getFullYear()} · ${fmtKm(evKm(ev))} km${ev.location ? " · " + e5(ev.location) : ""}</p><h1 class="v5-h">${e5(ev.name)}</h1></div>
        <div class="p5-acts"><button class="v5-btn" data-act="evList">${ic("flag")}Ganti</button><button class="v5-btn" data-act="evEdit" data-id="${e5(ev.id)}">Edit</button><button class="v5-btn" data-act="raceSheet">Race day</button></div></header>
      ${bad ? `<p class="v5-warn">Race ini ${e5(ST_EV[ev.eventStatus].toLowerCase())}. Riwayat latihanmu tetap aman; pilih race lain supaya jadwal disusun ulang.</p>` : ""}
      <div class="p5-hero">
        ${D.ring(Math.min(wi + 1, nW), nW || 1, D.fig(left >= 0 ? left : "–", "", left >= 0 ? "hari lagi" : "tanggal lewat", { size: "l" }), { size: 196, stroke: 12, label: `Minggu ${wi + 1} dari ${nW}, ${left} hari lagi` })}
        <section class="p5-finish" data-tour="race-finish">${D.head("Waktu finish", `<span class="ds-k t-${cf[1] || "mu"}">${e5(cf[0])}</span>`)}
          <div class="v5-figs">${D.fig(target ? fmtDur(target) : "–", "", "target", { size: "m" })}${D.fig(pred ? fmtDur(pred.seconds) : "–", "", pred ? `perkiraan · ${fmtPace(pred.seconds / P.D, false)}/km` : "perkiraan: butuh hasil lari", { size: "m", tone: pred ? "acc" : "mu" })}</div>
          ${timeAxis(target, pred)}
          <p class="v5-src5">Perkiraan dari lari yang tercatat, bukan dari target. Rincian di tab Ringkasan.</p></section>
      </div>
      <section class="v5-panel">${D.head(`Persiapan · W${wi + 1}/${nW}`, `<span class="v5-lg"><span><i class="ds-sw plan"></i>rencana</span><span><i class="ds-sw pos"></i>≥90% tercapai</span><span><i class="ds-sw acc"></i>minggu ini</span></span>`)}
        <div class="v5-figs">${D.fig(fmtKm(doneKm), "km", `dari ${fmtKm(planKm)} km rencana sampai minggu ini`, { size: "m" })}</div>
        ${D.meter(doneKm, Math.max(planKm, doneKm, 1), { tone: "pos", mark: planKm, label: `${fmtKm(doneKm)} dari ${fmtKm(planKm)} km` })}
        ${D.bars(build, { h: 150, w: D.cw(1040), gap: window.innerWidth < 520 ? 2 : 3, axis: true, unit: "km" })}</section>
      <section>${D.head("Rekor")}<div class="v5-figs">${D.fig(fmtKm(longest), "km", "terjauh", { size: "m" })}${D.fig(best ? fmtPace(best, false) : "–", "/km", "pace terbaik", { size: "m" })}${D.fig(fmtKm(bst.total), "km", "total", { size: "m" })}${D.fig(bst.streak, "mgg", "streak", { size: "m" })}</div></section>
      <h2 class="ds-k p5-sec">Strategi race</h2>
    </div>`;
  }
  // The overview tab used to print the target as a big "Perkiraan finish" when no forecast existed. A target is not a forecast.
  const _tabOverview = tabOverview;
  tabOverview = function (P) {
    if (P && P.pred && P.pred.source === "target") P = Object.assign({}, P, { pred: Object.assign({}, P.pred, { seconds: null, sensitivity: null, source: "none" }) });
    return _tabOverview(P);
  };

  /* ---------- Sepatu: each shoe is a wear ring; rotation is one stacked bar ---------- */
  const SHOE_COL = ["var(--acc)", "var(--pos)", "var(--c-easy)", "var(--warn)", "var(--c-elevation)", "var(--mu)"];
  function shoeRow(x) {
    const st = WRI_SHOES.stats(x, S.logs), lim = x.limit || 700, warn = st.pct >= 90 && !x.retired, meta = [x.brand, x.model].filter(Boolean).join(" "), def = S.settings.defaultShoe === x.id;
    return `<article class="p5-shoe${x.retired ? " ret" : ""}">
      ${D.ring(st.total, lim, `<b class="num">${st.pct}<small>%</small></b>`, { size: 84, stroke: 7, tone: warn ? "warn" : x.retired ? "pos" : "acc", label: `${Math.round(st.total)} dari ${lim} km` })}
      <div class="p5-shoe-m"><p class="p5-shoe-n">${e5(x.name)}${def ? ' <span class="p5-tag">default</span>' : ""}${x.retired ? ' <span class="p5-tag">pensiun</span>' : ""}</p>
        ${meta || x.use ? `<p class="xs mu">${e5([meta, x.use ? WRI_SHOES.USES[x.use] : ""].filter(Boolean).join(" · "))}</p>` : ""}
        <div class="v5-figs">${D.fig(fmtKm(st.total), "km", `dari ${lim}`, { size: "s", tone: warn ? "warn" : "" })}${D.fig(st.runs, "", "lari", { size: "s" })}${D.fig(st.lastUsed ? `${parseYmd(st.lastUsed).getDate()} ${BULAN[parseYmd(st.lastUsed).getMonth()].slice(0, 3)}` : "–", "", "terakhir dipakai", { size: "s" })}</div>
        ${st.initial ? `<p class="xs mu">${fmtKm(st.initial)} km awal (manual) + ${fmtKm(st.tracked)} km tercatat</p>` : ""}
        ${warn ? `<p class="v5-warn">Dekat batas km. Cek sol dan rasa di kaki.</p>` : ""}
        <div class="p5-shoe-a"><button class="v5-lnk" data-act="shoeEdit" data-id="${e5(x.id)}">Edit</button>${!def && !x.retired ? `<button class="v5-lnk" data-act="shoeDefault" data-id="${e5(x.id)}">Jadikan default</button>` : ""}<button class="v5-lnk" data-act="shoeRetire" data-id="${e5(x.id)}">${x.retired ? "Pakai lagi" : "Pensiunkan"}</button></div></div></article>`;
  }
  vShoes = function () {
    const tab = S.ui.shoeTab || "mine", act = S.shoes.filter(x => !x.retired), ret = S.shoes.filter(x => x.retired), noShoe = S.logs.filter(l => !l.shoeId && !l.sample).length, t = todayYmd();
    const tabs = segPill("shoetab", [["mine", "Sepatuku"], ["catalog", "Rekomendasi"], ["rotation", "Rotasi"]], tab, "shoeTab");
    let body = "";
    if (tab === "mine") body = `${act.length ? `<div class="p5-shoes" data-tour="shoe-list">${act.map(shoeRow).join("")}</div>` : `<div class="v5-emptyb">${ic("shoe", "v5-tile-ic")}<span>Belum ada sepatu</span></div>`}
      ${ret.length ? `${D.head("Pensiun")}<div class="p5-shoes">${ret.map(shoeRow).join("")}</div>` : ""}
      ${noShoe && S.shoes.length ? `<p class="v5-src5">${noShoe} lari belum ada sepatunya · <button class="v5-lnk" data-act="shoeAssign">Pasang ke sepatu default</button></p>` : ""}`;
    else if (tab === "rotation") {
      const next = allSessions().filter(s => s.date >= t && !["done", "skip"].includes(sState(s))).sort((a, b) => a.date.localeCompare(b.date))[0];
      const sug = next ? WRI_SHOES.suggest(S.shoes, S.logs, next.type) : null, rot = WRI_SHOES.rotation(S.shoes, S.logs, t);
      const seg = rot.share.map((r, i) => { const x = S.shoes.find(s => s.id === r.id); return { name: x ? x.name : "?", km: r.km, pct: r.pct, c: SHOE_COL[i % SHOE_COL.length] }; });
      body = `<section class="v5-panel p5-rot">${D.head("Sesi berikutnya")}${next ? `<div class="v5-figs">${D.fig(next.dist ? fmtKm(next.dist) : "–", "km", `${TYPES[next.type]} · ${fmtDay(next.date)}`, { size: "m" })}${sug ? `<div class="ds-fig m"><span class="ds-v p5-sug">${e5(sug.shoe.name)}</span><span class="ds-l">saran sepatu</span></div>` : ""}</div>${sug ? `<p class="v5-src5">Kenapa: ${e5(sug.reason)}.</p>` : `<p class="v5-empty">${act.length ? "Belum ada sepatu yang cocok" : "Tambah sepatu dulu"}</p>`}` : `<p class="v5-empty">Tidak ada sesi terjadwal</p>`}</section>
        <section class="v5-panel p5-rot">${D.head(`${rot.days} hari terakhir`, `<span class="ds-k">${rot.runs} lari</span>`)}
          ${seg.length ? `<div class="p5-stack" role="img" aria-label="${e5(seg.map(x => `${x.name} ${x.pct}%`).join(", "))}">${seg.map(x => `<i style="flex:${Math.max(x.pct, 1)};background:${x.c}" title="${e5(x.name)}: ${fmtKm(x.km)} km"></i>`).join("")}</div>
          <ul class="p5-leg">${seg.map(x => `<li><i style="background:${x.c}"></i><span>${e5(x.name)}</span><b class="num">${x.pct}%</b><span class="mu">${fmtKm(x.km)} km</span></li>`).join("")}</ul>` : `<p class="v5-empty">Belum ada lari dengan sepatu di ${rot.days} hari terakhir.</p>`}
          ${rot.unassignedKm ? `<p class="v5-src5">${fmtKm(rot.unassignedKm)} km tanpa sepatu tidak dihitung.</p>` : ""}
          <p class="v5-src5">Saran dari jenis sesi, kegunaan yang kamu isi, dan km tiap sepatu. Bukan aturan.</p></section>`;
    } else body = shoeCatalog();
    return `<div class="v5 v5-shoes5"><header class="v5-top"><div><button class="v5-lnk p5-back" data-act="nav" data-t="more">‹ Kamu</button><h1 class="v5-h">Sepatu</h1></div><button class="v5-btn pri" data-act="askStart" data-f="shoe" data-tour="shoe-add">${ic("plus")}Tambah</button></header>${tabs}${body}</div>`;
  };
  vRace = function () {
    const P = racePlanData(), T = raceTabs();
    const body = { overview: tabOverview, pace: tabPace, splits: tabSplits, elev: tabElev, hydration: tabHydration, fuel: tabFuel, hr: tabHr, stations: tabStations, checklist: () => raceChecklist() }[T.cur](P);
    return `${raceHub()}<div data-tour="race-tabs" class="p5-tabs">${T.html}</div><div class="p5-body" data-tour="race-body">${body}</div>`;
  };
})();
