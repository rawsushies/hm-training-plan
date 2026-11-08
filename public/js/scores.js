/* WeRunIt daily scores: Siap (readiness), Beban (load), Tidur (sleep), plus training-load balance.
 * Pure and deterministic (no DOM, no network): loaded as a classic <script> and imported by the Node unit tests.
 *
 * The three-score shape (0–100 each, colour bands, a confidence tier, "show nothing rather than fake it") follows the
 * openly documented model of NOOP (github.com/ryanbr/noop, docs/ANALYTICS.md). This is an independent JavaScript
 * implementation written for WeRunIt's data (runs, RPE, optional HR, daily check-ins); no NOOP code is used.
 * Published methods behind each number:
 *  - Session load: Foster et al. (2001) session-RPE (minutes × RPE), or Edwards (1993) five-zone summated heart
 *    rate (minutes × zone weight 1–5 on %HRmax) when a run has an average HR and the runner's measured HRmax is known.
 *    RPE is halved so both land on the same 1–5 intensity scale.
 *  - Beban (Effort): logarithmic compression 100·ln(load+1)/ln(D), so easy days sit low and only a race-like day nears 100.
 *  - Fitness / fatigue: Banister et al. (1975) impulse-response, exponentially weighted with τ = 28 (chronic) and τ = 7 days (acute).
 *  - Load ratio: acute:chronic workload ratio, Hulin et al. (2016); 0.8–1.3 is the usual "sweet spot".
 *  - Siap (Charge): Hooper & Mackinnon (1995) style wellness (sleep, energy, motivation, soreness, fatigue, pain)
 *    as a robust z-score against the runner's own winsorized EWMA baseline, combined with freshness (TSB) and
 *    squashed by a logistic so a typical day lands near 58; pain ≥ 4 caps it in the red.
 *  - Tidur (Rest): reported sleep quality, with a small share for night-to-night consistency.
 * Not medical advice; approximations for training decisions only.
 * Exposes globalThis.WRI_SCORES.
 */
