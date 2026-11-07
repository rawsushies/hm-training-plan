import "../../public/js/schedule.js";
import "../../public/js/logic.js";
import "../../public/js/sync.js";
export const H = globalThis.HMTP;
export const { SyncEngine } = globalThis.HMTPSync;

// Minimal copy of the app's defaults() (kept in sync with public/index.html).
export function defaults() {
  return {
    v: 3, updatedAt: 0,
    settings: { weekday: 1, unit: "km", peakLow: 20, peakHigh: 30, goalTime: "3:30:00", lockedRpe: "6–7", benchKm: 3, theme: "dark", startDate: "2026-11-09", raceDate: "2027-06-13", shareBoard: false, wdTime: "19:30", wkTime: "06:00", defaultShoe: null, notif: H.defaultNotif() },
    overrides: {}, status: {}, locked: {}, elev: {}, logs: [], strength: [], checkins: [], shoes: [], reviews: {}, raceCheck: {},
    goals: { main: { title: "Finish", target: "<3:30" }, items: [{ id: "consist", title: "x", target: 8, unit: "minggu" }] },
    tutorial: { v: 3, quick: false, tours: {}, bannerDismissed: false },
    ui: { tab: "home", calMode: "month", calMonth: "", selDate: "", f: { month: "", type: "", dist: "", sort: "new" }, revBlock: null, lockSel: null, strK: "A", tour: null, tourDone: false, tut: null }
  };
}
export const run = (id, o = {}) => Object.assign({ id, date: "2026-11-10", type: "easy", sessionId: null, distance: 4, duration: 1800, elev: null, hrAvg: null, hrMax: null, rpe: 4, weather: "", notes: "" }, o);
export const ci = (date, o = {}) => Object.assign({ date, sleep: 3, soreness: 2, fatigue: 2, energy: 3, motivation: 3, pain: 1 }, o);

/** In-memory cloud that enforces the same optimistic-concurrency rule as firestore.rules. */
export class FakeCloud {
  constructor() { this.docs = {}; this.subs = []; this.conflicts = []; this.fail = null; this.writes = 0; }
  subscribe(uid, cb) { const s = { uid, cb }; this.subs.push(s); return () => { this.subs = this.subs.filter(x => x !== s); }; }
  async push(uid, items, device) {
    if (this.fail) return items.map(i => ({ key: i.key, error: this.fail }));
    const out = [], changes = [];
    for (const it of items) {
      const k = uid + "|" + it.key, cur = this.docs[k], srev = cur ? cur.rev : 0;
      if (srev !== it.baseRev) { out.push({ key: it.key, conflict: true, server: cur ? JSON.parse(JSON.stringify(cur)) : null }); continue; }
      const doc = { data: it.value === undefined ? null : JSON.parse(JSON.stringify(it.value)), rev: srev + 1, deleted: it.value === undefined, device };
      this.docs[k] = doc; this.writes++;
      out.push({ key: it.key, ok: true, rev: doc.rev });
      changes.push(Object.assign({ key: it.key }, doc));
    }
    // deliver confirmed changes to every listener of this uid (other devices AND the writer's echo)
    for (const s of this.subs.filter(s => s.uid === uid)) s.cb(changes.map(c => Object.assign({}, c, { data: JSON.parse(JSON.stringify(c.data)) })));
    return out;
  }
  async saveConflict(uid, c) { this.conflicts.push(c); }
  all(uid) { const o = {}; for (const [k, v] of Object.entries(this.docs)) if (k.startsWith(uid + "|")) o[k.slice(uid.length + 1)] = v; return o; }
}

/** A simulated device: its own state + engine, like one browser tab. */
export function device(cloud, uid, name, initial) {
  const d = { S: initial || defaults(), online: true };
  d.engine = new SyncEngine({
    cloud, uid, device: name, meta: {},
    getRecords: () => H.stateToRecords(d.S),
    applyRecords: recs => { d.S = H.recordsToState(recs, d.S, defaults); },
    isOnline: () => d.online,
    setTimer: () => 0, clearTimer: () => {}   // tests drive flush() manually
  });
  return d;
}
