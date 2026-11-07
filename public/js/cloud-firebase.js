/* Firebase cloud adapter (ES module, loaded on demand by the app only when a Firebase config exists).
 *
 * Responsibilities: Google sign-in (Firebase Auth), record-level reads/writes for the private
 * training data, and group sharing. It has NO knowledge of the app's UI; app code talks to it
 * through the small interface returned by createCloud(). A future native (Capacitor) Android shell
 * can sign in with the native Google SDK and pass the ID token to signInWithGoogleIdToken().
 */
const V = "12.19.0";
const base = new URL(`../vendor/firebase/${V}/`, import.meta.url).href;
const [{ initializeApp }, A, F] = await Promise.all([
  import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")
]);

const PATH_RE = /^(runs|strength|checkins|shoes|reviews|plan)\/[A-Za-z0-9_-]{1,60}$/;
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const rand = bytes => { const b = crypto.getRandomValues(new Uint8Array(bytes)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const userOf = u => u ? { uid: u.uid, displayName: u.displayName || "", email: u.email || "", photoURL: u.photoURL || "" } : null;
const safePhoto = u => /^https:\/\/[^"<> ]+$/.test(u || "") && u.length <= 600 ? u : "";

export async function createCloud(config, opts = {}) {
  const app = initializeApp(config, opts.appName || "hmtp");
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);                       // memory cache: the app keeps its own per-account offline store
  if (opts.emulator) {
    A.connectAuthEmulator(auth, `http://${opts.emulator.auth || "127.0.0.1:9099"}`, { disableWarnings: true });
    F.connectFirestoreEmulator(db, ...(opts.emulator.firestore || "127.0.0.1:8080").split(":").map((x, i) => i ? +x : x));
  }
  await A.setPersistence(auth, A.browserLocalPersistence).catch(() => {});
  auth.languageCode = "id";
  const provider = new A.GoogleAuthProvider();

  // Finish a redirect sign-in if one was in flight (popup-blocked fallback).
  let redirectError = null;
  try { await A.getRedirectResult(auth); } catch (e) { redirectError = e; }

  const userRef = uid => F.doc(db, "users", uid);
  const recRef = (uid, key) => { if (!PATH_RE.test(key)) throw new Error("bad key " + key); const [c, id] = key.split("/"); return F.doc(db, "users", uid, c, id); };
  const envelope = (value, rev, device) => ({ data: value === undefined ? null : value, rev, deleted: value === undefined, updatedAt: F.serverTimestamp(), device });

  const api = {
    kind: "firebase",
    redirectError,
    currentUser: () => userOf(auth.currentUser),
    onAuth(cb) { return A.onAuthStateChanged(auth, u => cb(userOf(u)), () => cb(null)); },

    /* ---------- Auth ---------- */
    async signInGoogle({ selectAccount = false, forceRedirect = false } = {}) {
      provider.setCustomParameters(selectAccount ? { prompt: "select_account" } : {});
      if (forceRedirect) { await A.signInWithRedirect(auth, provider); return null; }
      try { return userOf((await A.signInWithPopup(auth, provider)).user); }
      catch (e) {
        // Popups are often blocked in in-app browsers / some WebViews; fall back to a full-page redirect.
        if (e && ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) {
          await A.signInWithRedirect(auth, provider); return null;
        }
        throw e;
      }
    },
    /** Native Android (Capacitor) or test path: exchange a Google ID token for a Firebase session. */
    async signInWithGoogleIdToken(idToken) {
      return userOf((await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(idToken))).user);
    },
    async signOut() { await A.signOut(auth); },

    /* ---------- Private records ---------- */
    async getUserDoc(uid) { const s = await F.getDoc(userRef(uid)); return s.exists() ? s.data() : null; },
    async setUserDoc(uid, patch) {
      const p = Object.assign({}, patch, { updatedAt: F.serverTimestamp() });
      if (p.profile) p.profile = { displayName: String(p.profile.displayName || "").slice(0, 120), photoURL: safePhoto(p.profile.photoURL) };
      await F.setDoc(userRef(uid), p, { merge: true });
    },
    /** All records of the account: {key: {data, rev, deleted}} */
    async fetchAll(uid) {
      const out = {};
      await Promise.all(["runs", "strength", "checkins", "shoes", "reviews", "plan"].map(async c => {
        const qs = await F.getDocs(F.collection(db, "users", uid, c));
        qs.forEach(d => { const x = d.data(); out[`${c}/${d.id}`] = { data: x.data, rev: x.rev, deleted: !!x.deleted }; });
      }));
      return out;
    },
    /** Live updates: cb([{key,data,rev,deleted}]) for changes confirmed by the server. */
    subscribe(uid, cb, onErr) {
      const unsubs = ["runs", "strength", "checkins", "shoes", "reviews", "plan"].map(c =>
        F.onSnapshot(F.collection(db, "users", uid, c), qs => {
          if (qs.metadata.hasPendingWrites) return;
          const ch = qs.docChanges().filter(x => x.type !== "removed").map(x => { const d = x.doc.data(); return { key: `${c}/${x.doc.id}`, data: d.data, rev: d.rev, deleted: !!d.deleted }; });
          if (ch.length) cb(ch, c);
        }, e => onErr && onErr(e)));
      return () => unsubs.forEach(u => u());
    },
    /**
     * Push dirty records. items: [{key, value (undefined = delete), baseRev}].
     * Fast path: batched writes; the security rules only accept rev == server rev + 1, so a batch
     * containing a stale record is rejected as a whole. Then every record of that batch is retried in
     * its own transaction to find out exactly which ones conflict.
     * Returns [{key, ok:true, rev} | {key, conflict:true, server:{data,rev,deleted}|null} | {key, error}]
     */
    async push(uid, items, device) {
      const results = [];
      for (const part of chunk(items, 200)) {
        const b = F.writeBatch(db);
        part.forEach(it => b.set(recRef(uid, it.key), envelope(it.value, it.baseRev + 1, device)));
        try { await b.commit(); part.forEach(it => results.push({ key: it.key, ok: true, rev: it.baseRev + 1 })); continue; }
        catch (e) { if (e && e.code !== "permission-denied") { part.forEach(it => results.push({ key: it.key, error: e.code || "unknown" })); continue; } }
        for (const it of part) {
          try {
            const r = await F.runTransaction(db, async tx => {
              const ref = recRef(uid, it.key), snap = await tx.get(ref);
              const srev = snap.exists() ? snap.data().rev : 0;
              if (srev !== it.baseRev) { const d = snap.data(); return { conflict: true, server: snap.exists() ? { data: d.data, rev: d.rev, deleted: !!d.deleted } : null }; }
              tx.set(ref, envelope(it.value, srev + 1, device));
              return { ok: true, rev: srev + 1 };
            });
            results.push(Object.assign({ key: it.key }, r));
          } catch (e) { results.push({ key: it.key, error: (e && e.code) || "unknown" }); }
        }
      }
      return results;
    },
    async saveConflict(uid, c, device) {
      const clean = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
      await F.addDoc(F.collection(db, "users", uid, "conflicts"), { key: c.key, kind: c.kind, local: clean(c.local), server: clean(c.server), fields: clean(c.fields), at: F.serverTimestamp(), device });
    },

    /* ---------- Groups ---------- */
    async listMemberships(uid) {
      const qs = await F.getDocs(F.collection(db, "users", uid, "memberships"));
      return qs.docs.map(d => d.data());
    },
    async createGroup(user, name) {
      const gid = rand(12).replace(/[^A-Za-z0-9]/g, "x"), b = F.writeBatch(db);
      b.set(F.doc(db, "groups", gid), { name, ownerUid: user.uid, createdAt: F.serverTimestamp() });
      b.set(F.doc(db, "groups", gid, "members", user.uid), { uid: user.uid, displayName: (user.displayName || "").slice(0, 80), photoURL: safePhoto(user.photoURL), joinedAt: F.serverTimestamp() });
      b.set(F.doc(db, "users", user.uid, "memberships", gid), { gid, name, joinedAt: F.serverTimestamp() });
      await b.commit();
      return gid;
    },
    /** One-time invite: 192-bit random token, valid 7 days. Returns {gid, iid, token, expiresAt}. */
    async createInvite(gid) {
      const iid = rand(9).replace(/[^A-Za-z0-9]/g, "x"), token = rand(24), expiresAt = new Date(Date.now() + 7 * 864e5);
      await F.setDoc(F.doc(db, "groups", gid, "invites", iid), { token, expiresAt: F.Timestamp.fromDate(expiresAt), usedBy: null, usedAt: null, createdAt: F.serverTimestamp() });
      return { gid, iid, token, expiresAt };
    },
    async listInvites(gid) {
      const qs = await F.getDocs(F.collection(db, "groups", gid, "invites"));
      return qs.docs.map(d => { const x = d.data(); return { iid: d.id, usedBy: x.usedBy, expiresAt: x.expiresAt && x.expiresAt.toDate() }; });
    },
    async revokeInvite(gid, iid) { await F.deleteDoc(F.doc(db, "groups", gid, "invites", iid)); },
    async joinGroup(user, gid, iid, token) {
      const b = F.writeBatch(db);
      b.set(F.doc(db, "groups", gid, "members", user.uid), { uid: user.uid, displayName: (user.displayName || "").slice(0, 80), photoURL: safePhoto(user.photoURL), joinedAt: F.serverTimestamp(), inviteId: iid, token });
      b.update(F.doc(db, "groups", gid, "invites", iid), { usedBy: user.uid, usedAt: F.serverTimestamp() });
      await b.commit();
      const g = await F.getDoc(F.doc(db, "groups", gid));
      const name = g.exists() ? String(g.data().name || "Grup").slice(0, 60) : "Grup";
      await F.setDoc(F.doc(db, "users", user.uid, "memberships", gid), { gid, name, joinedAt: F.serverTimestamp() });
      return { gid, name };
    },
    async getGroup(gid) {
      const g = await F.getDoc(F.doc(db, "groups", gid));
      if (!g.exists()) return null;
      const [ms, ps] = await Promise.all([F.getDocs(F.collection(db, "groups", gid, "members")), F.getDocs(F.collection(db, "groups", gid, "progress"))]);
      return { gid, name: g.data().name, ownerUid: g.data().ownerUid, members: ms.docs.map(d => d.data()), progress: ps.docs.map(d => Object.assign({ uid: d.id }, d.data())) };
    },
    subscribeGroup(gid, cb, onErr) {
      let state = { members: [], progress: [], group: null };
      const fire = () => cb(state);
      const u1 = F.onSnapshot(F.doc(db, "groups", gid), s => { state.group = s.exists() ? Object.assign({ gid }, s.data()) : null; fire(); }, onErr);
      const u2 = F.onSnapshot(F.collection(db, "groups", gid, "members"), qs => { state.members = qs.docs.map(d => d.data()); fire(); }, onErr);
      const u3 = F.onSnapshot(F.collection(db, "groups", gid, "progress"), qs => { state.progress = qs.docs.map(d => Object.assign({ uid: d.id }, d.data())); fire(); }, onErr);
      return () => { u1(); u2(); u3(); };
    },
    async writeProgress(gid, uid, summary, user) {
      await F.setDoc(F.doc(db, "groups", gid, "progress", uid), Object.assign({}, summary, { displayName: (user.displayName || "").slice(0, 80), photoURL: safePhoto(user.photoURL), updatedAt: F.serverTimestamp() }));
    },
    async deleteProgress(gid, uid) { await F.deleteDoc(F.doc(db, "groups", gid, "progress", uid)); },
    async leaveGroup(uid, gid) {
      const b = F.writeBatch(db);
      b.delete(F.doc(db, "groups", gid, "progress", uid));
      b.delete(F.doc(db, "groups", gid, "members", uid));
      b.delete(F.doc(db, "users", uid, "memberships", gid));
      await b.commit();
    },
    async forgetMembership(uid, gid) { await F.deleteDoc(F.doc(db, "users", uid, "memberships", gid)); },
    async removeMember(gid, memberUid) {
      const b = F.writeBatch(db);
      b.delete(F.doc(db, "groups", gid, "progress", memberUid));
      b.delete(F.doc(db, "groups", gid, "members", memberUid));
      await b.commit();
    },
    async deleteGroup(uid, gid) {
      const [ms, ps, is] = await Promise.all(["members", "progress", "invites"].map(c => F.getDocs(F.collection(db, "groups", gid, c))));
      const b = F.writeBatch(db);
      ps.docs.forEach(d => b.delete(d.ref)); is.docs.forEach(d => b.delete(d.ref));
      ms.docs.filter(d => d.id !== uid).forEach(d => b.delete(d.ref));
      b.delete(F.doc(db, "groups", gid, "members", uid));
      b.delete(F.doc(db, "groups", gid));
      b.delete(F.doc(db, "users", uid, "memberships", gid));
      await b.commit();
    }
  };
  return api;
}