(function (G) {
  "use strict";
  const DAY = 864e5;
  const D = 2401;                    // effort denominator: 8 h at the top intensity (5) saturates the curve
  const TYPE_RPE = { recovery: 2, easy: 3, long: 4, elevation: 6, locked: 7, benchmark: 8, race: 9, other: 4, strength: 5 };
  const PACE_EST = 390;              // s/km used only to estimate minutes when a run has no time
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ymd = d => { const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };

  /** Intensity 1–5 for one run, and where it came from. */
  function intensity(l, hrMax) {
    if (l.hrAvg && hrMax >= 120 && hrMax <= 230) {
      const p = l.hrAvg / hrMax;
      const w = p >= 0.9 ? 5 : p >= 0.8 ? 4 : p >= 0.7 ? 3 : p >= 0.6 ? 2 : p >= 0.5 ? 1 : 0.5;
      return { w, src: "hr" };
    }
    if (l.rpe >= 1 && l.rpe <= 10) return { w: l.rpe / 2, src: "rpe" };
    return { w: (TYPE_RPE[l.type] || 4) / 2, src: "type" };
  }
  function minutes(l) {
    if (l.duration > 0) return { m: l.duration / 60, est: false };
    if (l.distance > 0) return { m: l.distance * PACE_EST / 60, est: true };
    return { m: 0, est: true };
  }
  /** Training load of one run (minutes × intensity), flagged when any input was estimated. */
  function runLoad(l, hrMax) {
    const i = intensity(l, hrMax), t = minutes(l);
    return { load: t.m * i.w, est: t.est || i.src === "type", src: i.src };
  }
  /** Daily loads for `days` days ending at `end` (inclusive). Strength sessions count as 25 min at intensity 2,5. */
  function dayLoads(logs, strength, end, days, hrMax) {
    const from = addDays(end, -(days - 1)), map = {};
    for (const l of logs || []) if (l.date >= from && l.date <= end) {
      const r = runLoad(l, hrMax), x = map[l.date] || (map[l.date] = { load: 0, est: false, n: 0 });
      x.load += r.load; x.est = x.est || r.est; x.n++;
    }
    for (const s of strength || []) if (s.date >= from && s.date <= end) {
      const x = map[s.date] || (map[s.date] = { load: 0, est: false, n: 0 });
      x.load += 25 * 2.5; x.n++;
    }
    const out = [];
    for (let i = 0; i < days; i++) { const d = addDays(from, i), x = map[d]; out.push({ date: d, load: x ? x.load : 0, est: x ? x.est : false, n: x ? x.n : 0 }); }
    return out;
  }
  /** Beban: day load on a logarithmic 0–100 curve. */
  const effort = load => load > 0 ? Math.round(clamp(100 * Math.log(load + 1) / Math.log(D), 0, 100)) : 0;

  /** Banister fitness (CTL, τ 28), fatigue (ATL, τ 7), form (TSB) and the acute:chronic ratio over a load series. */
  function loadState(series) {
    const ka = 1 - Math.exp(-1 / 7), kc = 1 - Math.exp(-1 / 28);
    let atl = 0, ctl = 0;
    for (const x of series) { atl += (x.load - atl) * ka; ctl += (x.load - ctl) * kc; }
    const acwr = ctl > 1 ? atl / ctl : null;
    return { atl, ctl, tsb: ctl - atl, acwr };
  }
  const ratioZone = r => r === null ? "none" : r < 0.8 ? "low" : r <= 1.3 ? "sweet" : r <= 1.5 ? "high" : "danger";

  /** Hooper-style wellness on 1–5 (higher is better). */
  function wellness(c) {
    if (!c) return null;
    const v = [c.sleep, c.energy, c.motivation, 6 - c.soreness, 6 - c.fatigue, 6 - c.pain].filter(x => x >= 1 && x <= 5);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  /** Winsorized EWMA baseline (centre half-life 14, spread half-life 21) with a status like NOOP's lifecycle. */
  function baseline(values, { halfLife = 14, spreadHalfLife = 21, floor = 0.25, seed = 4, trust = 14 } = {}) {
    const lb = 1 - Math.pow(0.5, 1 / halfLife), ls = 1 - Math.pow(0.5, 1 / spreadHalfLife);
    let mean = null, spread = floor, n = 0;
    for (const v of values) {
      if (!(v >= 1 && v <= 5)) continue;
      if (mean === null) { mean = v; n = 1; continue; }
      if (n >= seed && Math.abs(v - mean) > 5 * spread) { n++; continue; }       // seen, not folded
      const c = clamp(v, mean - 3 * spread, mean + 3 * spread);
      mean = lb * c + (1 - lb) * mean;
      spread = Math.max(floor, ls * Math.abs(v - mean) + (1 - ls) * spread);
      n++;
    }
    const status = n < seed ? "calibrating" : n < trust ? "provisional" : "trusted";
    return { mean, spread, n, status };
  }
  const band = s => s === null || s === undefined ? "none" : s < 34 ? "red" : s < 67 ? "yellow" : "green";
  const logistic = z => 100 / (1 + Math.exp(-1.6 * (z + 0.2)));

  /**
   * Siap for one day.
   * ctx: {date, checkins, logs, strength, hrMax}
   * Returns {score, band, tier, drivers:{wellness, freshness, pain}, load:{atl, ctl, tsb, acwr}}; score null when nothing honest can be said.
   */
  function charge(ctx) {
    const { date } = ctx, ci = (ctx.checkins || []).filter(c => !c.sample).sort((a, b) => a.date.localeCompare(b.date));
    const today = ci.find(c => c.date === date) || null;
    const hist = ci.filter(c => c.date < date).map(wellness);
    const bl = baseline(hist);
    const loads = dayLoads(ctx.logs, ctx.strength, addDays(date, -1), 56, ctx.hrMax);   // up to yesterday: how fresh you start today
    const ls = loadState(loads);
    const hasLoad = loads.some(x => x.load > 0);
    const w = wellness(today);
    const terms = [];
    if (w !== null) {
      const mean = bl.status === "calibrating" ? 3.6 : bl.mean, spread = bl.status === "calibrating" ? 0.5 : bl.spread;
      terms.push({ k: "wellness", z: clamp((w - mean) / (1.253 * spread), -3, 3), wt: 0.65 });
    }
    if (hasLoad) terms.push({ k: "freshness", z: clamp(ls.tsb / Math.max(8, ls.ctl * 0.6), -3, 3), wt: 0.35 });
    if (!terms.length) return { score: null, band: "none", tier: "calibrating", drivers: {}, load: ls };
    const wsum = terms.reduce((a, t) => a + t.wt, 0), z = terms.reduce((a, t) => a + t.z * t.wt, 0) / wsum;
    let score = Math.round(logistic(z));
    const pain = today && today.pain >= 4;
    if (pain) score = Math.min(score, 30);
    const tier = w === null ? "building" : bl.status === "trusted" ? "solid" : bl.status === "provisional" ? "building" : "calibrating";
    const drivers = {}; terms.forEach(t => { drivers[t.k] = Math.round(t.z * 100) / 100; }); if (pain) drivers.pain = true;
    return { score, band: band(score), tier, drivers, load: ls };
  }
  /** Beban for one day (sum of that day's sessions). */
  function dayEffort(ctx) {
    const d = dayLoads(ctx.logs, ctx.strength, ctx.date, 1, ctx.hrMax)[0];
    return { score: effort(d.load), load: d.load, n: d.n, tier: d.n === 0 ? "solid" : d.est ? "building" : "solid" };
  }
  /** Tidur for one day: reported sleep (1–5) with 15% weight on the last seven nights' consistency. */
  function rest(ctx) {
    const ci = (ctx.checkins || []).filter(c => !c.sample);
    const today = ci.find(c => c.date === ctx.date);
    if (!today || !(today.sleep >= 1)) return { score: null, band: "none", tier: "calibrating" };
    const q = (today.sleep - 1) / 4 * 100;
    const week = ci.filter(c => c.date <= ctx.date && c.date > addDays(ctx.date, -7) && c.sleep >= 1).map(c => c.sleep);
    let cons = 100;
    if (week.length >= 3) { const m = week.reduce((a, b) => a + b, 0) / week.length; const sd = Math.sqrt(week.reduce((a, b) => a + (b - m) * (b - m), 0) / week.length); cons = clamp(100 - sd * 50, 0, 100); }
    const score = Math.round(0.85 * q + 0.15 * cons);
    return { score, band: band(score), tier: week.length >= 3 ? "solid" : "building" };
  }
  /** Recommended Beban range for today from Siap (green pushes, red rests). */
  function targetEffort(siap) {
    if (siap === null || siap === undefined) return null;
    return siap >= 67 ? [60, 80] : siap >= 34 ? [45, 65] : [0, 40];
  }
  /** Per-day series for the detail charts. */
  function series(ctx, days) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(ctx.date, -i), c = Object.assign({}, ctx, { date: d });
      out.push({ date: d, siap: charge(c).score, beban: dayEffort(c).score, tidur: rest(c).score });
    }
    return out;
  }

  G.WRI_SCORES = { D, TYPE_RPE, intensity, minutes, runLoad, dayLoads, effort, loadState, ratioZone, wellness, baseline, band, logistic, charge, dayEffort, rest, targetEffort, series, addDays };
})(typeof globalThis !== "undefined" ? globalThis : this);
