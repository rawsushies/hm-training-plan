/* WeRunIt shoes: mileage (initial + tracked), rotation suggestion, honest discovery links.
 * Pure functions (Node-testable). No product catalogue is bundled or scraped: discovery only builds search
 * links the user opens in their own browser, and nothing about a product is shown unless the user typed it.
 */
(function (G) {
  "use strict";
  const USES = { daily: "Harian / easy", tempo: "Tempo / cepat", long: "Long run", race: "Race", trail: "Trail" };
  // which session types each use fits (higher = better fit)
  const FIT = {
    easy: { daily: 3, long: 2, tempo: 1, race: 0, trail: 1 }, recovery: { daily: 3, long: 2, tempo: 1, race: 0, trail: 1 },
    long: { long: 3, daily: 2, tempo: 1, race: 0, trail: 1 }, locked: { tempo: 3, race: 2, daily: 1, long: 1, trail: 0 },
    benchmark: { tempo: 3, race: 2, daily: 1, long: 1, trail: 0 }, elevation: { trail: 3, daily: 2, long: 2, tempo: 1, race: 0 },
    race: { race: 3, tempo: 2, daily: 1, long: 1, trail: 0 }
  };
  const r1 = v => Math.round(v * 10) / 10;

  /** Mileage of one shoe: initialKm (entered, before tracking) + tracked km from real runs. */
  function stats(shoe, logs) {
    const runs = (logs || []).filter(l => l.shoeId === shoe.id && !l.sample);
    const tracked = r1(runs.reduce((a, l) => a + (+l.distance || 0), 0)), initial = +shoe.initialKm || 0, total = r1(tracked + initial);
    const last = runs.reduce((a, l) => (l.date > a ? l.date : a), "");
    return { tracked, initial, total, runs: runs.length, pct: Math.min(100, Math.round(total / (shoe.limit || 700) * 100)), lastUsed: last || null };
  }

  /**
   * Suggest a shoe for a session type. Active shoes only; prefers a fitting use, then lower wear.
   * Race shoes are kept for fast sessions/race (fit 0 elsewhere). Returns {shoe, reason} or null.
   */
  function suggest(shoes, logs, type) {
    const fit = FIT[type] || FIT.easy, act = (shoes || []).filter(s => !s.retired);
    if (!act.length) return null;
    const scored = act.map(s => { const st = stats(s, logs), f = s.use ? fit[s.use] : 1.5; return { s, st, f, score: f * 100 - st.pct }; })
      .filter(x => x.f > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const b = scored[0], why = [];
    if (b.s.use) why.push(`dipakai buat ${USES[b.s.use].toLowerCase()}`);
    why.push(`${b.st.pct}% dari batas km`);
    if (scored.length > 1 && b.st.pct < scored[1].st.pct && (b.s.use === scored[1].s.use)) why.push("lebih jarang dipakai");
    return { shoe: b.s, stats: b.st, reason: why.join(", ") };
  }

  /** Simple rotation summary over the last `days` days (real runs only). */
  function rotation(shoes, logs, today, days = 28) {
    const from = new Date(today + "T00:00:00"); from.setDate(from.getDate() - days);
    const f = from.toISOString().slice(0, 10), recent = (logs || []).filter(l => !l.sample && l.date >= f && l.date <= today);
    const by = {}; let none = 0;
    for (const l of recent) { if (l.shoeId) by[l.shoeId] = (by[l.shoeId] || 0) + (+l.distance || 0); else none += +l.distance || 0; }
    const tot = Object.values(by).reduce((a, v) => a + v, 0);
    return { days, runs: recent.length, unassignedKm: r1(none), share: (shoes || []).filter(s => by[s.id]).map(s => ({ id: s.id, km: r1(by[s.id]), pct: tot ? Math.round(by[s.id] / tot * 100) : 0 })).sort((a, b) => b.km - a.km) };
  }

  /** External search links for discovery: opened by the user, nothing fetched or scraped by the app. */
  function searchLinks({ use = "daily", brand = "", text = "" } = {}) {
    const q = [text || "", brand, "sepatu lari", { daily: "daily trainer", tempo: "tempo", long: "long run", race: "racing", trail: "trail" }[use] || ""].filter(Boolean).join(" ").trim();
    const e = encodeURIComponent(q), en = encodeURIComponent([text, brand, "running shoe", use === "daily" ? "daily trainer" : use].filter(Boolean).join(" "));
    return [
      { id: "google", label: "Cari di Google", url: `https://www.google.com/search?q=${e}` },
      { id: "reviews", label: "Review lab (RunRepeat)", url: `https://www.google.com/search?q=${encodeURIComponent("site:runrepeat.com ")}${en}` },
      { id: "youtube", label: "Video review (YouTube)", url: `https://www.youtube.com/results?search_query=${en}+review` }
    ];
  }

  G.WRI_SHOES = { USES, FIT, stats, suggest, rotation, searchLinks };
})(typeof globalThis !== "undefined" ? globalThis : this);
