/* Record-level sync engine (classic script; also imported by Node unit tests with a fake cloud).
 *
 * Model: every record (one run, one check-in, the settings, one session override, ...) has a
 * server revision. The engine remembers, per record, the revision + content hash it last agreed on
 * with the server ("base"). A record is dirty when its local hash differs from its base.
 *  - push: dirty records are written with rev = base.rev + 1. The Firestore rules reject a write
 *          whose base is stale, so two devices can never silently overwrite each other.
 *  - pull: server changes are applied to records that are NOT dirty locally. A dirty record that
 *          also changed on the server becomes a conflict at push time and is resolved by
 *          HMTP.resolveConflict (losing version kept in conflicts, never discarded).
 * Offline: nothing is lost; dirty records stay dirty in localStorage and are pushed on reconnect.
 */
(function (G) {
  "use strict";
  const H = G.HMTP;

  class SyncEngine {
    /**
     * opts: { cloud, uid, device, meta, saveMeta(meta), getRecords(), applyRecords(recs, info), onStatus(st), isOnline(), setTimer, clearTimer }
     */
    constructor(opts) {
      this.o = opts;
      this.meta = Object.assign({ base: {}, conflicts: [], lastSync: null }, opts.meta || {});
      this.busy = false; this.again = false; this.timer = null; this.retry = 0; this.stopped = false;
      this.status = { state: "idle", pending: 0, lastSync: this.meta.lastSync, err: "" };
      this.setTimer = opts.setTimer || ((f, ms) => setTimeout(f, ms));
      this.clearTimer = opts.clearTimer || (t => clearTimeout(t));
    }
    emit(patch) { Object.assign(this.status, patch); this.o.onStatus && this.o.onStatus(Object.assign({}, this.status)); }
    save() { this.o.saveMeta && this.o.saveMeta(this.meta); }
    dirty() { return H.computeDirty(this.o.getRecords(), this.meta.base); }
    pendingCount() { return this.dirty().length; }
    baseEntry(key, data, rev, deleted) {
      const e = { rev, h: deleted ? "" : H.hashOf(data) };
      if (deleted) e.del = true;
      if (!deleted && H.MERGE3_KEYS.has(key)) e.v = H.clone(data);
      return e;
    }
    /** Seed the base from a full server snapshot (used right after first sign-in / migration). */
    seed(serverRecs) {
      this.meta.base = {};
      for (const [k, r] of Object.entries(serverRecs)) this.meta.base[k] = this.baseEntry(k, r.data, r.rev, r.deleted);
      this.save();
    }
    start() {
      this.stopped = false;
      if (this.o.cloud.subscribe) this.unsub = this.o.cloud.subscribe(this.o.uid, ch => this.onRemote(ch), e => this.emit({ state: "error", err: (e && e.code) || "listen" }));
      this.schedule(0);
    }
    stop() { this.stopped = true; if (this.unsub) this.unsub(); this.unsub = null; this.clearTimer(this.timer); }
    schedule(ms = 1200) {
      if (this.stopped) return;
      this.clearTimer(this.timer);
      this.emit({ pending: this.pendingCount() });
      this.timer = this.setTimer(() => this.flush(), ms);
    }
    /** Apply confirmed server changes to records that are not dirty locally. */
    onRemote(changes) {
      const recs = this.o.getRecords(); let changed = 0;
      for (const ch of changes) {
        const b = this.meta.base[ch.key], local = recs[ch.key];
        if (b && ch.rev <= b.rev) continue;                          // our own echo or an old event
        const localDirty = local === undefined ? !!(b && !b.del) : (!b || b.del || b.h !== H.hashOf(local));
        const sameAsServer = ch.deleted ? local === undefined : (local !== undefined && H.hashOf(local) === H.hashOf(ch.data));
        if (!localDirty || sameAsServer) {
          if (!sameAsServer) { if (ch.deleted) delete recs[ch.key]; else recs[ch.key] = ch.data; changed++; }
          this.meta.base[ch.key] = this.baseEntry(ch.key, ch.data, ch.rev, ch.deleted);
        }
        // else: dirty locally and different on server → conflict handled by the next push
      }
      this.save();
      if (changed) this.o.applyRecords(recs, { remote: true, n: changed });
      this.emit({ pending: this.pendingCount() });
      if (this.dirty().length) this.schedule(300);
    }
    async flush() {
      if (this.stopped) return;
      if (this.busy) { this.again = true; return; }
      if (this.o.isOnline && !this.o.isOnline()) { this.emit({ state: "offline", pending: this.pendingCount() }); return; }
      this.busy = true;
      try {
        for (let round = 0; round < 4; round++) {
          const recs = this.o.getRecords(), dirty = H.computeDirty(recs, this.meta.base);
          if (!dirty.length) break;
          this.emit({ state: "syncing", pending: dirty.length });
          const items = dirty.map(d => ({ key: d.key, value: d.op === "del" ? undefined : recs[d.key], baseRev: (this.meta.base[d.key] || {}).rev || 0 }));
          const res = await this.o.cloud.push(this.o.uid, items, this.o.device);
          let errors = 0, localChanged = false, offline = false;
          for (const r of res) {
            const it = items.find(i => i.key === r.key);
            if (r.ok) { this.meta.base[r.key] = this.baseEntry(r.key, it.value, r.rev, it.value === undefined); continue; }
            if (r.error) { errors++; if (r.error === "unavailable" || r.error === "deadline-exceeded") offline = true; this.lastError = r.error; continue; }
            // conflict: server changed since our base
            const srv = r.server || { data: null, rev: 0, deleted: true };
            const baseVal = (this.meta.base[r.key] || {}).v;
            const dec = H.resolveConflict(r.key, it.value, r.server ? srv : null, baseVal);
            this.meta.base[r.key] = this.baseEntry(r.key, srv.data, srv.rev, srv.deleted);
            if (dec.write !== undefined) { recs[r.key] = dec.write; localChanged = true; }        // stays dirty → pushed next round on top of server rev
            else { if (srv.deleted) delete recs[r.key]; else recs[r.key] = srv.data; localChanged = true; }
            if (dec.conflict) {
              const c = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString() }, dec.conflict);
              this.meta.conflicts.push(c); this.meta.conflicts = this.meta.conflicts.slice(-50);
              try { await this.o.cloud.saveConflict(this.o.uid, c, this.o.device); } catch (e) { /* kept locally anyway */ }
            }
          }
          this.save();
          if (localChanged) this.o.applyRecords(recs, { remote: true, conflict: true });
          if (errors) {
            this.retry = Math.min(this.retry + 1, 6);
            this.emit({ state: offline ? "offline" : "error", err: this.lastError, pending: this.pendingCount() });
            this.busy = false;
            this.timer = this.setTimer(() => this.flush(), Math.min(60000, 2000 * 2 ** this.retry));
            return;
          }
        }
        this.retry = 0;
        const pending = this.pendingCount();
        this.meta.lastSync = new Date().toISOString(); this.save();
        this.emit({ state: pending ? "error" : "synced", pending, lastSync: this.meta.lastSync, err: pending ? "loop" : "" });
      } catch (e) {
        this.retry = Math.min(this.retry + 1, 6);
        const code = (e && e.code) || "unknown";
        this.emit({ state: code === "unavailable" ? "offline" : "error", err: code, pending: this.pendingCount() });
        this.timer = this.setTimer(() => this.flush(), Math.min(60000, 2000 * 2 ** this.retry));
      }
      this.busy = false;
      if (this.again) { this.again = false; this.schedule(200); }
    }
    /** Resolve a stored conflict: "mine" re-applies the losing local version as a new edit. */
    resolveStored(id, choice) {
      const c = this.meta.conflicts.find(x => x.id === id); if (!c) return null;
      this.meta.conflicts = this.meta.conflicts.filter(x => x.id !== id); this.save();
      if (choice !== "mine") return null;
      const recs = this.o.getRecords();
      if (c.kind === "fields") { const cur = Object.assign({}, recs[c.key]); c.fields.forEach(f => { if (f.local === undefined || f.local === null) delete cur[f.field]; else cur[f.field] = f.local; }); recs[c.key] = cur; }
      else if (c.kind === "deleteLost") delete recs[c.key];
      else if (c.local !== undefined && c.local !== null) recs[c.key] = c.local;
      this.o.applyRecords(recs, { remote: false });
      this.schedule(100);
      return c;
    }
  }
  G.HMTPSync = { SyncEngine };
})(typeof globalThis !== "undefined" ? globalThis : this);
