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
      if (s.source === "strava") { excluded.push({ id: s.id, reason: "data Strava hanya ditampilkan, tidak dianalisis (kebijakan API Strava)" }); continue; }
      out.push(s);
    }
    return { sessions: out.sort((a, b) => a.date.localeCompare(b.date)), excluded };
  }
  /** Strength work only as recorded by the runner (never inferred). */
  const strengthFrom = state => ((state && state.strength) || []).filter(r => r && !r.sample && r.date).map(r => ({ id: String(r.id), date: String(r.date) }));

  /* ---------- Providers ---------- */
  const STATUS = ["disconnected", "connecting", "connected", "permission-limited", "expired", "revoked", "unavailable", "signed-out", "rate-limited", "error"];
  const STRAVA_NOTE = "Hanya ditampilkan: aktivitas 7 hari terakhir, disimpan di perangkat ini paling lama 7 hari. Tidak disimpan sebagai lari, tidak disinkronkan, tidak dianalisis coach, dan tidak dipakai untuk mengubah rencana (kebijakan API Strava).";
  function providers(env = {}) {
    const hc = env.healthConnect || "unavailable", sv = env.strava || "unavailable";
    return [
      { id: "manual", name: "Catatan manual", status: "connected", note: "Jarak, waktu, dan effort yang kamu isi sendiri." },
      { id: "healthconnect", name: "Health Connect", status: STATUS.includes(hc) ? hc : "unavailable", note: hc === "unavailable" ? "Hanya di aplikasi Android." : "Baca latihan dan jarak, dianalisis di perangkat." },
      { id: "strava", name: "Strava", status: STATUS.includes(sv) ? sv : "unavailable", note: sv === "unavailable" ? "Server Strava belum diaktifkan oleh pemilik aplikasi. " + STRAVA_NOTE : STRAVA_NOTE, displayOnly: true }
    ];
  }
  /** Field coverage across sessions: which questions can the data answer. */
  const FIELDS = [["distanceKm", "Jarak"], ["durationSec", "Durasi"], ["paceSecPerKm", "Pace"], ["rpe", "Effort (RPE)"], ["hrAvg", "Detak jantung"], ["elevGainM", "Elevasi"], ["startMin", "Jam mulai"]];
  function coverage(sessions) { const n = sessions.length; return FIELDS.map(([k, label]) => ({ k, label, have: sessions.filter(s => s[k] !== null).length, total: n })); }

  G.WRI_COACH_MODEL = { toSession, sessionsFrom, strengthFrom, providers, coverage, FIELDS, STATUS, STRAVA_NOTE };
})(typeof globalThis !== "undefined" ? globalThis : this);
