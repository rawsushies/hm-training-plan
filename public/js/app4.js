/* WeRunIt 4.0: the quick app.
 * Four tabs (Hari ini, Lari, Race, Kamu) plus one orange record button. Data, sync, accounts and every older
 * feature stay as they are; this module only replaces what the runner sees first and how fast they get through it.
 *  - Hari ini: today's workout drawn as a shape, ✓ Selesai / ▶ Mulai, one-tap body check, the week as dots.
 *  - Lari: a feed of run cards (big numbers + shapes: distance vs plan, effort cells), quick log, filters/import folded.
 *  - Race: countdown + route, prediction vs target, volume, consistency, records as medals, then the race workspace.
 *  - Kamu: profile numbers and one clean list of everything else.
 * Loaded after the other view modules and before startApp(), so it can reshape the dock before it is built.
 */
(function () {
  "use strict";

  /* ---------- Navigation: four tabs, sub-pages light their parent ---------- */
  NAV_MAIN.splice(0, NAV_MAIN.length, ["home", "Hari ini"], ["log", "Lari"], ["race", "Race"], ["more", "Kamu"]);
  Object.keys(DOCK_ICON).forEach(k => delete DOCK_ICON[k]);
  Object.assign(DOCK_ICON, { home: "home", log: "act", race: "race", more: "more" });
  Object.keys(DOCK_GROUP).forEach(k => delete DOCK_GROUP[k]);
  Object.assign(DOCK_GROUP, {
    home: "home", cal: "home", jadwal: "home", locked: "home", elev: "home", strength: "home", recovery: "home",
    log: "log", review: "log", integ: "log",
    race: "race", pace: "race", goals: "race", score: "home"
  });

  const SVGNS = 'xmlns="http://www.w3.org/2000/svg"';
  const plural = (n, a) => `${n} ${a}`;
  const relDay = d => { const t = todayYmd(), y = ymd(addDays(new Date(), -1)); return d === t ? "Hari ini" : d === y ? "Kemarin" : fmtDay(d); };

  /* ---------- Shapes that carry data ---------- */
  /** Today's workout as an effort profile: one block per step, width = time, height = intensity. */
  function workoutShape(s, h = 64) {
    const steps = runSteps(s), W = 340, gap = 3;
    const est = st => st.d || (st.k === "run" ? Math.max(900, (s.dist || 5) * 400) : st.k === "work" ? 1200 : 600);
    const H = { warm: .38, cool: .38, rest: .3, run: .62, work: .95 };
    const tot = steps.reduce((a, st) => a + est(st), 0);
    let x = 0, out = "";
    steps.forEach(st => {
      const w = Math.max(4, (W - gap * (steps.length - 1)) * est(st) / tot), hh = Math.round((H[st.k] || .5) * h);
      const fill = st.k === "work" ? "var(--acc)" : st.k === "run" ? "var(--tx)" : "var(--mu2)";
      out += `<rect x="${x.toFixed(1)}" y="${h - hh}" width="${w.toFixed(1)}" height="${hh}" rx="4" fill="${fill}"/>`;
      x += w + gap;
    });
    const label = steps.map(st => st.l).join(", ");
    return `<svg class="wshape" viewBox="0 0 ${W} ${h}" ${SVGNS} role="img" aria-label="Bentuk latihan: ${esc(label)}">${out}</svg>`;
  }
  /** Distance against the plan: a bar with a tick where the plan ends. */
  function vsPlan(actual, plan) {
    if (!plan) return "";
    const max = Math.max(actual, plan), a = actual / max * 100, p = plan / max * 100;
    return `<span class="vsplan" role="img" aria-label="${fmtKm(actual)} dari ${fmtKm(plan)} km rencana"><i style="width:${a.toFixed(1)}%"></i><b style="left:${p.toFixed(1)}%"></b></span>`;
  }
  /** Effort (RPE 1–10) as ten cells. */
  function effortCells(rpe) {
    if (!rpe) return "";
    return `<span class="effort" role="img" aria-label="Effort ${rpe} dari 10">${Array.from({ length: 10 }, (_, i) => `<i class="${i < rpe ? (rpe >= 8 ? "hi" : "on") : ""}"></i>`).join("")}</span>`;
  }
  /** A battery: n of 4 bars, or a cross for pain. */
  function battery(n, cross) {
    const bars = cross ? `<path d="M9 9l10 8M19 9L9 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>` :
      Array.from({ length: 4 }, (_, i) => `<rect x="${5 + i * 5}" y="7" width="3.4" height="12" rx="1" fill="${i < n ? "currentColor" : "none"}" stroke="currentColor" stroke-width="${i < n ? 0 : 1}" opacity="${i < n ? 1 : .35}"/>`).join("");
    return `<svg viewBox="0 0 30 26" width="34" height="30" ${SVGNS} aria-hidden="true"><rect x="2" y="4" width="24" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="26.5" y="10" width="2.5" height="6" rx="1" fill="currentColor"/>${bars}</svg>`;
  }
  /** A medal with a figure on it. */
  function medal(fig, unit, label, on) {
    return `<div class="medal${on ? " on" : ""}"><svg viewBox="0 0 60 72" ${SVGNS} aria-hidden="true"><path d="M18 2h10l6 20H24zM42 2H32l-6 20h10z" fill="${on ? "var(--acc)" : "var(--s2)"}"/><circle cx="30" cy="46" r="22" fill="var(--s2)" stroke="${on ? "var(--acc)" : "var(--line2)"}" stroke-width="2.5"/></svg><b class="num">${fig}</b><span class="mu">${unit}</span><em>${label}</em></div>`;
  }

  /* ---------- One-tap body check (maps to the existing 6-field check-in) ---------- */
  const BODY = [
    { k: "segar", l: "Segar", n: 4, c: { sleep: 5, soreness: 1, fatigue: 1, energy: 5, motivation: 5, pain: 1 } },
    { k: "oke", l: "Oke", n: 3, c: { sleep: 4, soreness: 2, fatigue: 2, energy: 4, motivation: 4, pain: 1 } },
    { k: "capek", l: "Capek", n: 1, c: { sleep: 3, soreness: 3, fatigue: 4, energy: 2, motivation: 3, pain: 1 } },
    { k: "nyeri", l: "Nyeri", n: 0, x: true, c: { sleep: 3, soreness: 4, fatigue: 3, energy: 3, motivation: 3, pain: 4 } }
  ];
  function bodyLevel(c) {
    if (!c) return null;
    if (c.pain >= 4) return "nyeri";
    const r = readiness(c);
    return r.st === "rest" ? "nyeri" : r.st === "easy" ? "capek" : r.v >= 4.5 ? "segar" : "oke";
  }
  function bodyCheck() {
    const t = todayYmd(), c = S.checkins.find(x => x.date === t && !x.sample), lv = bodyLevel(c);
    const ch = c && G4.WRI_SCORES ? G4.WRI_SCORES.charge(scoreCtx()) : null, st = ch && ch.score !== null ? { green: "ready", yellow: "easy", red: "rest" }[ch.band] : null;
    return `<section class="a4-card a4-body" data-tour="body"><div class="a4-row"><h2>Badan hari ini</h2>${st ? `<span class="a4-st st-${st}">Siap ${ch.score}% · ${BANDW[ch.band]}</span>` : ""}</div>
      <div class="a4-batt" role="group" aria-label="Gimana badan hari ini">${BODY.map(b => `<button class="${lv === b.k ? "on" : ""} b-${b.k}" data-act="ciQuick" data-k="${b.k}" aria-pressed="${lv === b.k}">${battery(b.n, b.x)}<span>${b.l}</span></button>`).join("")}</div></section>`;
  }

  /* ---------- Hari ini ---------- */
  function todayRun() { return itemsOnDate(todayYmd()).find(s => s.type !== "strength") || null; }
  function nextAfterToday() { const t = todayYmd(); return allSessions().filter(s => s.date > t && !["done", "skip"].includes(sState(s))).sort((a, b) => a.date.localeCompare(b.date))[0] || null; }
  function heroCard() {
    const s = todayRun(), st = s ? sState(s) : null, lg = s ? logFor(s.id) : null, w = PLANW[curWeekIdx()];
    const strength = itemsOnDate(todayYmd()).find(x => x.type === "strength");
    if (!s) {
      return `<section class="a4-hero" data-tour="hero"><p class="a4-kicker">Week ${w.n} · ${esc(KIND_LBL[w.kind])}</p>
        <div class="a4-big"><span class="num word">Istirahat</span></div>
        <svg class="wshape" viewBox="0 0 340 64" ${SVGNS} aria-hidden="true"><rect x="0" y="58" width="340" height="6" rx="3" fill="var(--line2)"/></svg>
        ${strength ? `<button class="a4-chip" data-act="openSess" data-id="${strength.id}"><i style="--c:${tc("strength")}"></i>${esc(strength.title)}</button>` : ""}
</section>`;
    }
    if (st === "done" && lg) {
      return `<section class="a4-hero done" data-tour="hero"><p class="a4-kicker"><i class="dot" style="--c:${tc(s.type)}"></i>${esc(TYPES[s.type])} · Week ${s.n}</p>
        <div class="a4-big"><span class="num">${fmtKm(lg.distance)}</span><span class="u">km</span><span class="a4-tick" aria-label="Selesai">${IC.check}</span></div>
        <div class="a4-stats"><div><b class="num">${paceOf(lg) ? fmtPace(paceOf(lg), false) : "–"}</b><span>pace</span></div><div><b class="num">${lg.duration ? fmtDur(lg.duration) : "–"}</b><span>waktu</span></div><div><b class="num">${lg.rpe || "–"}</b><span>effort</span></div></div>
        ${vsPlan(lg.distance, s.dist)}
        <div class="btns a4-btns"><button class="btn" data-act="editLog" data-id="${lg.id}">Detail</button></div></section>`;
    }
    const qd = typeof quickDoneBtn === "function" ? quickDoneBtn(s, "btn a4-done") : "";
    return `<section class="a4-hero" data-tour="hero"><p class="a4-kicker"><i class="dot" style="--c:${tc(s.type)}"></i>${esc(TYPES[s.type])} · ${s.night ? "malam" : s.time ? esc(s.time) : "hari ini"}${st === "missed" ? " · kelewat" : ""}</p>
      <button class="a4-big a4-link" data-act="openSess" data-id="${s.id}" aria-label="${esc(s.title)}, ${fmtKm(s.dist)} km, buka detail"><span class="num">${fmtKm(s.dist)}</span><span class="u">km</span></button>
      ${workoutShape(s)}
      <div class="btns a4-btns">${qd}<button class="btn pri" data-act="runStart" data-id="${s.id}" data-tour="timer-btn">${IC.play} Mulai</button></div></section>`;
  }
  function weekBlock() {
    const w = PLANW[curWeekIdx()], done = sum(logsIn(w.start, w.end), l => l.distance);
    const html = homeWeek(w, done, todayYmd() < PLANW[0].start);
    return html.replace('<section class="sec" data-tour="week">', '<section class="a4-card a4-week" data-tour="week">')
      .replace(/<div class="sec-h"><h2>Week (\d+)/, '<div class="sec-h"><h2>Minggu ini <span class="mu">· W$1</span>');
  }
  function nextCard() {
    const s = todayRun(), n = s && sState(s) !== "done" ? nextAfterToday() : nextAfterToday();
    if (!n) return "";
    return `<button class="a4-card a4-next" data-tour="next" data-act="openSess" data-id="${n.id}"><span class="a4-kicker">Berikutnya · ${fmtDay(n.date)}</span>
      <span class="a4-next-r"><span><b>${esc(TYPES[n.type])}</b><br><span class="mu sm">${esc(n.title)}</span></span><span class="num a4-next-km">${fmtKm(n.dist)}<small> km</small></span></span>${workoutShape(n, 28)}</button>`;
  }
  /* ---------- Daily scores: Siap / Beban / Tidur (js/scores.js) as liquid vessels (js/vessel.js) ---------- */
  const SC = () => G4.WRI_SCORES;
  const G4 = typeof globalThis !== "undefined" ? globalThis : window;
  const COL = { green: "#2fd47a", yellow: "#f5c242", red: "#ff5a5f", none: "#5a5a60", beban: "#3aa0ff", tidur: "#8f86ff" };
  const TIER = { solid: "", building: "Data masih tipis", calibrating: "Kalibrasi" };
  const BANDW = { green: "Siap", yellow: "Sedang", red: "Pelan dulu", none: "Belum ada data" };
  function scoreCtx(date) { return { date: date || todayYmd(), checkins: S.checkins, logs: S.logs.filter(l => !l.sample), strength: S.strength.filter(r => !r.sample), hrMax: S.profile && S.profile.hrMax }; }
  function todayScores() {
    const c = scoreCtx(); if (!SC()) return null;
    const siap = SC().charge(c), beban = SC().dayEffort(c), tidur = SC().rest(c);
    return { siap, beban, tidur, target: SC().targetEffort(siap.score), ratio: siap.load.acwr };
  }
  function vessel(k, val, col, big) {
    const unit = k === "beban" ? "" : "%";
    return `<span class="vbox${big ? " big" : ""}"><canvas class="vessel" data-v="${val === null ? "" : val}" data-c="${col}"></canvas><span class="vnum"><b class="num">${val === null ? "–" : val}</b>${val === null ? "" : `<small>${unit}</small>`}</span></span>`;
  }
  function scoreTrio(sc) {
    const it = [["siap", "Siap", sc.siap.score, COL[sc.siap.band], sc.siap.tier], ["beban", "Beban", sc.beban.score, COL.beban, sc.beban.tier], ["tidur", "Tidur", sc.tidur.score, COL.tidur, sc.tidur.tier]];
    const t = sc.target, b = sc.beban.score;
    return `<section class="a4-scores" data-tour="scores">
      <div class="trio">${it.map(([k, l, v, c, tier]) => `<button class="trio-i" data-act="score" data-k="${k}" aria-label="${l} ${v === null ? "belum ada data" : v + (k === "beban" ? "" : " persen")}${TIER[tier] ? ", " + TIER[tier] : ""}">${vessel(k, v, c)}<span class="tl">${l}</span>${TIER[tier] ? `<span class="tt">${TIER[tier]}</span>` : ""}</button>`).join("")}</div>
      ${t ? `<div class="target"><span class="tk">Target beban hari ini <b class="num">${t[0]}–${t[1]}</b></span><span class="tbar" role="img" aria-label="Beban ${b} dari target ${t[0]} sampai ${t[1]}"><i class="zone" style="left:${t[0]}%;width:${t[1] - t[0]}%"></i><i class="mark" style="left:${b}%"></i></span></div>` : ""}
    </section>`;
  }
  /** Health-monitor style row: five signals, each in or out of the runner's own range. */
  function monitor(sc) {
    const t = todayYmd(), c = S.checkins.find(x => x.date === t && !x.sample);
    const rz = SC().ratioZone(sc.ratio);
    const ICO = {
      tidur: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
      energi: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
      pegal: '<path d="M7 20c0-4 2-6 2-9s-1-5 1-7M17 20c0-4-2-6-2-9s1-5-1-7M9 12h6"/>',
      nyeri: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/>',
      beban: '<path d="M3 17l5-5 4 3 6-7"/><path d="M15 8h3v3"/>'
    };
    const sig = [
      ["tidur", "Tidur", c ? c.sleep >= 3 : null],
      ["energi", "Energi", c ? c.energy >= 3 : null],
      ["pegal", "Pegal", c ? c.soreness <= 3 : null],
      ["nyeri", "Nyeri", c ? c.pain <= 2 : null],
      ["beban", "Rasio", rz === "none" ? null : rz === "sweet" || rz === "low"]
    ];
    const ok = sig.filter(x => x[2] === true).length, known = sig.filter(x => x[2] !== null).length;
    return `<section class="a4-card mon" data-tour="monitor"><button class="mon-h" data-act="score" data-k="siap"><h2 class="cap">Monitor badan</h2><span class="chev">›</span></button>
      <div class="mon-row">${sig.map(([k, l, v]) => `<div class="mon-i"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg><span class="cap">${l}</span><i class="mk ${v === null ? "na" : v ? "ok" : "bad"}" aria-label="${l}: ${v === null ? "belum ada data" : v ? "dalam rentang" : "di luar rentang"}">${v === null ? "–" : v ? IC.check : "!"}</i></div>`).join("")}</div>
      <div class="mon-f ${known && ok === known ? "all" : ""}"><i class="mk ${known && ok === known ? "ok" : known ? "bad" : "na"}">${known && ok === known ? IC.check : known ? "!" : "–"}</i>${known ? `${ok}/${known} sinyal dalam rentang` : "Check-in buat lihat sinyal badan"}</div></section>`;
  }
  /** 30-day score bars coloured by band, with the average as a dashed line (crisp, not liquid). */
  function scoreBars(series, k) {
    const W = 340, H = 150, pl = 26, pb = 18, pt = 8, n = series.length, bw = (W - pl) / n, ih = H - pt - pb;
    const vals = series.map(x => x[k]), known = vals.filter(v => v !== null), avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${k} 30 hari, rata-rata ${avg === null ? "–" : Math.round(avg)}">`;
    [0, 25, 50, 75, 100].forEach(v => { const y = pt + ih * (1 - v / 100); s += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" class="gl"/><text x="${pl - 4}" y="${y + 3}" class="ax" text-anchor="end">${v}</text>`; });
    vals.forEach((v, i) => {
      if (v === null) return;
      const col = k === "beban" ? COL.beban : k === "tidur" ? COL.tidur : COL[SC().band(v)];
      const h = Math.max(2, ih * v / 100);
      s += `<rect x="${(pl + i * bw + bw * .15).toFixed(1)}" y="${(pt + ih - h).toFixed(1)}" width="${(bw * .7).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}"${i === n - 1 ? "" : ' opacity=".85"'}/>`;
    });
    if (avg !== null) { const y = pt + ih * (1 - avg / 100); s += `<line x1="${pl}" x2="${W - 26}" y1="${y}" y2="${y}" stroke="var(--tx)" stroke-dasharray="3 3" stroke-width="1.2"/><rect x="${W - 26}" y="${y - 8}" width="26" height="16" rx="3" fill="var(--tx)"/><text x="${W - 13}" y="${y + 3.5}" font-size="9" font-weight="700" text-anchor="middle" fill="var(--bg)" font-family="Inter,system-ui,sans-serif">AVG</text>`; }
    [0, Math.floor(n / 2), n - 1].forEach((i, j) => { const d = parseYmd(series[i].date); s += `<text x="${pl + i * bw + bw / 2}" y="${H - 4}" class="ax" text-anchor="${j === 0 ? "start" : j === 2 ? "end" : "middle"}">${d.getDate()} ${BULAN[d.getMonth()]}</text>`; });
    return { svg: s + "</svg>", avg };
  }
  function vScore() {
    const k = ["siap", "beban", "tidur"].includes(S.ui.score) ? S.ui.score : "siap", sc = todayScores();
    const ser = SC().series(scoreCtx(), 30), bars = scoreBars(ser, k), cur = sc[k];
    const name = { siap: "Siap", beban: "Beban", tidur: "Tidur" }[k];
    const col = k === "siap" ? COL[cur.band] : COL[k];
    const vals = ser.map(x => x[k]).filter(v => v !== null);
    const cnt = { green: 0, yellow: 0, red: 0 }; if (k !== "beban") vals.forEach(v => cnt[SC().band(v)]++);
    let detail = "";
    if (k === "siap") {
      const d = cur.drivers || {}, L = cur.load, rz = SC().ratioZone(L.acwr);
      const row = (l, v, good) => `<div class="drv"><span>${l}</span><b class="${good === null ? "" : good ? "ok" : "bad"}">${v}</b></div>`;
      detail = `<section class="a4-card"><h2 class="cap">Pemicu</h2>
        ${row("Badan vs biasanya", "wellness" in d ? (d.wellness >= 0 ? "+" : "") + d.wellness.toFixed(1).replace(".", ",") + " σ" : "belum check-in", "wellness" in d ? d.wellness >= -0.5 : null)}
        ${row("Kesegaran (fitness − capek)", "freshness" in d ? (d.freshness >= 0 ? "segar" : "capek") + " " + (d.freshness >= 0 ? "+" : "") + d.freshness.toFixed(1).replace(".", ",") : "belum ada lari", "freshness" in d ? d.freshness >= -0.8 : null)}
        ${row("Rasio beban 7:28 hari", L.acwr === null ? "–" : L.acwr.toFixed(2).replace(".", ",") + "×", rz === "none" ? null : rz === "sweet" || rz === "low")}
        ${d.pain ? row("Nyeri", "tercatat · dibatasi merah", false) : ""}
        <p class="xs mu" style="margin-top:8px">Dibandingin sama baseline-mu sendiri (EWMA 14 hari). Pendekatan ilmiah terbuka, bukan saran medis.</p></section>`;
    } else if (k === "beban") {
      const ls = SC().dayLoads(S.logs.filter(l => !l.sample), S.strength, todayYmd(), 7, S.profile && S.profile.hrMax);
      detail = `<section class="a4-card"><h2 class="cap">7 hari terakhir</h2>${ls.map(x => `<div class="drv"><span>${fmtDay(x.date)}</span><b class="num">${SC().effort(x.load)}</b></div>`).join("")}
        <p class="xs mu" style="margin-top:8px">Beban = menit × intensitas (RPE, atau zona detak jantung kalau HR maks diisi), dalam skala log 0–100.</p></section>`;
    } else {
      const ci = S.checkins.filter(c => !c.sample).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
      detail = `<section class="a4-card"><h2 class="cap">Tidur 7 hari</h2>${ci.length ? ci.map(c => `<div class="drv"><span>${fmtDay(c.date)}</span><b>${["", "Jelek", "Kurang", "Lumayan", "Nyenyak", "Nyenyak banget"][c.sleep] || "–"}</b></div>`).join("") : `<p class="mu sm">Belum ada check-in</p>`}
        <p class="xs mu" style="margin-top:8px">Dari check-in harian (kualitas tidur), plus sedikit bobot buat konsistensi seminggu.</p></section>`;
    }
    return `<div class="a4"><div class="pagehead"><button class="back" data-act="nav" data-t="home">‹ Hari ini</button></div>
      <div class="sc-hero"><h1 class="cap">${name}</h1>${vessel(k, cur.score, col, true)}<p class="sc-w">${k === "siap" ? BANDW[cur.band] : k === "beban" ? (sc.target ? `Target hari ini ${sc.target[0]}–${sc.target[1]}` : "Hari ini") : cur.score === null ? "Belum ada data" : cur.score >= 67 ? "Cukup" : cur.score >= 34 ? "Kurang" : "Jelek"}</p>${TIER[cur.tier] ? `<span class="tt">${TIER[cur.tier]}</span>` : ""}</div>
      <section class="a4-card"><div class="sec-h"><h2 class="cap">30 hari</h2><span class="num sm">rata-rata ${bars.avg === null ? "–" : Math.round(bars.avg)}</span></div>${bars.svg}</section>
      ${k !== "beban" && vals.length ? `<section class="a4-card"><h2 class="cap">Rincian (hari)</h2><div class="brk">${["green", "yellow", "red"].map(b => cnt[b] ? `<i style="flex:${cnt[b]};background:${COL[b]}"></i>` : "").join("")}</div>
        ${[["green", "Bagus (67+)"], ["yellow", "Sedang (34–66)"], ["red", "Rendah (<34)"]].map(([b, l]) => `<div class="drv"><span><i class="sw" style="background:${COL[b]}"></i>${l}</span><b class="num">${cnt[b]}×</b></div>`).join("")}</section>` : ""}
      ${detail}</div>`;
  }
  /** Race readiness as a wavy blob (plan done + prediction inside), and the load ratio as a dial. */
  function readinessBlob(pct, predS, goal) {
    const n = 9, R = 92, amp = 9, pts = [];
    for (let i = 0; i <= 180; i++) { const a = i / 180 * Math.PI * 2, r = R + amp * Math.sin(a * n); pts.push(`${(110 + r * Math.cos(a)).toFixed(1)},${(110 + r * Math.sin(a)).toFixed(1)}`); }
    return `<div class="blob"><svg viewBox="0 0 220 220" aria-hidden="true"><polygon class="blob-p" points="${pts.join(" ")}"/></svg>
      <div class="blob-in"><span class="cap">Kesiapan race</span><b class="num">${pct}%</b><span class="mu sm">rencana tercapai</span>${predS ? `<span class="blob-pred"><b class="num">${fmtDur(predS)}</b> perkiraan${goal ? ` · target <span class="num">${fmtDur(goal)}</span>` : ""}</span>` : ""}</div></div>`;
  }
  function ratioDial(r) {
    const lo = 0.5, hi = 2.0, ang = v => Math.PI * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)), P = (v, rr) => [100 + rr * Math.cos(ang(v)), 100 - rr * Math.sin(ang(v))];
    const arc = (a, b, rr) => { const [x1, y1] = P(a, rr), [x2, y2] = P(b, rr); return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${rr} ${rr} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    const z = SC().ratioZone(r), word = { none: "Belum cukup data", low: "Di bawah biasanya", sweet: "Aman, sesuai kapasitas", high: "Naik cepat, hati-hati", danger: "Terlalu tinggi, kurangi" }[z];
    const ticks = [0.5, 0.8, 1, 1.3, 1.5, 2].map(v => { const [x1, y1] = P(v, 78), [x2, y2] = P(v, 86); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--mu2)" stroke-width="1.2"/>`; }).join("");
    const needle = r === null ? "" : (() => { const [x, y] = P(r, 70); return `<line x1="100" y1="100" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--tx)" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="var(--tx)"/>`; })();
    return `<section class="a4-card dial"><h2 class="cap">Rasio beban</h2><svg viewBox="0 0 200 112" role="img" aria-label="Rasio beban ${r === null ? "belum ada" : r.toFixed(2)}">
      <path d="${arc(lo, hi, 90)}" fill="none" stroke="var(--s2)" stroke-width="12" stroke-linecap="round"/>
      <path d="${arc(0.8, 1.3, 90)}" fill="none" stroke="${COL.green}" stroke-width="12"/>
      <path d="${arc(1.3, 1.5, 90)}" fill="none" stroke="${COL.yellow}" stroke-width="12"/>
      <path d="${arc(1.5, 2.0, 90)}" fill="none" stroke="${COL.red}" stroke-width="12" stroke-linecap="round"/>${ticks}${needle}</svg>
      <div class="dial-v"><b class="num">${r === null ? "–" : r.toFixed(2).replace(".", ",") + "×"}</b><span class="${z === "sweet" ? "ok" : z === "none" || z === "low" ? "mu" : "bad"}">${word}</span><span class="xs mu">Beban 7 hari dibanding 28 hari. Aman 0,8–1,3×</span></div></section>`;
  }

  vHome = function () {
    if (S.ui.tab === "score") return vScore();
    const ev = activeEvent(), days = Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY);
    const sc = todayScores();
    const pain = persistentPain();
    return `${storageNote()}<div class="cockpit a4">
      <div class="a4-top"><div><p class="a4-date">${fmtDay(todayYmd())}</p><h1>Hari ini</h1></div>
        <button class="a4-race" data-act="nav" data-t="race" data-tour="race-chip" aria-label="${Math.max(0, days)} hari lagi ke ${esc(ev.name)}"><b class="num">${Math.max(0, days)}</b><span>hari lagi</span></button>${helpBtn("home")}</div>
      ${pain ? `<div class="note bad">Nyeri tercatat beberapa kali. Kurangi latihan, periksa ke dokter atau fisioterapis kalau nggak membaik.</div>` : ""}
      ${sc ? scoreTrio(sc) : ""}
      ${heroCard()}
      ${bodyCheck()}
      ${sc ? monitor(sc) : ""}
      ${weekBlock()}
      ${typeof weatherCard === "function" ? weatherCard() : ""}
      ${nextCard()}
    </div>`;
  };

  /* ---------- Lari: the feed ---------- */
  function runCard(l, maxKm) {
    const s = l.sessionId ? sessById(l.sessionId) : null;
    return `<button class="a4-card a4-run" data-act="editLog" data-id="${l.id}">
      <span class="a4-run-h"><i class="dot" style="--c:${tc(l.type)}"></i><b>${esc(TYPES[l.type] || "Lari")}</b><span class="mu sm">${relDay(l.date)}${l.src ? " · " + esc(l.src) : ""}${l.sample ? " · contoh" : ""}</span></span>
      <span class="a4-stats"><span><b class="num">${fmtKm(l.distance)}</b><span>km</span></span><span><b class="num">${paceOf(l) ? fmtPace(paceOf(l), false) : "–"}</b><span>pace</span></span><span><b class="num">${l.duration ? fmtDur(l.duration) : "–"}</b><span>waktu</span></span></span>
      ${s ? vsPlan(l.distance, s.dist) : `<span class="vsplan solo"><i style="width:${Math.max(6, l.distance / maxKm * 100).toFixed(1)}%"></i></span>`}
      ${effortCells(l.rpe)}
    </button>`;
  }
  function weekSummary() {
    const w = PLANW[curWeekIdx()], d0 = parseYmd(w.start), ls = logsIn(w.start, w.end);
    const km = sum(ls, l => l.distance), time = sum(ls, l => l.duration || 0);
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const d = ymd(addDays(d0, i)); return { d, km: sum(ls.filter(l => l.date === d), l => l.distance) }; });
    const max = Math.max(1, ...days.map(x => x.km)), t = todayYmd();
    const bars = days.map((x, i) => { const h = x.km ? Math.max(6, x.km / max * 44) : 3; return `<g><rect x="${i * 48 + 10}" y="${48 - h}" width="28" height="${h}" rx="4" fill="${x.d === t ? "var(--acc)" : x.km ? "var(--tx)" : "var(--s2)"}"/><text x="${i * 48 + 24}" y="62" text-anchor="middle" font-size="10" fill="var(--mu2)" font-family="Inter,system-ui,sans-serif">${HARI[parseYmd(x.d).getDay()].slice(0, 1)}</text></g>`; }).join("");
    return `<section class="a4-card a4-sum"><div class="a4-sum-h"><div><span class="a4-kicker">Minggu ini</span><div class="a4-big sm"><span class="num">${fmtKm(km)}</span><span class="u">/ ${fmtKm(w.total)} km</span></div></div>
      <div class="a4-sum-n"><b class="num">${ls.length}</b><span>lari</span><b class="num">${time ? fmtDur(time) : "–"}</b><span>waktu</span></div></div>
      <svg viewBox="0 0 336 66" ${SVGNS} role="img" aria-label="Km per hari minggu ini">${bars}</svg></section>`;
  }
  const _vLogOld = vLog;
  vLog = function () {
    const f = S.ui.f; let ls = [...S.logs];
    if (f.month) ls = ls.filter(l => l.date.slice(0, 7) === f.month);
    if (f.type) ls = ls.filter(l => l.type === f.type);
    if (f.dist === "s") ls = ls.filter(l => l.distance < 5); else if (f.dist === "m") ls = ls.filter(l => l.distance >= 5 && l.distance <= 10); else if (f.dist === "l") ls = ls.filter(l => l.distance > 10);
    if (f.sort === "fast") ls = ls.filter(paceOf).sort((a, b) => paceOf(a) - paceOf(b));
    else if (f.sort === "far") ls.sort((a, b) => b.distance - a.distance);
    else if (f.sort === "elev") ls.sort((a, b) => (b.elev || 0) - (a.elev || 0));
    else ls.sort((a, b) => b.date.localeCompare(a.date));
    const n = S.ui.feedN || 20, maxKm = Math.max(1, ...ls.map(l => l.distance));
    // the old page supplies the filter selects and the import controls; fold them away
    const old = _vLogOld(), fil = old.match(/<div class="g2" style="margin-top:12px" data-tour="log-filter">[\s\S]*?<\/div>\s*<\/div>\s*(?=<p class="sm mu")/), imp = old.match(/<details class="imp" data-tour="import">[\s\S]*?<\/details>/);
    const filtered = !!(f.month || f.type || f.dist || (f.sort && f.sort !== "new"));
    return `${storageNote()}<div class="a4-top"><div><h1>Lari</h1></div><button class="btn pri" data-act="quickLog" data-tour="log-new">${IC.plus} Catat</button>${helpBtn("log")}</div>
      ${weekSummary()}
      <div class="a4-links"><button class="link" data-act="nav" data-t="review">Review bulanan</button><button class="link" data-act="nav" data-t="cal">Kalender</button></div>
      ${ls.length ? `<div class="a4-feed" data-tour="log-list">${ls.slice(0, n).map(l => runCard(l, maxKm)).join("")}</div>${ls.length > n ? `<button class="btn a4-more" data-act="feedMore">Tampilkan lagi (${ls.length - n})</button>` : ""}`
        : `<div class="a4-card a4-empty">${S.logs.length ? "Nggak ada lari yang cocok sama filter ini" : "Belum ada lari"}<button class="btn pri" data-act="quickLog">${IC.plus} Catat lari pertama</button></div>`}
      <details class="imp"${filtered ? " open" : ""}><summary>Filter</summary>${fil ? fil[0] : ""}</details>
      ${imp ? imp[0] : ""}`;
  };

  /* ---------- Race hub ---------- */
  function raceHub() {
    const ev = activeEvent(), days = Math.max(0, Math.round((parseYmd(ev.eventDate) - parseYmd(todayYmd())) / DAY)), wi = curWeekIdx();
    let pred = null; try { pred = racePlanData().pred; } catch (e) { pred = null; }
    const goal = parseDur(ev.targetFinish || S.settings.goalTime || "") || null;
    const toDate = PLANW.slice(0, wi + 1), planKm = sum(toDate, w => w.total), doneKm = sum(toDate, w => sum(logsIn(w.start, w.end).filter(l => !l.sample), l => l.distance));
    const pct = planKm ? Math.min(100, Math.round(doneKm / planKm * 100)) : 0, C = 2 * Math.PI * 34;
    const ls = S.logs.filter(l => !l.sample), longest = ls.length ? Math.max(...ls.map(l => l.distance)) : 0;
    const paces = ls.filter(l => l.distance >= 1 && paceOf(l)).map(paceOf), best = paces.length ? Math.min(...paces) : null;
    const bst = badgeStats(), vol = weekVolume();
    const predS = pred && pred.seconds && pred.source !== "target" ? pred.seconds : null;   // a forecast from runs, never the target echoed back
    return `<div class="a4">
      <div class="a4-top"><div><p class="a4-date">${fmtDay(ev.eventDate)} ${parseYmd(ev.eventDate).getFullYear()} · ${fmtKm(ev.distanceKm)} km</p><h1>${esc(ev.name)}</h1></div>${helpBtn("race")}</div>
      <section class="a4-card a4-rhero"><div class="a4-big"><span class="num">${days}</span><span class="u">hari lagi</span></div><div class="route">${raceRoute(wi)}</div></section>
      ${readinessBlob(pct, predS, goal)}
      ${SC() ? ratioDial(SC().charge(scoreCtx()).load.acwr) : ""}
      ${vol.some(x => x.b) ? `<section class="a4-card"><div class="sec-h"><h2>Volume mingguan</h2></div>${chartBars(vol, { h: 170, hi: vol.length - 1 })}${lgd()}</section>` : ""}
      <section class="a4-card"><h2>Rekor</h2><div class="a4-medals">${medal(fmtKm(longest), "km", "Terjauh", longest >= 10)}${medal(best ? fmtPace(best, false) : "–", "/km", "Pace terbaik", !!best)}${medal(fmtKm(bst.total), "km", "Total", bst.total >= 100)}${medal(String(bst.streak), "mgg", "Streak", bst.streak >= 2)}</div></section>
      ${homeConsistency(wi).replace('<section class="sec">', '<section class="a4-card">')}
      <h2 class="a4-sec">Strategi race</h2>
    </div>`;
  }
  vRace = function () {
    const P = racePlanData(), T = raceTabs();
    const body = { overview: tabOverview, pace: tabPace, splits: tabSplits, elev: tabElev, hydration: tabHydration, fuel: tabFuel, hr: tabHr, stations: tabStations, checklist: () => raceChecklist() }[T.cur](P);
    return `${raceHub()}<div style="margin-top:8px">${eventCard()}</div>
      <div data-tour="race-tabs" style="margin-top:14px">${T.html}</div>
      <div style="margin-top:12px" data-tour="race-body">${body}</div>`;
  };

  /* ---------- Kamu ---------- */
  const ROWS = [
    ["Latihan", [["jadwal", "Hari lari"], ["cal", "Kalender"], ["recovery", "Check-in"], ["strength", "Strength"], ["locked", "Locked-in"], ["elev", "Elevation"]]],
    ["Gear & teman", [["shoes", "Sepatu"], ["bareng", "Teman"], ["goals", "Goals & badge"]]],
    ["App", [["settings", "Settings"], ["notif", "Notifikasi"], ["integ", "Integrasi"], ["data", "Data & backup"], ["guide", "Panduan"], ["kamus", "Kamus"], ["tutorials", "Tutorial"], ["about", "Tentang"]]]
  ];
  vMore = function () {
    const ls = S.logs.filter(l => !l.sample), y = String(new Date().getFullYear());
    const yr = ls.filter(l => l.date.startsWith(y));
    const has = new Set(NAV_MORE.map(x => x[0]).concat(["cal", "jadwal"]));
    return `<div class="a4"><div class="a4-top"><div><h1>Kamu</h1></div>${helpBtn("more")}</div>
      <div data-tour="acct">${acctBox()}</div>
      <section class="a4-card a4-me"><div><b class="num">${fmtKm(sum(ls, l => l.distance))}</b><span>km total</span></div><div><b class="num">${ls.length}</b><span>lari</span></div><div><b class="num">${fmtKm(sum(yr, l => l.distance))}</b><span>km ${y}</span></div></section>
      <div data-tour="menu">${ROWS.map(([g, rows]) => `<h2 class="a4-sec">${g}</h2><div class="rows a4-list">${rows.filter(([k]) => has.has(k)).map(([k, l]) => `<button class="row" data-act="nav" data-t="${k}" ${k === "tutorials" ? 'data-tour="tut-hub"' : ""}><span class="a4-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${(typeof MENU_IC !== "undefined" && MENU_IC[k]) || '<circle cx="12" cy="12" r="8"/>'}</svg></span><span class="grow">${l}</span><span class="mu">›</span></button>`).join("")}</div>`).join("")}</div></div>`;
  };

  /* ---------- Quick log sheet ---------- */
  function qlogDefault() {
    const t = todayYmd(), s = todayRun();
    const free = s && !logFor(s.id) ? s : null;
    return { date: t, sessionId: free ? free.id : null, type: free ? free.type : "easy", km: free ? free.dist : 5, dur: "", eff: 0 };
  }
  const EFF = [2, 4, 6, 7, 9];
  function mQlog() {
    const q = M.q, s = q.sessionId ? sessById(q.sessionId) : null;
    return `${mHead("Catat lari")}
      <div class="ql">
        <div class="ql-plan">${s ? `<i class="dot" style="--c:${tc(s.type)}"></i>${esc(TYPES[s.type])} · rencana <span class="num">${fmtKm(s.dist)} km</span>` : `<i class="dot" style="--c:${tc(q.type)}"></i>${esc(TYPES[q.type])} · di luar jadwal`}</div>
        <div class="ql-dist"><button class="ql-step" data-act="qlStep" data-v="-0.5" aria-label="Kurangi 0,5 km">−</button>
          <label class="ql-num"><input type="text" id="ql-km" inputmode="decimal" size="4" value="${fmtKm(q.km)}" aria-label="Jarak (km)"><span>km</span></label>
          <button class="ql-step" data-act="qlStep" data-v="0.5" aria-label="Tambah 0,5 km">+</button></div>
        <div class="ql-row"><label for="ql-dur">Waktu</label><input type="text" id="ql-dur" inputmode="numeric" placeholder="mm:dd atau j:mm:dd" value="${esc(q.dur)}"></div>
        <div class="ql-row"><span class="lbl">Effort</span><div class="ql-eff" role="group" aria-label="Effort">${EFF.map((r, i) => `<button class="${q.eff > i ? "on" : ""}" data-act="qlEff" data-v="${i + 1}" aria-label="Effort ${r} dari 10" aria-pressed="${q.eff === i + 1}" style="height:${14 + i * 7}px"></button>`).join("")}</div></div>
        <div class="ql-row"><label for="ql-date">Tanggal</label><input type="date" id="ql-date" value="${q.date}" max="${todayYmd()}"></div>
        <button class="btn pri ql-save" data-act="qlSave">Simpan</button>
        <button class="link sm" data-act="qlFull">Isi detail lengkap</button>
      </div>`;
  }
  function qlRead() {
    const q = M.q, km = document.getElementById("ql-km"), dur = document.getElementById("ql-dur"), dt = document.getElementById("ql-date");
    if (km) { const v = parseFloat(String(km.value).replace(",", ".")); if (!isNaN(v)) q.km = v; }
    if (dur) q.dur = dur.value.trim();
    if (dt && dt.value) q.date = dt.value;
    return q;
  }
  const _modal4 = modal;
  modal = function () {
    if (!M || M.kind !== "qlog") return _modal4();
    return `<div class="sheet-bg" data-act="closeM"></div><div class="sheet" role="dialog" aria-modal="true">${mQlog()}</div>`;
  };

  /* ---------- Actions ---------- */
  Object.assign(ACT, {
    quickLog: () => { M = { kind: "qlog", q: qlogDefault() }; render(true); },
    qlStep: d => { const q = qlRead(); q.km = Math.max(0, Math.round((q.km + parseFloat(d.v)) * 10) / 10); render(true); },
    qlEff: d => { const q = qlRead(); const v = +d.v; q.eff = q.eff === v ? 0 : v; render(true); },
    qlFull: () => { const q = qlRead(); const pre = { date: q.date, type: q.type, sessionId: q.sessionId, distance: q.km || null, duration: parseDur(q.dur) || null }; M = null; openLogModal(pre); },
    qlSave: () => {
      const q = qlRead();
      if (!(q.km > 0) || q.km > 200) { toast("Isi jarak dulu"); return; }
      const sec = q.dur ? parseDur(q.dur) : null;
      if (q.dur && !(sec > 0)) { toast("Tulis waktu seperti 35:00"); return; }
      if (!validYmd(q.date) || q.date > todayYmd()) { toast("Tanggalnya belum bener"); return; }
      let sid = q.sessionId; const s = sid ? sessById(sid) : null;
      if (s && (logFor(sid) || s.date !== q.date)) sid = null;
      const l = { id: uid(), date: q.date, type: s && sid ? s.type : q.type, sessionId: sid, distance: Math.round(q.km * 100) / 100, duration: sec || null, elev: null, hrAvg: null, hrMax: null, rpe: q.eff ? EFF[q.eff - 1] : null, weather: "", notes: "", shoeId: S.settings.defaultShoe || null };
      if (sid) delete S.status[sid];
      S.logs.push(l); M = null; persist(); render(true);
      toast(`Tersimpan · ${fmtKm(l.distance)} km${sec ? " · " + fmtPace(sec / l.distance) : ""}`);
    },
    ciQuick: d => {
      const b = BODY.find(x => x.k === d.k); if (!b) return;
      const t = todayYmd();
      S.checkins = S.checkins.filter(c => c.date !== t);
      S.checkins.push(Object.assign({ date: t }, b.c));
      persist(); render(true);
      const r = readiness(S.checkins[S.checkins.length - 1]);
      toast(`Check-in: ${b.l} · ${RD_LBL[r.st]}`);
    },
    feedMore: () => { S.ui.feedN = (S.ui.feedN || 20) + 20; render(true); },
    score: d => { S.ui.score = d.k; S.ui.tab = "score"; M = null; persist(); render(false); }
  });

  /* ---------- Liquid vessels come alive after each paint ---------- */
  const _afterPaint4 = afterPaint;
  afterPaint = function () { _afterPaint4(); if (G4.WRI_VESSEL) G4.WRI_VESSEL.mount(document.getElementById("app")); };

  /* ---------- Record button (beside the dock) ---------- */
  let REC = null;
  const _setDock4 = setDock;
  setDock = function (active) {
    _setDock4(active);
    if (!REC) {
      REC = document.createElement("button");
      REC.className = "a4-rec"; REC.id = "rec"; REC.setAttribute("data-act", "quickLog"); REC.setAttribute("aria-label", "Catat lari");
      REC.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
      document.body.appendChild(REC);
    }
    REC.hidden = !DOCK || DOCK.nav.hidden;
  };
})();
