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
const sha256Hex = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join("");
const rand = bytes => { const b = crypto.getRandomValues(new Uint8Array(bytes)); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const userOf = u => u ? { uid: u.uid, displayName: u.displayName || "", email: u.email || "", photoURL: u.photoURL || "" } : null;
const nativeAuth = () => {
  const C = globalThis.Capacitor;
  if (!(C && C.isNativePlatform && C.isNativePlatform())) return null;
  return C.Plugins.FirebaseAuthentication || C.registerPlugin("FirebaseAuthentication");
};
/* Android native Google sign-in. Credential Manager first; if it fails for any reason other than the
 * user cancelling, the classic Google Sign-In screen (useCredentialManager:false) is tried, which works
 * on phones where Credential Manager misbehaves. The method that worked is remembered. If both fail, the
 * error carries a readable code plus the raw native messages (shown in the app for diagnosis). */
const NATIVE_PREF = "hmtp:nativeSignIn";
const classifyNative = m => /cancel|12501|user denied/i.test(m) ? "auth/user-cancelled"
  : /28444|developer console|DEVELOPER_ERROR|\b10:|\[10\]/i.test(m) ? "auth/android-config"
  : /no credential|NoCredential/i.test(m) ? "auth/no-google-account"
  : /network|\b7:|\[7\]|timeout|unavailable/i.test(m) ? "auth/network-request-failed"
  : "auth/native-failed";
const nativeMsg = e => String((e && (e.message || e.errorMessage || e.code)) || e || "unknown").slice(0, 300);
async function nativeGoogleIdToken(nat, selectAccount) {
  if (selectAccount) await nat.signOut().catch(() => {});
  let order = [true, false];
  try { if (localStorage.getItem(NATIVE_PREF) === "legacy") order = [false, true]; } catch (e) {}
  const tried = [];
  for (const useCM of order) {
    try {
      const res = await nat.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: useCM });
      const tok = res && res.credential && res.credential.idToken;
      if (!tok) throw new Error("Google tidak mengirim ID token");
      try { localStorage.setItem(NATIVE_PREF, useCM ? "cm" : "legacy"); } catch (e) {}
      return tok;
    } catch (e) {
      const m = nativeMsg(e), code = classifyNative(m);
      tried.push(`${useCM ? "CredentialManager" : "GoogleSignIn"}: ${m}`);
      if (code === "auth/user-cancelled") throw Object.assign(new Error(m), { code, detail: tried.join(" | ") });
    }
  }
  const codes = tried.map(t => classifyNative(t));
  const code = codes.find(c => c !== "auth/native-failed") || "auth/native-failed";
  throw Object.assign(new Error(tried.join(" | ")), { code, detail: tried.join(" | ") });
}
const pairKey = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
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
  if (!nativeAuth()) { try { await A.getRedirectResult(auth); } catch (e) { redirectError = e; } }

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
      // Android app: Google blocks OAuth inside embedded WebViews, so use the native account picker
      // (@capacitor-firebase/authentication, skipNativeAuth) and hand the ID token to the JS SDK.
      const nat = nativeAuth();
      if (nat) return userOf((await A.signInWithCredential(auth, A.GoogleAuthProvider.credential(await nativeGoogleIdToken(nat, selectAccount)))).user);
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
    async signOut() { const nat = nativeAuth(); if (nat) await nat.signOut().catch(() => {}); await A.signOut(auth); },

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
    /* ---------- Friends (v4) ---------- */
    async createFriendInvite(user) {
      const code = rand(24), expiresAt = new Date(Date.now() + 7 * 864e5);
      await F.setDoc(F.doc(db, "invites", code), { from: user.uid, fromName: (user.displayName || "").slice(0, 80), fromPhoto: safePhoto(user.photoURL), expiresAt: F.Timestamp.fromDate(expiresAt), usedBy: null, createdAt: F.serverTimestamp() });
      return { code, expiresAt };
    },
    async getFriendInvite(code) {
      const s = await F.getDoc(F.doc(db, "invites", code)); if (!s.exists()) return null;
      const d = s.data(); return { code, from: d.from, fromName: d.fromName, fromPhoto: d.fromPhoto, usedBy: d.usedBy, expiresAt: d.expiresAt && d.expiresAt.toDate() };
    },
    async cancelFriendInvite(code) { await F.deleteDoc(F.doc(db, "invites", code)); },
    /** Publish (discoverable) or remove the caller's search profile. Never stores the email itself. */
    async setProfile(user, discoverable) {
      const ref = F.doc(db, "profiles", user.uid);
      if (!discoverable) { await F.deleteDoc(ref).catch(() => {}); return; }
      const name = (user.displayName || "").trim().slice(0, 80) || "Pelari";
      const body = { name, nameLower: name.toLowerCase(), photo: safePhoto(user.photoURL), updatedAt: F.serverTimestamp() };
      if (user.email) body.emailHash = await sha256Hex(user.email.trim().toLowerCase());
      await F.setDoc(ref, body);
    },
    /** Search by exact email (hashed) or by name prefix. Max 10 results, never includes the caller. */
    async searchProfiles(q, myUid) {
      q = String(q || "").trim().toLowerCase().slice(0, 80);
      if (q.length < 2) return [];
      const col = F.collection(db, "profiles");
      const qs = q.includes("@")
        ? await F.getDocs(F.query(col, F.where("emailHash", "==", await sha256Hex(q)), F.limit(10)))
        : await F.getDocs(F.query(col, F.orderBy("nameLower"), F.startAt(q), F.endAt(q + "\uf8ff"), F.limit(10)));
      return qs.docs.filter(d => d.id !== myUid).map(d => ({ uid: d.id, name: d.data().name, photo: d.data().photo || "" }));
    },
    async sendFriendRequestTo(user, toUid) {
      await F.setDoc(F.doc(db, "requests", pairKey(user.uid, toUid)), { from: user.uid, to: toUid, fromName: (user.displayName || "").slice(0, 80), fromPhoto: safePhoto(user.photoURL), createdAt: F.serverTimestamp() });
    },
    async sendFriendRequest(user, inv) {
      const b = F.writeBatch(db), id = pairKey(user.uid, inv.from);
      b.update(F.doc(db, "invites", inv.code), { usedBy: user.uid });
      b.set(F.doc(db, "requests", id), { from: user.uid, to: inv.from, fromName: (user.displayName || "").slice(0, 80), fromPhoto: safePhoto(user.photoURL), code: inv.code, createdAt: F.serverTimestamp() });
      await b.commit();
    },
    subscribeRequests(uid, cb, onErr) {
      let inc = [], out = [];
      const fire = () => cb({ incoming: inc, outgoing: out });
      const u1 = F.onSnapshot(F.query(F.collection(db, "requests"), F.where("to", "==", uid)), qs => { inc = qs.docs.map(d => Object.assign({ id: d.id }, d.data())); fire(); }, onErr);
      const u2 = F.onSnapshot(F.query(F.collection(db, "requests"), F.where("from", "==", uid)), qs => { out = qs.docs.map(d => Object.assign({ id: d.id }, d.data())); fire(); }, onErr);
      return () => { u1(); u2(); };
    },
    async acceptFriendRequest(uid, other) {
      const id = pairKey(uid, other), b = F.writeBatch(db);
      b.set(F.doc(db, "friendships", id), { members: [uid, other].sort(), createdAt: F.serverTimestamp() });
      b.delete(F.doc(db, "requests", id));
      await b.commit();
    },
    async deleteFriendRequest(id) { await F.deleteDoc(F.doc(db, "requests", id)); },
    subscribeFriendships(uid, cb, onErr) {
      return F.onSnapshot(F.query(F.collection(db, "friendships"), F.where("members", "array-contains", uid)), qs => cb(qs.docs.map(d => ({ id: d.id, other: d.data().members.find(m => m !== uid), since: d.data().createdAt && d.data().createdAt.toDate() }))), onErr);
    },
    async removeFriend(uid, other) {
      await F.deleteDoc(F.doc(db, "shares", `${uid}_${other}`)).catch(() => {});
      await F.deleteDoc(F.doc(db, "friendships", pairKey(uid, other)));
    },
    async blockUser(uid, other) {
      await F.setDoc(F.doc(db, "users", uid, "blocks", other), { at: F.serverTimestamp() });
      await F.deleteDoc(F.doc(db, "shares", `${uid}_${other}`)).catch(() => {});
      await F.deleteDoc(F.doc(db, "requests", pairKey(uid, other))).catch(() => {});
      await F.deleteDoc(F.doc(db, "friendships", pairKey(uid, other))).catch(() => {});
    },
    async listBlocks(uid) { const qs = await F.getDocs(F.collection(db, "users", uid, "blocks")); return qs.docs.map(d => d.id); },
    async unblockUser(uid, other) { await F.deleteDoc(F.doc(db, "users", uid, "blocks", other)); },
    async writeShare(owner, viewer, body) { await F.setDoc(F.doc(db, "shares", `${owner}_${viewer}`), Object.assign({}, body, { owner, viewer, updatedAt: F.serverTimestamp() })); },
    async deleteShare(owner, viewer) { await F.deleteDoc(F.doc(db, "shares", `${owner}_${viewer}`)); },
    subscribeShareFrom(owner, viewer, cb, onErr) { return F.onSnapshot(F.doc(db, "shares", `${owner}_${viewer}`), s => cb(s.exists() ? s.data() : null), onErr); },
    async createGoal(uid, friend, g) {
      const id = rand(9).replace(/[^A-Za-z0-9]/g, "x");
      await F.setDoc(F.doc(db, "goals", id), { name: g.name.slice(0, 60), targetKm: g.targetKm, targetDate: g.targetDate, participants: [uid, friend], createdBy: uid, status: "active", createdAt: F.serverTimestamp() });
      return id;
    },
    subscribeGoals(uid, cb, onErr) {
      return F.onSnapshot(F.query(F.collection(db, "goals"), F.where("participants", "array-contains", uid)), qs => cb(qs.docs.map(d => Object.assign({ id: d.id }, d.data(), { createdAt: d.data().createdAt && d.data().createdAt.toDate() }))), onErr);
    },
    subscribeContrib(goalId, cb, onErr) { return F.onSnapshot(F.collection(db, "goals", goalId, "contrib"), qs => cb(Object.fromEntries(qs.docs.map(d => [d.id, d.data()]))), onErr); },
    async writeContrib(goalId, uid, c) { await F.setDoc(F.doc(db, "goals", goalId, "contrib", uid), { km: c.km, runs: c.runs, updatedAt: F.serverTimestamp() }); },
    async setGoalStatus(goalId, status) { await F.updateDoc(F.doc(db, "goals", goalId), { status }); },
    async deleteGoal(goalId) { await F.deleteDoc(F.doc(db, "goals", goalId)); },
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
