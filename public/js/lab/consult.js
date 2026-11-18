/* RUNLAB consultation contract (M4, credential-gated). Exposes globalThis.WRI_CONSULT. Pure; makes NO network calls.
 * The app never talks to an LLM provider directly. A future server adapter (functions/runlab-consult.js, not deployed)
 * verifies the Firebase ID token, enforces budgets and validates output with validateFinding() below.
 * Until an endpoint is configured, status() is "not-configured" and the UI says so. No mock answer exists anywhere.
 */
(function (G) {
  "use strict";
  const SCHEMA = 1;
  /** Runtime status. endpoint comes from a future owner setting; there is none today. */
  function status(cfg) { return cfg && typeof cfg.endpoint === "string" && /^https:\/\//.test(cfg.endpoint) ? "configured" : "not-configured"; }

  const CATEGORIES = [
    { k: "question", l: "Pertanyaan & jawabanmu di investigasi ini" },
    { k: "results", l: "Hasil analisis (angka ringkasan, tanpa ID lari)" },
    { k: "runs", l: "Ringkasan lari dalam cakupan: tanggal, jarak, durasi, jenis sesi" },
    { k: "hr", l: "Detak jantung rata-rata (kalau ada)" },
    { k: "sources", l: "Sumber riset yang tersimpan (judul + ID)" }
  ];
  /**
   * Minimal payload the user could consent to. Never includes: notes, names, email, GPS/routes, check-in pain notes,
   * friends data, or any Strava-origin run (Strava terms prohibit AI use). Returns {payload, excluded:{strava, notes}}.
   */
  function buildPayload(inv, state, results, allowed) {
    const ok = k => (allowed || []).includes(k), runs = (state.logs || []).filter(l => !l.sample);
    const scopeIds = new Set((results || []).flatMap(r => r.includedRecordIds || []));
    const strava = runs.filter(l => scopeIds.has(l.id) && (/strava/i.test(l.src || "") || /^strava:/.test(l.extId || "")));
    const usable = runs.filter(l => scopeIds.has(l.id) && !strava.includes(l));
    const payload = { schemaVersion: SCHEMA, type: inv.type };
    if (ok("question")) payload.question = { text: inv.questionEdited || inv.question, answers: Object.fromEntries(Object.entries(inv.answers || {}).map(([k, a]) => [k, a.state === "answered" ? a.v : a.state])) };
    if (ok("results")) payload.results = (results || []).map(r => ({ analysisId: r.analysisId, methodVersion: r.methodVersion, n: r.n, adequacy: r.adequacy, metrics: JSON.parse(JSON.stringify(r.metrics, (k, v) => (k === "ids" || k === "includedRecordIds" || k === "flags") ? undefined : v)), limitations: r.limitations }));
    if (ok("runs")) payload.runs = usable.map(l => Object.assign({ date: l.date, km: l.distance, sec: l.duration || null, type: l.type }, ok("hr") && l.hrAvg ? { hrAvg: l.hrAvg } : {}));
    if (ok("sources")) payload.sources = (inv.sources || []).map(s => ({ id: s.id, title: s.title, year: s.year, kind: s.kind }));
    return { payload, excluded: { strava: strava.length, notes: true } };
  }

  const DIAG = /\b(you have|kamu (menderita|mengalami|terkena)|diagnos|stress fracture|fraktur|tendinitis|tendinopati|overtraining syndrome|safe to run|aman untuk lari|injury risk of|risiko cedera \d)/i;
  const CONF = ["high", "moderate", "low", "insufficient", "speculative"];
  /**
   * Validate a provider response (LabFinding v1). Rejects: wrong shape, citations not returned by the research layer,
   * diagnosis/clearance language, missing required sections. Returns {ok, errors[], finding}.
   */
  function validateFinding(f, sourceIds) {
    const errors = [], ids = new Set(sourceIds || []), arr = (x, k) => Array.isArray(x[k]) ? x[k] : (errors.push(`missing ${k}`), []);
    if (!f || typeof f !== "object") return { ok: false, errors: ["not an object"], finding: null };
    if (f.schemaVersion !== SCHEMA) errors.push("schemaVersion");
    for (const k of ["question", "conciseSummary"]) if (typeof f[k] !== "string" || !f[k].trim()) errors.push(`missing ${k}`);
    arr(f, "observations").forEach((o, i) => { if (!["user-data", "user-report", "calculation"].includes(o.source)) errors.push(`observation ${i} source`); });
    arr(f, "research").forEach((r, i) => { if (!ids.has(r.sourceId)) errors.push(`research ${i}: citation ${r.sourceId} was not returned by the research layer`); });
    arr(f, "hypotheses").forEach((h, i) => { if (!CONF.includes(h.confidence)) errors.push(`hypothesis ${i} confidence`); });
    arr(f, "unknowns"); arr(f, "confounders");
    const text = JSON.stringify(f);
    if (DIAG.test(text)) errors.push("diagnostic or clearance language is not allowed");
    return { ok: !errors.length, errors, finding: errors.length ? null : f };
  }

  G.WRI_CONSULT = { SCHEMA, CATEGORIES, status, buildPayload, validateFinding };
})(typeof globalThis !== "undefined" ? globalThis : this);
