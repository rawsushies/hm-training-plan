/* WeRunIt flexible scheduling + race events + replanning (pure logic; also imported by Node tests).
 * Exposes globalThis.WRI_SCHED.
 *
 * Separation of concerns:
 *   availability (which days the runner CAN run)  ≠  prescription (which sessions the plan PRESCRIBES).
 * The prescription (PLAN table: distances, types, purposes) never changes because days change.
 * Session ids stay "w{n}-wd|sat|sun|sA|sB" ("ex" for an optional 4th run): the id says which prescribed
 * session it is, never which weekday it lands on. Manual moves (overrides.date) always win.
 *
 * Day offsets: 0 = Monday … 6 = Sunday (the plan week starts on Monday).
 */
(function (G) {
  "use strict";
  const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const LEGACY_STR = { 0: [[3, "A"], [1, "B"]], 1: [[3, "A"], [0, "B"]], 3: [[0, "A"], [1, "B"]], 4: [[0, "A"], [3, "B"]] };

  /** The arrangement every v3 user already has, expressed as a schedule (used to prefill the editor). */
  function fromLegacy(weekday) {
    const avail = [false, false, false, false, false, true, true];
    avail[weekday] = true;
    return { v: 1, avail, long: 5, quality: weekday, recovery: 6, strength: LEGACY_STR[weekday].map(x => x[0]), freq: 3 };
  }
  function cleanSchedule(s) {
    if (!s || typeof s !== "object" || !Array.isArray(s.avail) || s.avail.length !== 7) return null;
    const d = v => Number.isInteger(v) && v >= 0 && v <= 6 ? v : null;
    return { v: 1, avail: s.avail.map(Boolean), long: d(s.long), quality: d(s.quality), recovery: d(s.recovery),
      strength: Array.isArray(s.strength) ? [...new Set(s.strength.map(d).filter(x => x !== null))].slice(0, 3) : [],
      freq: [2, 3, 4].includes(s.freq) ? s.freq : 3 };
  }
  const gap = (a, b) => Math.abs(a - b);

  /**
   * Assign one week's prescribed sessions to day offsets.
   * kinds: {wd:"quality"|"easy", sat:"long"|"elevation"|"easy", sun:"recovery"|"race"}; raceWeek pins race to its day.
   * Returns {days:{slot→offset}, strength:{A/B→offset}, unplaced:[slot], notes:[string]}.
   */
  function assignWeek(sched, { kinds = {}, raceWeek = false, includeExtra = false, strengthKinds = ["A", "B"] } = {}) {
    const avail = sched.avail.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const used = new Set(), out = { days: {}, strength: {}, unplaced: [], notes: [] };
    const take = (slot, d) => { out.days[slot] = d; used.add(d); };
    const free = () => avail.filter(d => !used.has(d));
    if (raceWeek) { take("sun", 6); }                                   // race day is fixed by the event
    // 1) long run: preferred day, else the latest free day (weekend-ish), keeps it away from the week start
    if (!raceWeek) {
      const pref = sched.long !== null && sched.avail[sched.long] ? sched.long : null;
      const cand = pref !== null ? pref : free().sort((a, b) => b - a)[0];
      if (cand === undefined) out.unplaced.push("sat"); else take("sat", cand);
    } else { const c = free().filter(d => d < 6).sort((a, b) => b - a)[0]; if (c === undefined) out.unplaced.push("sat"); else take("sat", c); }
    const L = out.days.sat ?? (raceWeek ? 6 : null);
    // 2) weekday / quality session: preferred if ≥2 days from the long run, else the free day farthest from it
    {
      const hard = kinds.wd === "quality";
      const pref = sched.quality !== null && sched.avail[sched.quality] && !used.has(sched.quality) && (!hard || L === null || gap(sched.quality, L) >= 2) ? sched.quality : null;
      const c = pref ?? free().sort((a, b) => (L === null ? 0 : gap(b, L) - gap(a, L)) || a - b)[0];
      if (c === undefined) out.unplaced.push("wd"); else { take("wd", c); if (hard && L !== null && gap(c, L) < 2) out.notes.push("Sesi cepat dan long run berdekatan karena hari yang tersedia terbatas. Bikin sesi cepatnya lebih ringan."); }
    }
    // 3) recovery / shakeout: day after the long run if free, else preferred, else any free day not before the long run
    if (!raceWeek && sched.freq >= 3) {
      const after = L !== null && L < 6 && sched.avail[L + 1] && !used.has(L + 1) ? L + 1 : null;
      const pref = sched.recovery !== null && sched.avail[sched.recovery] && !used.has(sched.recovery) ? sched.recovery : null;
      const c = after ?? pref ?? free().sort((a, b) => (L === null ? 0 : gap(b, L) - gap(a, L)))[0];
      if (c === undefined) out.unplaced.push("sun"); else take("sun", c);
    }
    // 4) optional 4th run (frequency 4): an easy run on a free day not adjacent to the quality session or long run
    if (includeExtra && sched.freq === 4) {
      const c = free().sort((a, b) => [out.days.wd, L].filter(x => x !== null && x !== undefined).reduce((m, x) => Math.min(m, gap(b, x)), 9) - [out.days.wd, L].filter(x => x !== null && x !== undefined).reduce((m, x) => Math.min(m, gap(a, x)), 9))[0];
      if (c === undefined) out.unplaced.push("ex"); else take("ex", c);
    }
    if (sched.freq === 2) out.notes.push("Frekuensi 2 lari/minggu: recovery run nggak dijadwalkan.");
    // 5) strength (optional days; never the day before the long run for A, never on a run day)
    const runDays = new Set(Object.values(out.days));
    const pool = (sched.strength.length ? sched.strength : [0, 1, 2, 3, 4, 5, 6]).filter(d => !runDays.has(d));
    for (const k of strengthKinds) {
      const okd = pool.filter(d => !Object.values(out.strength).includes(d) && !(k === "A" && L !== null && d === L - 1));
      const c = okd[0];
      if (c !== undefined) out.strength[k] = c;
    }
    if (out.unplaced.length) out.notes.push(`Hari tersedia kurang: ${out.unplaced.map(x => ({ wd: "sesi weekday", sat: "long run", sun: "recovery run", ex: "lari tambahan" })[x]).join(", ")} nggak dapat hari. Tambah hari tersedia atau pindahkan manual.`);
    return out;
  }
  /** Rough intensity per slot for previews / rule checks. */
  const HARD = new Set(["locked", "benchmark", "elevation", "long", "race"]);
  function weekWarnings(sessions) {
    const w = [], hard = sessions.filter(s => HARD.has(s.type)).map(s => s.date).sort();
    for (let i = 1; i < hard.length; i++) if ((new Date(hard[i]) - new Date(hard[i - 1])) / 864e5 < 2) w.push("Dua sesi berat berurutan. Sisipkan hari santai di antaranya.");
    return [...new Set(w)];
  }

  /* ---------------- Race events ---------------- */
  const STATUSES = ["planned", "confirmed", "postponed", "cancelled", "completed", "archived"];
  const STD_KM = { "5k": 5, "10k": 10, "10mi": 16.0934, "half": 21.0975, "marathon": 42.195 };
  function defaultEvent(settings) {
    return { id: "jakim-2027", name: "BTN JAKIM Half Marathon", organizer: "", eventDate: settings.raceDate || "2027-06-13", distanceKm: 21.0975,
      location: "Jakarta", targetFinish: settings.goalTime || "3:30:00", eventStatus: "planned", aidStations: [], cutOffTimes: [], courseProfile: null,
      sourceUrl: "", sourceUpdatedAt: "", createdAt: "", updatedAt: "" };
  }
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function cleanEvent(e) {
    if (!e || typeof e !== "object" || !ID_RE.test(e.id || "") || !DATE_RE.test(e.eventDate || "")) return null;
    const km = +e.distanceKm; if (!(km >= 1 && km <= 250)) return null;
    const str = (v, n) => v == null ? "" : String(v).slice(0, n);
    const stations = Array.isArray(e.aidStations) ? e.aidStations.filter(a => a && +a.km > 0 && +a.km <= km).map(a => ({ km: Math.round(+a.km * 100) / 100, label: str(a.label, 40), water: a.water !== false, fuel: !!a.fuel, verified: !!a.verified })).slice(0, 60) : [];
    const cut = Array.isArray(e.cutOffTimes) ? e.cutOffTimes.filter(c => c && +c.km > 0 && /^\d{1,2}:\d{2}(:\d{2})?$/.test(c.time || "")).map(c => ({ km: +c.km, time: c.time })).slice(0, 20) : [];
    const prof = e.courseProfile && Array.isArray(e.courseProfile.points) ? { source: str(e.courseProfile.source, 120), points: e.courseProfile.points.filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).slice(0, 3000).map(p => [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 10) / 10]) } : null;
    return { id: e.id, name: str(e.name, 80) || "Race", organizer: str(e.organizer, 80), eventDate: e.eventDate, distanceKm: km, location: str(e.location, 80),
      targetFinish: /^\d{1,2}:\d{2}(:\d{2})?$/.test(e.targetFinish || "") ? e.targetFinish : "", eventStatus: STATUSES.includes(e.eventStatus) ? e.eventStatus : "planned",
      aidStations: stations, cutOffTimes: cut, courseProfile: prof, sourceUrl: /^https:\/\/[^\s"<>]+$/.test(e.sourceUrl || "") ? e.sourceUrl.slice(0, 300) : "",
      sourceUpdatedAt: str(e.sourceUpdatedAt, 30), createdAt: str(e.createdAt, 30), updatedAt: str(e.updatedAt, 30) };
  }
  /** Distance factor for future weeks when the target race isn't a half marathon. */
  function distanceFactor(km) {
    if (km <= 5.5) return { f: 0.6, note: "Rencana disesuaikan ke 5K: jarak sesi dikurangi, struktur latihan tetap." };
    if (km <= 11) return { f: 0.75, note: "Rencana disesuaikan ke 10K: jarak sesi dikurangi, struktur latihan tetap." };
    if (km <= 17) return { f: 0.9, note: "Rencana disesuaikan ke 10 mil." };
    if (km <= 22.5) return { f: 1, note: "" };
    return { f: 1, note: "Program ini dirancang untuk half marathon. Untuk marathon atau lebih jauh, kamu butuh program khusus dengan long run lebih panjang; WeRunIt belum membuat rencana itu, jadi jarak latihan nggak dinaikkan otomatis.", unsupported: true };
  }

  /**
   * Replan for a new race date. Past weeks (≤ curIdx) keep their template and dates; only the remaining
   * calendar weeks are re-mapped onto the 31-week template.
   *   weeks: current mapping (calendar index → template week number), e.g. [1..31]
   *   curIdx: index of the current week (0-based); weeksLeft: whole weeks from the next week to race week inclusive
   * Longer: repeat the current 4-week block (no volume jump) before continuing.
   * Shorter: skip forward through build weeks, capping the jump to +10% planned volume, keep the 3-week taper.
   * Returns {weeks, changes:[string], readiness:"ok"|"tight"|"insufficient"}.
   */
  function replan(weeks, curIdx, weeksLeft, planTotals) {
    const past = weeks.slice(0, curIdx + 1), curT = past[past.length - 1] || 0, changes = [];
    const remainingT = []; for (let t = curT + 1; t <= 31; t++) remainingT.push(t);
    const need = remainingT.length;
    let fut;
    if (weeksLeft === need) { fut = remainingT; changes.push("Jumlah minggu sama, cuma tanggal yang bergeser."); }
    else if (weeksLeft > need) {
      const extra = weeksLeft - need, blockStart = Math.max(1, Math.floor((Math.min(curT, 27) - 1) / 4) * 4 + 1), blockEnd = Math.min(27, blockStart + 3);
      const rep = []; for (let i = 0; i < extra; i++) rep.push(Math.min(27, blockStart + (i % 4)));
      const rest = remainingT.filter(t => t <= blockEnd), after = remainingT.filter(t => t > blockEnd);
      fut = [...rest, ...rep, ...after];          // finish the current block, repeat it, then continue
      changes.push(`Waktu persiapan bertambah ${extra} minggu: blok latihan sekarang (minggu ${blockStart}–${Math.min(27, blockStart + 3)}) diulang dulu supaya volume nggak naik mendadak.`);
    } else {
      const taper = remainingT.filter(t => t >= 28), build = remainingT.filter(t => t < 28);
      const slots = Math.max(0, weeksLeft - taper.length);
      let readiness = "ok";
      if (weeksLeft < Math.min(4, need)) {
        readiness = "insufficient";
        fut = remainingT.slice(-weeksLeft);
        changes.push(`Cuma ${weeksLeft} minggu sampai race. Itu kurang dari taper (3 minggu) + race week. Jadwal langsung masuk fase akhir; jangan kejar volume yang terlewat. Pertimbangkan target santai atau race lain.`);
        return { weeks: [...past, ...fut], changes, readiness };
      }
      // pick build weeks evenly, but never let planned volume jump more than +10% week over week
      const pick = [], hist = [planTotals[(past[past.length - 2] || curT) - 1] || 0, planTotals[curT - 1] || planTotals[0]];
      const load = () => Math.max(...hist.slice(-2));               // recent load ignores a single cutback dip
      for (let i = 0; i < slots; i++) {
        const ideal = build[Math.min(build.length - 1, Math.round((i + 1) * build.length / slots) - 1)];
        let t = ideal; while (t > (pick[pick.length - 1] || curT) + 1 && planTotals[t - 1] > load() * 1.1) t--;
        pick.push(t); hist.push(planTotals[t - 1]);
      }
      fut = [...pick, ...taper];
      const skipped = build.length - new Set(pick).size;
      readiness = skipped > 4 ? "tight" : "ok";
      changes.push(`Waktu persiapan berkurang ${need - weeksLeft} minggu: ${skipped} minggu build dilewati dengan kenaikan volume maksimal 10% per minggu, taper 3 minggu tetap.`);
      if (readiness === "tight") changes.push("Persiapan jadi ketat. Kalau badan belum siap di long run terakhir, turunkan target waktumu.");
      return { weeks: [...past, ...fut], changes, readiness };
    }
    return { weeks: [...past, ...fut], changes, readiness: "ok" };
  }

  G.WRI_SCHED = { DAYS, fromLegacy, cleanSchedule, assignWeek, weekWarnings, STATUSES, STD_KM, defaultEvent, cleanEvent, distanceFactor, replan, LEGACY_STR };
})(typeof globalThis !== "undefined" ? globalThis : this);
