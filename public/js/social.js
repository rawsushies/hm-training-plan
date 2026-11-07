/* WeRunIt friends: what may be shared, and the joint-pace check (pure logic; imported by Node tests).
 * Exposes globalThis.WRI_SOCIAL.
 *
 * Privacy model: nothing is shared unless the owner enables it for that specific friend. The share
 * document only ever contains these summary fields; notes, check-ins, pain, routes and locations are
 * never part of it (and the Firestore rules reject any other field).
 */
(function (G) {
  "use strict";
  const PERMS = ["weekly", "completion", "pbs", "activities", "plan", "hr"];
  const PB_DIST = [["5k", 5], ["10k", 10], ["hm", 21.0975]];
  const defaultPerms = () => ({ weekly: false, completion: false, pbs: false, activities: [], plan: false, hr: false });
  function cleanPerms(p) {
    const o = defaultPerms();
    if (!p || typeof p !== "object") return o;
    for (const k of ["weekly", "completion", "pbs", "plan", "hr"]) o[k] = !!p[k];
    if (Array.isArray(p.activities)) o.activities = p.activities.filter(x => typeof x === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x)).slice(0, 10);
    return o;
  }
  const anyShared = p => p.weekly || p.completion || p.pbs || p.plan || p.hr || p.activities.length > 0;
  const real = logs => logs.filter(l => !l.sample);
  /** Fastest genuine effort within ±3% of each standard distance (from runs that have a time). */
  function personalBests(logs) {
    const out = {};
    for (const [k, d] of PB_DIST) {
      const c = real(logs).filter(l => l.duration && Math.abs(l.distance - d) / d <= 0.03);
      if (c.length) { const b = c.reduce((m, l) => l.duration / l.distance < m.duration / m.distance ? l : m); out[k] = { sec: Math.round(b.duration * d / b.distance), date: b.date }; }
    }
    return out;
  }
  /**
   * Build the share document body for one friend. week: {start, end, sessions:[{date,type,dist,title,done}]}
   * upcoming: [{date,type,dist,title}]
   */
  function buildShare({ logs, week, upcoming = [], perms, name, photo }) {
    const p = cleanPerms(perms), d = { name: String(name || "").slice(0, 80), photo: /^https:\/\/[^"<> ]+$/.test(photo || "") ? photo : "" };
    if (!anyShared(p)) return null;
    const rl = real(logs);
    if (p.weekly) {
      const wk = rl.filter(l => l.date >= week.start && l.date <= week.end);
      d.weekKm = Math.round(wk.reduce((a, l) => a + l.distance, 0) * 10) / 10;
      d.totalKm = Math.round(rl.reduce((a, l) => a + l.distance, 0) * 10) / 10;
    }
    if (p.completion) { d.weekDone = week.sessions.filter(s => s.done).length; d.weekPlanned = week.sessions.length; }
    if (p.pbs) d.pbs = personalBests(rl);
    if (p.activities.length) d.activities = rl.filter(l => p.activities.includes(l.id)).slice(0, 10).map(l => ({ date: l.date, type: l.type, km: Math.round(l.distance * 100) / 100, sec: l.duration || null }));
    if (p.plan) d.plan = upcoming.slice(0, 10).map(s => ({ date: s.date, type: s.type, km: s.dist || 0, title: String(s.title || "").slice(0, 60) }));
    if (p.hr) d.hrPace = rl.filter(l => l.hrAvg && l.duration && l.distance >= 3).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(l => ({ date: l.date, pace: Math.round(l.duration / l.distance), hrAvg: l.hrAvg, km: Math.round(l.distance * 10) / 10 }));
    return d;
  }
  /**
   * Is a joint target pace reachable for one runner? points: [{pace, hrAvg, km, date}] (own data or the
   * friend's shared hrPace). hrMax only if that runner entered a measured value.
   */
  function paceCheck(targetPace, points, hrMax, distanceKm) {
    const near = (points || []).filter(p => p.pace && Math.abs(p.pace - targetPace) <= 20);
    const faster = (points || []).filter(p => p.pace && p.pace <= targetPace + 5);
    if (!points || !points.length) return { level: "unknown", text: "Belum ada data HR dan pace yang bisa dipakai.", basis: [] };
    const longest = faster.reduce((m, p) => Math.max(m, p.km || 0), 0);
    if (!near.length) {
      const best = points.reduce((m, p) => Math.min(m, p.pace), Infinity);
      return best > targetPace + 20
        ? { level: "hard", text: "Belum pernah lari di sekitar pace ini; pace tercatat lebih lambat. Pertimbangkan target yang lebih santai.", basis: [] }
        : { level: "unknown", text: "Belum ada lari di sekitar pace ini dengan data HR.", basis: [] };
    }
    const hr = Math.round(near.reduce((a, p) => a + p.hrAvg, 0) / near.length);
    const out = { hr, basis: near.slice(0, 5), longest };
    if (hrMax >= 120) {
      const pct = hr / hrMax;
      out.pct = Math.round(pct * 100);
      out.level = pct < 0.8 ? "comfortable" : pct < 0.88 ? "moderate" : "hard";
    } else out.level = "noHrMax";
    const base = `Di pace serupa, HR rata-rata ${hr} bpm${out.pct ? ` (${out.pct}% dari HR maks terukur)` : ""}.`;
    const dist = distanceKm && longest < distanceKm * 0.6 ? ` Pace ini baru dipertahankan sampai ${longest} km, jarak targetnya ${Math.round(distanceKm * 10) / 10} km.` : "";
    out.text = base + ({ comfortable: " Kelihatannya nyaman.", moderate: " Cukup menantang, masih realistis.", hard: " Berat untuk dipertahankan lama.", noHrMax: " Tanpa HR maks terukur, persentase usaha belum bisa dihitung." })[out.level] + dist;
    return out;
  }
  /** Own contribution to a shared goal since it started (real runs only). */
  function contribution(logs, since) { const ls = real(logs).filter(l => l.date >= since); return { km: Math.round(ls.reduce((a, l) => a + l.distance, 0) * 10) / 10, runs: ls.length }; }
  const pairId = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
  G.WRI_SOCIAL = { PERMS, defaultPerms, cleanPerms, anyShared, personalBests, buildShare, paceCheck, contribution, pairId };
})(typeof globalThis !== "undefined" ? globalThis : this);
