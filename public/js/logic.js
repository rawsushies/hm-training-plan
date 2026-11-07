/* Half Marathon Training Plan — pure logic layer (no DOM, no network).
 * Loaded as a classic <script> in the browser and imported by the Node unit tests.
 * Everything here is deterministic and side-effect free so it can be tested in isolation.
 * Exposes globalThis.HMTP.
 */
(function (G) {
  "use strict";

  const SCHEMA = 3;
  const RUN_TYPES = ["easy", "long", "recovery", "locked", "elevation", "benchmark", "race", "other"];
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  // Calendar week 1–60 (a replanned season can be longer than 31 weeks); "ex" = optional 4th run (frequency 4).
  const SID_RE = /^w([1-9]|[1-5][0-9]|60)-(wd|sat|sun|sA|sB|ex)$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^\d{2}:\d{2}$/;
  const validDate = s => typeof s === "string" && DATE_RE.test(s) && !isNaN(new Date(s + "T00:00:00").getTime());
  const isObj = o => !!o && typeof o === "object" && !Array.isArray(o);
  const finite = (v, lo, hi) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && isFinite(+v) && +v >= lo && +v <= hi ? +v : null;
  const str = (v, max) => (v === null || v === undefined) ? "" : String(v).slice(0, max);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Stable JSON + hashing (change detection) ---------- */
  function stableStringify(v) {
    if (v === undefined) return "null";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  }
  // 2 × 32-bit hashes (FNV-1a + djb2) → 16 hex chars. Only used to detect "did this record change".
  function hashOf(v) {
    const s = typeof v === "string" ? v : stableStringify(v);
    let a = 0x811c9dc5, b = 5381;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      a ^= c; a = Math.imul(a, 0x01000193) >>> 0;
      b = (Math.imul(b, 33) + c) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  }
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  /* ---------- Validation of untrusted state (local, cloud, backup files) ----------
   * Re-applies the audit hotfix R3: ids, dates, types and numbers are validated so a crafted
   * backup or cloud document cannot inject markup into data-* / style attributes. */
  function cleanLog(l) {
    if (!isObj(l) || !validDate(l.date)) return null;
    const distance = finite(l.distance, 0, 1000);
    if (distance === null) return null;
    const o = {
      id: ID_RE.test(l.id || "") ? l.id : newId(),
      date: l.date,
      type: RUN_TYPES.includes(l.type) ? l.type : "other",
      sessionId: SID_RE.test(l.sessionId || "") ? l.sessionId : null,
      distance,
      duration: finite(l.duration, 1, 360000),
      elev: finite(l.elev, 0, 20000),
      hrAvg: finite(l.hrAvg, 20, 260),
      hrMax: finite(l.hrMax, 20, 260),
      rpe: finite(l.rpe, 1, 10),
      weather: str(l.weather, 80),
      notes: str(l.notes, 2000)
    };
    if (o.duration !== null) o.duration = Math.round(o.duration);
    if (l.src) o.src = str(l.src, 20);
    if (l.sample) o.sample = true;
    if (ID_RE.test(l.shoeId || "")) o.shoeId = l.shoeId;
    if (l.extId && typeof l.extId === "string") o.extId = l.extId.slice(0, 80);
    return o;
  }
  function cleanStrength(r) {
    if (!isObj(r) || !validDate(r.date) || !["A", "B"].includes(r.kind)) return null;
    const o = { id: ID_RE.test(r.id || "") ? r.id : newId(), date: r.date, kind: r.kind,
      sets: finite(r.sets, 1, 10) || 1, done: Array.isArray(r.done) ? r.done.filter(x => typeof x === "string" && ID_RE.test(x)).slice(0, 20) : [],
      sessionId: SID_RE.test(r.sessionId || "") ? r.sessionId : null };
    if (r.sample) o.sample = true;
    return o;
  }
  const CI_KEYS = ["sleep", "soreness", "fatigue", "energy", "motivation", "pain"];
  function cleanCheckin(c) {
    if (!isObj(c) || !validDate(c.date)) return null;
    const o = { date: c.date };
    for (const k of CI_KEYS) { const v = finite(c[k], 1, 5); if (v === null) return null; o[k] = Math.round(v); }
    if (c.sample) o.sample = true;
    return o;
  }
  function cleanShoe(x) {
    if (!isObj(x)) return null;
    const o = { id: ID_RE.test(x.id || "") ? x.id : newId(), name: str(x.name, 60) || "Sepatu", limit: Math.round(finite(x.limit, 50, 5000) || 700), retired: !!x.retired };
    // v4 optional fields: only present when set, so v3 shoe records stay byte-identical (no sync churn)
    const brand = str(x.brand, 40), model = str(x.model, 60), ik = finite(x.initialKm, 0, 5000);
    if (brand) o.brand = brand;
    if (model) o.model = model;
    if (["daily", "tempo", "long", "race", "trail"].includes(x.use)) o.use = x.use;
    if (ik) o.initialKm = Math.round(ik * 10) / 10;
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.since || "")) o.since = x.since;
    return o;
  }
  function cleanReview(r) {
    if (!isObj(r)) return null;
    const o = {};
    for (const k of ["best", "hard", "rec", "fix"]) o[k] = str(r[k], 4000);
    return o;
  }
  function cleanOverride(o) {
    if (!isObj(o)) return null;
    const r = {};
    if (o.title !== undefined) r.title = str(o.title, 120);
    if (o.desc !== undefined) r.desc = str(o.desc, 1000);
    if (o.dist !== undefined && finite(o.dist, 0, 100) !== null) r.dist = +o.dist;
    if (validDate(o.date)) r.date = o.date;
    return Object.keys(r).length ? r : null;
  }
  function cleanLocked(c) {
    if (!isObj(c)) return null;
    const r = {};
    if (["interval", "tempo", "progression", "pace", "timeattack", "benchmark"].includes(c.kind)) r.kind = c.kind;
    if (c.name !== undefined) r.name = str(c.name, 80);
    if (c.rpe !== undefined) r.rpe = str(c.rpe, 12);
    const nums = { reps: [1, 20], work: [0.5, 60], rest: [0.5, 15], benchKm: [1, 21.1], taKm: [1, 21.1], targetPace: [60, 1800], targetDur: [1, 36000], taTarget: [1, 36000] };
    for (const [k, [lo, hi]] of Object.entries(nums)) {
      if (c[k] === null) r[k] = null;
      else if (c[k] !== undefined && finite(c[k], lo, hi) !== null) r[k] = +c[k];
    }
    return Object.keys(r).length ? r : null;
  }
  function cleanMap(m, keyRe, fn) {
    const out = {};
    if (!isObj(m)) return out;
    for (const [k, v] of Object.entries(m)) { if (!keyRe.test(k)) continue; const c = fn(v); if (c !== null && c !== undefined) out[k] = c; }
    return out;
  }
  function cleanSettings(s, def) {
    const o = Object.assign({}, def);
    if (!isObj(s)) return o;
    if ([0, 1, 3, 4].includes(+s.weekday)) o.weekday = +s.weekday;
    if (["km", "mi"].includes(s.unit)) o.unit = s.unit;
    for (const k of ["peakLow", "peakHigh"]) if (finite(s[k], 1, 200) !== null) o[k] = +s[k];
    if (typeof s.goalTime === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(s.goalTime)) o.goalTime = s.goalTime;
    if (s.lockedRpe !== undefined) o.lockedRpe = str(s.lockedRpe, 12) || def.lockedRpe;
    if (finite(s.benchKm, 1, 21.1) !== null) o.benchKm = +s.benchKm;
    if (["dark", "light", "system"].includes(s.theme)) o.theme = s.theme;
    for (const k of ["startDate", "raceDate"]) if (validDate(s[k])) o[k] = s[k];
    o.shareBoard = !!s.shareBoard;
    for (const k of ["wdTime", "wkTime"]) if (TIME_RE.test(s[k] || "")) o[k] = s[k];
    o.defaultShoe = ID_RE.test(s.defaultShoe || "") ? s.defaultShoe : null;
    o.notif = cleanNotif(s.notif);
    if (ID_RE.test(s.activeEvent || "")) o.activeEvent = s.activeEvent; else delete o.activeEvent;   // absent for v3 users: no settings churn on upgrade
    return o;
  }
  function cleanGoals(g, defGoals) {
    if (!isObj(g) || !isObj(g.main) || !Array.isArray(g.items)) return defGoals;
    const items = defGoals.items.map(d => {
      const it = g.items.find(x => x && x.id === d.id);
      if (!it) return d;
      return { id: d.id, title: str(it.title, 160) || d.title, target: finite(it.target, 0.1, 100000) || d.target, unit: d.unit };
    });
    return { main: { title: str(g.main.title, 160) || defGoals.main.title, target: str(g.main.target, 160) }, items };
  }
  function cleanTutorial(t) {
    const o = { v: 3, quick: false, tours: {}, bannerDismissed: false };
    if (!isObj(t)) return o;
    o.quick = !!t.quick;
    o.bannerDismissed = !!t.bannerDismissed;
    if (isObj(t.tours)) for (const [k, v] of Object.entries(t.tours)) if (ID_RE.test(k) && v) o.tours[k] = true;
    return o;
  }

  /* ---- v4 records ---- */
  function cleanProfile(p) {
    const o = { massKg: null, heightCm: null, age: null, hrMax: null, sweatRate: null, onboarded: false };
    if (!isObj(p)) return o;
    o.massKg = finite(p.massKg, 25, 250); o.heightCm = finite(p.heightCm, 100, 250); o.age = finite(p.age, 10, 100);
    o.hrMax = finite(p.hrMax, 120, 230); o.sweatRate = finite(p.sweatRate, 0.1, 4); o.onboarded = !!p.onboarded;
    return o;
  }
  const RACE_TABS = ["overview", "pace", "splits", "elev", "hydration", "fuel", "hr", "stations", "checklist"];
  function cleanRacePrefs(r) {
    const o = { strategy: "conservative", startDelta: 15, splitPct: 2, custom: null, locked: [], tabs: RACE_TABS.slice(), hidden: [], carbs: null, product: "", gph: null, recent: [], tempC: null, humidity: null, startTime: "05:00", exp: 1.06 };
    if (!isObj(r)) return o;
    if (["even", "conservative", "negative", "positive", "elevation", "custom"].includes(r.strategy)) o.strategy = r.strategy;
    o.startDelta = finite(r.startDelta, 0, 60) ?? 15; o.splitPct = finite(r.splitPct, 0, 8) ?? 2;
    if (Array.isArray(r.custom) && r.custom.length <= 60 && r.custom.every(x => finite(x, 120, 1800) !== null)) o.custom = r.custom.map(Number);
    if (Array.isArray(r.locked)) o.locked = r.locked.filter(x => Number.isInteger(x) && x >= 0 && x < 60).slice(0, 60);
    if (Array.isArray(r.tabs)) { const t = r.tabs.filter(x => RACE_TABS.includes(x)); o.tabs = [...new Set([...t, ...RACE_TABS])]; }
    if (Array.isArray(r.hidden)) o.hidden = r.hidden.filter(x => RACE_TABS.includes(x) && x !== "overview");
    o.carbs = finite(r.carbs, 5, 120); o.product = str(r.product, 60); o.gph = finite(r.gph, 0, 120);
    if (Array.isArray(r.recent)) o.recent = r.recent.filter(x => isObj(x) && finite(x.km, 1, 100) !== null && finite(x.sec, 300, 100000) !== null).slice(0, 10).map(x => ({ km: +x.km, sec: Math.round(+x.sec), date: validDate(x.date) ? x.date : "", label: str(x.label, 40) }));
    o.tempC = finite(r.tempC, -20, 50); o.humidity = finite(r.humidity, 0, 100);
    if (TIME_RE.test(r.startTime || "")) o.startTime = r.startTime;
    o.exp = finite(r.exp, 1.0, 1.15) ?? 1.06;
    if (r.touched) o.touched = true;      // local flag: only saved once the user changed something
    return o;
  }
  function cleanPlanMap(m) {
    if (!isObj(m) || !Array.isArray(m.weeks) || m.weeks.length < 2 || m.weeks.length > 60) return null;
    if (!m.weeks.every(t => Number.isInteger(t) && t >= 1 && t <= 31) || m.weeks[m.weeks.length - 1] !== 31) return null;
    return { weeks: m.weeks.slice(), eventId: ID_RE.test(m.eventId || "") ? m.eventId : null, at: str(m.at, 30), note: str(m.note, 600) };
  }

  /** Validates and normalises any saved state. `defaults()` builds a fresh default state. */
  function sanitizeState(saved, defaults) {
    const d = defaults();
    if (!isObj(saved)) saved = {};          // fresh start: still fill every field (v4 records included)
    const s = d;
    s.settings = cleanSettings(saved.settings, d.settings);
    s.goals = cleanGoals(saved.goals, d.goals);
    s.overrides = cleanMap(saved.overrides, SID_RE, cleanOverride);
    s.status = cleanMap(saved.status, SID_RE, v => v === "skip" ? "skip" : null);
    s.locked = cleanMap(saved.locked, SID_RE, cleanLocked);
    s.elev = cleanMap(saved.elev, SID_RE, v => isObj(v) && finite(v.target, 0, 20000) !== null ? { target: Math.round(+v.target) } : null);
    s.reviews = cleanMap(saved.reviews, /^[0-7]$/, cleanReview);
    s.raceCheck = cleanMap(saved.raceCheck, /^\d{1,2}$/, v => v ? true : null);
    const uniq = (arr, key) => { const seen = new Set(); return arr.filter(x => x && !seen.has(x[key]) && seen.add(x[key])); };
    s.logs = uniq((Array.isArray(saved.logs) ? saved.logs : []).map(cleanLog), "id");
    s.strength = uniq((Array.isArray(saved.strength) ? saved.strength : []).map(cleanStrength), "id");
    s.checkins = uniq((Array.isArray(saved.checkins) ? saved.checkins : []).map(cleanCheckin), "date");
    s.shoes = uniq((Array.isArray(saved.shoes) ? saved.shoes : []).map(cleanShoe), "id");
    if (Array.isArray(saved.badges)) s.badges = saved.badges.filter(x => typeof x === "string" && ID_RE.test(x));
    s.tutorial = cleanTutorial(saved.tutorial);
    const SC = G.WRI_SCHED;
    s.schedule = SC ? SC.cleanSchedule(saved.schedule) : null;
    s.events = SC ? cleanMap(saved.events, ID_RE, SC.cleanEvent) : {};
    const SO = G.WRI_SOCIAL;   // per-friend sharing permissions (private settings; default: share nothing)
    s.shareWith = SO ? cleanMap(saved.shareWith, ID_RE, p => { const c = SO.cleanPerms(p); return SO.anyShared(c) ? c : null; }) : {};
    s.profile = cleanProfile(saved.profile);
    s.racePrefs = cleanRacePrefs(saved.racePrefs);
    s.planMap = cleanPlanMap(saved.planMap);
    s.updatedAt = finite(saved.updatedAt, 0, 1e15) || 0;
    if (isObj(saved.ui)) {
      // UI state is device-local and never synced; keep only harmless known shapes.
      const ui = saved.ui;
      const u = s.ui;
      if (typeof ui.tab === "string" && ID_RE.test(ui.tab)) u.tab = ui.tab;
      if (["month", "week"].includes(ui.calMode)) u.calMode = ui.calMode;
      if (/^\d{4}-\d{2}$/.test(ui.calMonth || "")) u.calMonth = ui.calMonth;
      if (validDate(ui.selDate)) u.selDate = ui.selDate;
      if (isObj(ui.f)) u.f = { month: /^\d{4}-\d{2}$/.test(ui.f.month || "") ? ui.f.month : "", type: RUN_TYPES.includes(ui.f.type) ? ui.f.type : "", dist: ["s", "m", "l"].includes(ui.f.dist) ? ui.f.dist : "", sort: ["new", "fast", "far", "elev"].includes(ui.f.sort) ? ui.f.sort : "new" };
      if (Number.isInteger(ui.revBlock) && ui.revBlock >= 0 && ui.revBlock <= 7) u.revBlock = ui.revBlock;
      if (SID_RE.test(ui.lockSel || "")) u.lockSel = ui.lockSel;
      if (["A", "B"].includes(ui.strK)) u.strK = ui.strK;
      u.tourDone = !!ui.tourDone;
      if (ui.tourV !== undefined) u.tourV = finite(ui.tourV, 0, 99);
      if (["pelan", "rata"].includes(ui.rpStrat)) u.rpStrat = ui.rpStrat;
      if (isObj(ui.run) && Array.isArray(ui.run.steps) && SID_RE.test(ui.run.id || "")) u.run = ui.run;
      if (isObj(ui.tut) && typeof ui.tut.id === "string" && ID_RE.test(ui.tut.id) && Number.isInteger(ui.tut.i)) u.tut = { id: ui.tut.id, i: ui.tut.i };
    }
    s.v = SCHEMA;
    return s;
  }

  /* ---------- Notification preferences (future feature, stored per account) ---------- */
  function defaultNotif() {
    return { enabled: false, workout: true, tips: true, weekly: true, monthly: true, race: true, hydration: false, leadMin: 60,
      wdTime: "07:00", weTime: "07:00", quietStart: "22:00", quietEnd: "06:00", tz: "" };
  }
  function cleanNotif(n) {
    const d = defaultNotif();
    if (!isObj(n)) return d;
    for (const k of ["enabled", "workout", "tips", "weekly", "monthly", "race", "hydration"]) if (typeof n[k] === "boolean") d[k] = n[k];
    if ([15, 30, 60, 90, 120, 180].includes(+n.leadMin)) d.leadMin = +n.leadMin;
    for (const k of ["wdTime", "weTime", "quietStart", "quietEnd"]) if (TIME_RE.test(n[k] || "")) d[k] = n[k];
    if (typeof n.tz === "string" && /^[A-Za-z_+\-/0-9]{0,60}$/.test(n.tz)) d.tz = n.tz;
    return d;
  }

  /* ---------- Record model ----------
   * The training state is split into independent records keyed by their Firestore path
   * (relative to users/{uid}). Each record syncs on its own, so two devices adding runs
   * never overwrite each other. */
  const PLAN_SINGLE = ["settings", "goals", "raceCheck", "tutorial"];
  const PLAN_MAPS = { ovr: "overrides", status: "status", locked: "locked", elev: "elev", event: "events", share: "shareWith" };
  // v4 single records (absent = not set; v3 users have none, which means "keep the v3 behaviour")
  const PLAN_V4 = { schedule: "schedule", profile: "profile", race: "racePrefs", planmap: "planMap" };
  const COLLS = ["runs", "strength", "checkins", "shoes", "reviews", "plan"];

  function syncedSettings(st) { const o = clone(st); return o; }

  function stateToRecords(S) {
    const r = {};
    for (const l of S.logs) r["runs/" + l.id] = l;
    for (const x of S.strength) r["strength/" + x.id] = x;
    for (const c of S.checkins) r["checkins/" + c.date] = c;
    for (const x of S.shoes) r["shoes/" + x.id] = x;
    for (const [b, v] of Object.entries(S.reviews || {})) r["reviews/" + b] = v;
    r["plan/settings"] = syncedSettings(S.settings);
    r["plan/goals"] = S.goals;
    r["plan/raceCheck"] = S.raceCheck || {};
    r["plan/tutorial"] = S.tutorial || cleanTutorial(null);
    for (const [doc, field] of Object.entries(PLAN_V4)) if (S[field] && (field !== "profile" || Object.values(S.profile).some(v => v !== null && v !== false)) && (field !== "racePrefs" || S.racePrefs.touched)) r["plan/" + doc] = field === "racePrefs" ? Object.assign({}, S.racePrefs, { touched: undefined }) : S[field];
    for (const [pre, field] of Object.entries(PLAN_MAPS)) for (const [k, v] of Object.entries(S[field] || {})) r[`plan/${pre}_${k}`] = v;
    return r;
  }
  /** Applies a full set of records onto a state (non-record fields such as ui are kept). */
  function recordsToState(recs, S, defaults) {
    const raw = { settings: recs["plan/settings"], goals: recs["plan/goals"], raceCheck: recs["plan/raceCheck"], tutorial: recs["plan/tutorial"],
      schedule: recs["plan/schedule"], profile: recs["plan/profile"], racePrefs: recs["plan/race"], planMap: recs["plan/planmap"],
      overrides: {}, status: {}, locked: {}, elev: {}, events: {}, shareWith: {}, reviews: {}, logs: [], strength: [], checkins: [], shoes: [] };
    // keep existing array order where possible (stable rendering), append new ones
    const order = { runs: S.logs.map(x => x.id), strength: S.strength.map(x => x.id), checkins: S.checkins.map(x => x.date), shoes: S.shoes.map(x => x.id) };
    const buckets = { runs: [], strength: [], checkins: [], shoes: [] };
    for (const [key, v] of Object.entries(recs)) {
      const i = key.indexOf("/"), coll = key.slice(0, i), id = key.slice(i + 1);
      if (buckets[coll]) buckets[coll].push([id, v]);
      else if (coll === "reviews") raw.reviews[id] = v;
      else if (coll === "plan") {
        const u = id.indexOf("_");
        if (u > 0 && PLAN_MAPS[id.slice(0, u)]) raw[PLAN_MAPS[id.slice(0, u)]][id.slice(u + 1)] = v;
      }
    }
    const sortBy = (coll, arr) => { const ix = new Map(order[coll].map((k, i) => [k, i])); return arr.sort((a, b) => (ix.has(a[0]) ? ix.get(a[0]) : 1e9) - (ix.has(b[0]) ? ix.get(b[0]) : 1e9)).map(x => x[1]); };
    raw.logs = sortBy("runs", buckets.runs); raw.strength = sortBy("strength", buckets.strength);
    raw.checkins = sortBy("checkins", buckets.checkins); raw.shoes = sortBy("shoes", buckets.shoes);
    raw.badges = S.badges; raw.ui = S.ui; raw.updatedAt = S.updatedAt;
    const out = sanitizeState(raw, defaults);
    if (recs["plan/race"]) out.racePrefs.touched = true;
    out.ui = S.ui; // ui is trusted (device-local, already sanitized at load)
    return out;
  }

  /** Which records differ from the last known server state? base[key] = {rev, h, del} */
  function computeDirty(records, base) {
    const dirty = [];
    for (const [k, v] of Object.entries(records)) {
      const b = base[k], h = hashOf(v);
      if (!b || b.del || b.h !== h) dirty.push({ key: k, op: "set", h });
    }
    for (const [k, b] of Object.entries(base)) if (!b.del && !(k in records)) dirty.push({ key: k, op: "del" });
    return dirty;
  }

  /** 3-way merge for object-valued records (settings, goals, tutorial, raceCheck).
   * Fields changed only locally win, fields changed only remotely win; a field changed
   * on both sides to different values keeps the server value and is reported. */
  function merge3(base, local, server) {
    base = base || {}; local = local || {}; server = server || {};
    const out = clone(server), conflicts = [];
    const keys = new Set([...Object.keys(local), ...Object.keys(base)]);
    for (const k of keys) {
      const lb = stableStringify(base[k]), ll = stableStringify(local[k]), ls = stableStringify(server[k]);
      if (ll === lb || ll === ls) continue;          // local unchanged or equal to server
      if (ls === lb) { if (local[k] === undefined) delete out[k]; else out[k] = clone(local[k]); continue; } // only local changed
      conflicts.push({ field: k, local: clone(local[k]), server: clone(server[k]) });
    }
    return { value: out, conflicts };
  }
  const MERGE3_KEYS = new Set(["plan/settings", "plan/goals", "plan/tutorial", "plan/raceCheck", "plan/schedule", "plan/profile", "plan/race"]);

  /**
   * Decide what to do when pushing a dirty record finds the server copy changed since our base.
   *  local: our value (undefined = we deleted it); server: {data, deleted}; baseVal: value at our base (if kept)
   * Returns {write: value|undefined (undefined → keep server), conflict: object|null}
   */
  function resolveConflict(key, local, server, baseVal) {
    const sv = server && !server.deleted ? server.data : undefined;
    if (stableStringify(local) === stableStringify(sv)) return { write: undefined, conflict: null, adopt: true };
    if (MERGE3_KEYS.has(key) && local !== undefined && sv !== undefined && baseVal !== undefined) {
      const m = merge3(baseVal, local, sv);
      return { write: m.value, conflict: m.conflicts.length ? { key, kind: "fields", fields: m.conflicts } : null };
    }
    if (local === undefined) return { write: undefined, conflict: { key, kind: "deleteLost", server: clone(sv) } }; // we deleted, they edited → keep their edit
    if (sv === undefined) return { write: local, conflict: null }; // they deleted, we edited → keep our data (never lose an edit)
    return { write: undefined, conflict: { key, kind: "edit", local: clone(local), server: clone(sv) } }; // both edited → server (first committed) wins, ours kept for recovery
  }

  /* ---------- Merging two whole states (first sign-in / backup import) ---------- */
  const near = (a, b, tol) => a === null || a === undefined || b === null || b === undefined || Math.abs(a - b) <= tol;
  function sameRun(a, b) {
    if (a.extId && b.extId) return a.extId === b.extId;
    return a.date === b.date && Math.abs(a.distance - b.distance) <= 0.15 && near(a.duration, b.duration, 60);
  }
  function countState(S) {
    const real = a => a.filter(x => !x.sample).length;
    return { logs: real(S.logs), strength: real(S.strength), checkins: real(S.checkins), shoes: S.shoes.length,
      reviews: Object.values(S.reviews || {}).filter(r => r && Object.values(r).some(Boolean)).length,
      km: Math.round(S.logs.filter(l => !l.sample).reduce((a, l) => a + l.distance, 0) * 10) / 10 };
  }
  const hasRealData = S => { const c = countState(S); return c.logs + c.strength + c.checkins + c.shoes + c.reviews > 0 || Object.keys(S.overrides || {}).length > 0; };

  /**
   * mergeStates(primary, incoming): primary is the state that wins on settings and on true
   * conflicts (cloud on first sign-in). Nothing from `incoming` is silently dropped: duplicates
   * are counted, unresolvable differences are returned in `conflicts` for the user.
   * Idempotent: merge(merge(a,b), b) === merge(a,b).
   */
  function mergeStates(primary, incoming, defaults) {
    const A = sanitizeState(clone(primary), defaults), B = sanitizeState(clone(incoming), defaults);
    A.ui = primary.ui || A.ui;
    const rep = { logs: { added: 0, dup: 0, unlinked: 0 }, strength: { added: 0, dup: 0 }, checkins: { added: 0, same: 0, conflict: 0 },
      shoes: { added: 0, dup: 0 }, reviews: { added: 0, combined: 0 }, plan: { added: 0 }, settings: "primary" };
    const conflicts = [];
    // runs
    const byId = new Map(A.logs.map(l => [l.id, l]));
    for (const l of B.logs) {
      if (l.sample) continue;
      const ex = byId.get(l.id);
      if (ex) { if (stableStringify(ex) !== stableStringify(l)) conflicts.push({ key: "runs/" + l.id, kind: "edit", local: l, server: ex }); rep.logs.dup++; continue; }
      if (A.logs.some(a => sameRun(a, l))) { rep.logs.dup++; continue; }
      const n = clone(l);
      if (n.sessionId && A.logs.some(a => a.sessionId === n.sessionId)) { n.sessionId = null; rep.logs.unlinked++; }
      A.logs.push(n); byId.set(n.id, n); rep.logs.added++;
    }
    // strength
    const sIds = new Set(A.strength.map(r => r.id));
    for (const r of B.strength) {
      if (r.sample) continue;
      if (sIds.has(r.id)) { rep.strength.dup++; continue; }
      const twin = A.strength.find(a => a.date === r.date && a.kind === r.kind && (a.sessionId || null) === (r.sessionId || null));
      if (twin) { twin.done = [...new Set([...twin.done, ...r.done])]; twin.sets = Math.max(twin.sets, r.sets); rep.strength.dup++; continue; }
      const n = clone(r);
      if (n.sessionId && A.strength.some(a => a.sessionId === n.sessionId)) n.sessionId = null;
      A.strength.push(n); sIds.add(n.id); rep.strength.added++;
    }
    // check-ins (one per date)
    for (const c of B.checkins) {
      if (c.sample) continue;
      const ex = A.checkins.find(a => a.date === c.date);
      if (!ex) { A.checkins.push(clone(c)); rep.checkins.added++; }
      else if (CI_KEYS.every(k => ex[k] === c[k])) rep.checkins.same++;
      else { rep.checkins.conflict++; conflicts.push({ key: "checkins/" + c.date, kind: "edit", local: c, server: ex }); }
    }
    // shoes (ids kept so log.shoeId stays valid)
    const shIds = new Set(A.shoes.map(x => x.id));
    for (const x of B.shoes) { if (shIds.has(x.id)) { rep.shoes.dup++; continue; } A.shoes.push(clone(x)); shIds.add(x.id); rep.shoes.added++; }
    // reviews: never lose notes — combine differing text per field
    for (const [b, r] of Object.entries(B.reviews)) {
      const ex = A.reviews[b];
      if (!ex) { A.reviews[b] = clone(r); rep.reviews.added++; continue; }
      let changed = false;
      for (const k of ["best", "hard", "rec", "fix"]) {
        const x = (ex[k] || "").trim(), y = (r[k] || "").trim();
        if (y && x !== y && !x.includes(y)) { ex[k] = x ? `${x}\n— dari perangkat lain: ${y}` : y; changed = true; }
      }
      if (changed) rep.reviews.combined++;
    }
    // plan maps: union, primary wins per key
    for (const f of ["overrides", "status", "locked", "elev", "events"]) for (const [k, v] of Object.entries(B[f] || {})) { A[f] = A[f] || {}; if (!(k in A[f])) { A[f][k] = clone(v); rep.plan.added++; } }
    for (const f of ["schedule", "planMap"]) if (!A[f] && B[f]) A[f] = clone(B[f]);
    for (const k of Object.keys(A.profile || {})) if ((A.profile[k] === null || A.profile[k] === false) && B.profile && B.profile[k] !== null && B.profile[k] !== undefined) A.profile[k] = B.profile[k];
    for (const [k, v] of Object.entries(B.raceCheck)) if (v) A.raceCheck[k] = true;
    for (const [k, v] of Object.entries(B.tutorial.tours)) if (v) A.tutorial.tours[k] = true;
    A.tutorial.quick = A.tutorial.quick || B.tutorial.quick;
    if (!A.settings.defaultShoe && B.settings.defaultShoe && shIds.has(B.settings.defaultShoe)) A.settings.defaultShoe = B.settings.defaultShoe;
    return { state: A, report: rep, conflicts };
  }

  /* ---------- Backup round-trip check (before any migration) ---------- */
  function verifyBackup(json, S, defaults) {
    try {
      const o = JSON.parse(json), r = sanitizeState(o, defaults), a = countState(r), b = countState(S);
      return a.logs === b.logs && a.strength === b.strength && a.checkins === b.checkins && a.shoes === b.shoes;
    } catch (e) { return false; }
  }

  /* ---------- Local storage layout (v3) ----------
   *  hmtp:device:v3          device prefs: {legacyMigrated, deviceId}
   *  hmtp:anon:v3            state when nobody is signed in
   *  hmtp:user:{uid}:v3      state cache for one Firebase account
   *  hmtp:sync:{uid}:v3      sync metadata for that account (base revisions, conflicts, last sync)
   *  hmtp:backup:{ts}        automatic pre-migration backups (never offered for merge)
   *  hmtp:v1, hmtp:v1:*      legacy keys: read once, never modified or deleted
   */
  const KEYS = {
    device: "hmtp:device:v3", anon: "hmtp:anon:v3",
    user: uid => `hmtp:user:${uid}:v3`, sync: uid => `hmtp:sync:${uid}:v3`, backup: ts => `hmtp:backup:${ts}`
  };
  const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;

  /** One-time move of legacy hmtp:v1 data into the anonymous v3 slot. `ls` is a Storage-like object. */
  function migrateLegacyStorage(ls) {
    const dev = safeParse(ls.getItem(KEYS.device)) || {};
    const res = { moved: false, legacyKeys: [] };
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k === "hmtp:v1" || (k && k.startsWith("hmtp:v1:"))) res.legacyKeys.push(k); }
    res.legacyKeys.sort();
    if (!dev.legacyMigrated) {
      const legacy = ls.getItem("hmtp:v1");
      if (legacy && !ls.getItem(KEYS.anon)) {
        const o = safeParse(legacy);
        if (o && typeof o === "object") { delete o.owner; ls.setItem(KEYS.anon, JSON.stringify(Object.assign(o, { migratedFrom: "hmtp:v1" }))); res.moved = true; }
      }
      dev.legacyMigrated = true;
    }
    if (!dev.deviceId) dev.deviceId = newId() + newId();
    ls.setItem(KEYS.device, JSON.stringify(dev));
    res.device = dev;
    return res;
  }
  function safeParse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  /* ---------- Tutorial version policy ---------- */
  /** Returns "auto" (start quick start now), "banner" (offer v3 to v2 graduates) or "none". */
  function tutorialStartMode(S) {
    const t = S.tutorial || {};
    if (t.quick) return "none";
    if (S.ui && S.ui.tourDone && S.ui.tourV === 2) return t.bannerDismissed ? "none" : "banner";
    if (S.ui && S.ui.tourDone) return t.bannerDismissed ? "none" : "banner";
    return "auto";
  }

  /* ---------- Reminder plan (notification-ready; nothing is scheduled by this function) ---------- */
  const toMin = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  function inQuiet(min, qs, qe) { const a = toMin(qs), b = toMin(qe); if (a === b) return false; return a < b ? (min >= a && min < b) : (min >= a || min < b); }
  const localDate = (ymdStr, hm) => { const [y, mo, d] = ymdStr.split("-").map(Number); const [h, mi] = (hm || "00:00").split(":").map(Number); return new Date(y, mo - 1, d, h, mi, 0, 0); };
  const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtK = v => (Math.round(v * 10) / 10).toString().replace(".", ",");
  const TIP_BY_KIND = {
    base: "Minggu ini semua lari santai. Jaga RPE 3–4, masih bisa ngobrol.",
    locked: "Minggu ini ada sesi locked-in. Pemanasan dulu, dan jaga pace yang udah disepakati.",
    elevation: "Minggu ini ada sesi elevation. Jaga effort di tanjakan supaya pemulihan tetap terkontrol.",
    benchmark: "Minggu ringan + benchmark. Bukan lomba, cukup di pace target yang terkontrol.",
    taper1: "Taper dimulai. Jarak turun, tidur jadi prioritas.", taper2: "Taper: semua lari santai, jaga kaki tetap segar.",
    taper3: "Taper terakhir sebelum race week. Tanpa tes.", race: "Race week! Lari pendek santai, siapin perlengkapan dari jauh hari."
  };
  /**
   * buildReminders({sessions, weeks, logs, prefs, now, horizonDays})
   *  sessions: [{id,date,time,title,dist,type,night}] (from the real plan)
   *  weeks: [{n,start,end,kind,total,block}]
   * Returns reminders sorted by time: {id, cat, at: Date, title, body}.
   * Analysis reminders only describe weeks that are already over (real logged data, no invention).
   */
  function buildReminders({ sessions, weeks, logs, prefs, now, horizonDays = 7, event = null }) {
    const p = cleanNotif(prefs), out = [];
    if (!p.enabled) return out;
    const end = new Date(now.getTime() + horizonDays * 864e5);
    const push = (r) => {
      let at = r.at; const m = at.getHours() * 60 + at.getMinutes();
      if (inQuiet(m, p.quietStart, p.quietEnd)) {
        // move to the end of quiet hours (same or next day); drop if that passes the deadline
        const q = toMin(p.quietEnd); const moved = new Date(at); moved.setHours(Math.floor(q / 60), q % 60, 0, 0);
        if (moved < at) moved.setDate(moved.getDate() + 1);
        if (r.deadline && moved >= r.deadline) return;
        at = moved;
      }
      if (at <= now || at > end) return;
      out.push({ id: r.id, cat: r.cat, at, title: r.title, body: r.body });
    };
    const dayTime = d => (d.getDay() === 0 || d.getDay() === 6) ? p.weTime : p.wdTime;
    if (p.workout) for (const s of sessions) {
      if (s.type === "strength" || s.done || s.skipped) continue;
      const start = localDate(s.date, s.time);
      if (start <= now || start > new Date(end.getTime() + 864e5)) continue;
      const what = `${s.title}${s.dist ? " " + fmtK(s.dist) + " km" : ""}`;
      push({ id: `pre:${s.id}`, cat: "workout", at: new Date(start.getTime() - p.leadMin * 6e4), deadline: start, title: `Workout jam ${s.time}`, body: `${what} mulai pukul ${s.time}.` });
      const eve = new Date(start); eve.setDate(eve.getDate() - 1); const [h, mi] = dayTime(eve).split(":").map(Number); eve.setHours(h, mi, 0, 0);
      const prep = s.type === "long" || s.type === "race" ? " Siapkan sepatu dan perlengkapanmu." : s.type === "recovery" ? " Santai aja, ini lari pemulihan." : "";
      push({ id: `eve:${s.id}`, cat: "workout", at: eve, deadline: start, title: "Besok ada latihan", body: `Besok ${what}.${prep}` });
    }
    if (p.hydration) for (const s of sessions) {
      if (!(s.type === "long" || s.type === "race") || s.done || s.skipped) continue;
      const start = localDate(s.date, s.time);
      const what = `${s.title}${s.dist ? " " + fmtK(s.dist) + " km" : ""}`;
      push({ id: `hyd:${s.id}`, cat: "hydration", at: new Date(start.getTime() - 90 * 6e4), deadline: start, title: "Minum dulu sebelum lari", body: `${what} jam ${s.time}. Minum secukupnya sekarang, dan bawa air kalau larinya lebih dari 60 menit.` });
    }
    if (p.race && event && /^\d{4}-\d{2}-\d{2}$/.test(event.date || "")) {
      const nm = String(event.name || "Race").slice(0, 60);
      for (const d of [28, 14, 7, 3, 1]) {
        const day = localDate(event.date, "00:00"); day.setDate(day.getDate() - d);
        const [h, mi] = dayTime(day).split(":").map(Number); day.setHours(h, mi, 0, 0);
        const body = d === 1 ? `Besok ${nm}! Siapkan nomor BIB, sepatu, dan sarapan yang udah biasa kamu makan. Tidur lebih awal.`
          : d === 3 ? `${nm} 3 hari lagi. Lari pendek santai aja, cek perlengkapan dan rencana pace di tab Race.`
          : d === 7 ? `${nm} seminggu lagi. Race week: kurangi volume, jaga tidur, jangan coba sepatu atau makanan baru.`
          : `${nm} ${d} hari lagi.${event.distanceKm ? " Jarak " + fmtK(event.distanceKm) + " km." : ""} Cek rencana race kamu.`;
        push({ id: `race:${event.id || "ev"}:${d}`, cat: "race", at: day, title: d === 1 ? "Race besok" : `${d} hari menuju race`, body });
      }
    }
    if (p.tips) for (const w of weeks) {
      const mon = localDate(w.start, p.wdTime);
      push({ id: `tip:w${w.n}`, cat: "tips", at: mon, title: `Week ${w.n}`, body: TIP_BY_KIND[w.kind] || "" });
    }
    if (p.weekly) for (let i = 1; i < weeks.length + 1; i++) {
      const w = weeks[i - 1], nextMon = new Date(localDate(w.end, p.weTime).getTime()); nextMon.setDate(nextMon.getDate() + 1);
      const [h, mi] = p.wdTime.split(":").map(Number); nextMon.setHours(h, mi, 0, 0);
      if (nextMon <= now || nextMon > end) continue;
      const wk = logs.filter(l => !l.sample && l.date >= w.start && l.date <= w.end), km = wk.reduce((a, l) => a + l.distance, 0);
      const prev = weeks[i - 2], pk = prev ? logs.filter(l => !l.sample && l.date >= prev.start && l.date <= prev.end).reduce((a, l) => a + l.distance, 0) : null;
      let body = `Week ${w.n}: ${wk.length} lari, ${fmtK(km)} dari ${fmtK(w.total)} km target.`;
      if (pk !== null && wk.length) body += km > pk + 0.5 ? ` Naik ${fmtK(km - pk)} km dari minggu sebelumnya.` : km < pk - 0.5 ? ` Turun ${fmtK(pk - km)} km dari minggu sebelumnya.` : " Mirip minggu sebelumnya.";
      const longest = logs.filter(l => !l.sample).reduce((a, l) => Math.max(a, l.distance), 0), wl = wk.reduce((a, l) => Math.max(a, l.distance), 0);
      if (wl > 0 && wl >= longest && logs.filter(l => !l.sample && l.date < w.start).length) body += ` Lari ${fmtK(wl)} km jadi yang terjauh sejauh ini.`;
      push({ id: `wk:w${w.n}`, cat: "weekly", at: nextMon, title: "Weekly recap kamu sudah siap", body });
    }
    if (p.monthly) for (const w of weeks) {
      if (w.n % 4 !== 0 && w.n !== 31) continue;
      const d = localDate(w.end, p.weTime); d.setDate(d.getDate() + 1); const [h, mi] = p.wdTime.split(":").map(Number); d.setHours(h, mi, 0, 0);
      push({ id: `mo:b${w.block}`, cat: "monthly", at: d, title: "Review bulanan siap", body: "Bulan latihan selesai. Buka Review buat lihat rangkumannya dan isi catatanmu." });
    }
    return out.sort((a, b) => a.at - b.at);
  }

  const API = { SCHEMA, RUN_TYPES, ID_RE, SID_RE, UID_RE, KEYS, COLLS, stableStringify, hashOf, clone, sanitizeState, cleanLog, cleanCheckin,
    stateToRecords, recordsToState, computeDirty, merge3, resolveConflict, mergeStates, sameRun, countState, hasRealData, verifyBackup,
    migrateLegacyStorage, safeParse, tutorialStartMode, defaultNotif, cleanNotif, buildReminders, inQuiet, MERGE3_KEYS, cleanProfile, cleanRacePrefs, cleanPlanMap, RACE_TABS };
  G.HMTP = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
