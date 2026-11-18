/* WeRunIt coach: provider-neutral domain model (pure; no DOM, no network). Exposes globalThis.WRI_COACH_MODEL.
 * TrainingSession is the only shape the coach engine reads. Providers map their records into it; nothing in the engine
 * depends on a provider's response format. Missing values stay null: never defaulted, never estimated.
 */
(function (G) {
  "use strict";
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  const pos = v => (num(v) !== null && v > 0 ? v : null);
  const SOURCE = l => l.sample ? "sample" : /strava/i.test(l.src || "") || /^strava:/.test(l.extId || "") ? "strava" : /health/i.test(l.src || "") || /^hc:/.test(l.extId || "") ? "healthconnect" : l.src ? "file" : "manual";
  const startMin = l => { const m = /T(\d{2}):(\d{2})/.exec(l.extId || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

  /** Map a stored run (S.logs item) to a TrainingSession. */
  function toSession(l) {
    const km = pos(l.distance), sec = pos(l.duration);
    return {
      id: String(l.id), date: String(l.date), startMin: startMin(l), type: l.type || "other", plannedId: l.sessionId || null,
      distanceKm: km, durationSec: sec, paceSecPerKm: km && sec ? sec / km : null,            // derived only when both are recorded
      hrAvg: pos(l.hrAvg), hrMax: pos(l.hrMax), rpe: num(l.rpe) !== null && l.rpe >= 1 && l.rpe <= 10 ? l.rpe : null,
      elevGainM: num(l.elev) !== null && l.elev >= 0 ? l.elev : null, source: SOURCE(l), sample: !!l.sample
    };
  }
  /** Real sessions only (sample/demo data never reaches the coach). Strava-origin rows are excluded from analysis (policy). */
  function sessionsFrom(state) {
    const out = [], excluded = [];
    for (const l of (state && state.logs) || []) {
      const s = toSession(l);
      if (s.sample) { excluded.push({ id: s.id, reason: "contoh data" }); continue; }
      if (s.source === "strava") { excluded.push({ id: s.id, reason: "data Strava tidak boleh dianalisis (kebijakan API Strava)" }); continue; }
      out.push(s);
    }
    return { sessions: out.sort((a, b) => a.date.localeCompare(b.date)), excluded };
  }
  /** Strength work only as recorded by the runner (never inferred). */
  const strengthFrom = state => ((state && state.strength) || []).filter(r => r && !r.sample && r.date).map(r => ({ id: String(r.id), date: String(r.date) }));

  /* ---------- Providers ---------- */
  const STATUS = ["disconnected", "connecting", "connected", "permission-limited", "expired", "revoked", "unavailable", "blocked"];
  const STRAVA_BLOCK = "Kebijakan API Strava (berlaku 1 Juni 2026) membatasi penyimpanan, analisis, dan penggunaan AI atas data Strava. Penggunaan ini belum terverifikasi diizinkan, jadi koneksi tidak dibuat. Lihat docs/STRAVA_INTEGRATION_FEASIBILITY.md.";
  function providers(env = {}) {
    const hc = env.healthConnect || "unavailable";
    return [
      { id: "manual", name: "Catatan manual", status: "connected", note: "Jarak, waktu, dan effort yang kamu isi sendiri." },
      { id: "healthconnect", name: "Health Connect", status: STATUS.includes(hc) ? hc : "unavailable", note: hc === "unavailable" ? "Hanya di aplikasi Android." : "Baca latihan dan jarak, dianalisis di perangkat." },
      { id: "strava", name: "Strava", status: "blocked", note: STRAVA_BLOCK }
    ];
  }
  /** The Strava provider can never be connected from here (see the feasibility doc). */
  function connect(id) { if (id === "strava") throw new Error(STRAVA_BLOCK); return true; }

  /** Field coverage across sessions: which questions can the data answer. */
  const FIELDS = [["distanceKm", "Jarak"], ["durationSec", "Durasi"], ["paceSecPerKm", "Pace"], ["rpe", "Effort (RPE)"], ["hrAvg", "Detak jantung"], ["elevGainM", "Elevasi"], ["startMin", "Jam mulai"]];
  function coverage(sessions) { const n = sessions.length; return FIELDS.map(([k, label]) => ({ k, label, have: sessions.filter(s => s[k] !== null).length, total: n })); }

  G.WRI_COACH_MODEL = { toSession, sessionsFrom, strengthFrom, providers, connect, coverage, FIELDS, STATUS, STRAVA_BLOCK };
})(typeof globalThis !== "undefined" ? globalThis : this);
