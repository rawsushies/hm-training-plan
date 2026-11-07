// Firestore security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, collection, getDocs, query, orderBy, startAt, endAt, limit, where } from "firebase/firestore";

let env;
const PROJECT = "demo-hmtp";
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: +port } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const db = uid => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const rec = (data, rev = 1, deleted = false) => ({ data, rev, deleted, updatedAt: serverTimestamp(), device: "test" });
const run = (id, extra = {}) => Object.assign({ id, date: "2026-11-10", type: "easy", sessionId: "w1-wd", distance: 4, duration: 1800, elev: null, hrAvg: null, hrMax: null, rpe: 4, weather: "", notes: "" }, extra);

test("unauthenticated users cannot read or write private data", async () => {
  await assertFails(getDoc(doc(db(null), "users/alice/runs/r1")));
  await assertFails(setDoc(doc(db(null), "users/alice/runs/r1"), rec(run("r1"))));
});

test("a user can create, read and update own records with rev+1", async () => {
  const a = db("alice");
  await assertSucceeds(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1"))));
  await assertSucceeds(getDoc(doc(a, "users/alice/runs/r1")));
  await assertSucceeds(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1", { distance: 5 }), 2)));
});

test("stale writes (wrong rev) are rejected: optimistic concurrency", async () => {
  const a = db("alice");
  await assertSucceeds(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1"))));
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1", { distance: 9 }), 1)));   // same rev again
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1", { distance: 9 }), 3)));   // skipping
  await assertFails(setDoc(doc(a, "users/alice/runs/r2"), rec(run("r2"), 2)));                    // new doc must be rev 1
});

test("user A cannot read or write user B's records or profile", async () => {
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "users/bob/runs/r1"), { data: run("r1"), rev: 1, deleted: false, device: "x" }); });
  const a = db("alice");
  await assertFails(getDoc(doc(a, "users/bob/runs/r1")));
  await assertFails(getDocs(collection(a, "users/bob/runs")));
  await assertFails(setDoc(doc(a, "users/bob/runs/r2"), rec(run("r2"))));
  await assertFails(setDoc(doc(a, "users/bob/plan/settings"), rec({ unit: "km" })));
  await assertFails(setDoc(doc(a, "users/bob"), { profile: { displayName: "Bob" }, updatedAt: serverTimestamp() }));
});

test("records are validated (shape, payload, no unexpected fields)", async () => {
  const a = db("alice");
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), Object.assign(rec(run("r1")), { extra: 1 })));
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1", { type: "<img>" }))));
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("other-id"))));
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1", { distance: "far" }))));
  await assertFails(setDoc(doc(a, "users/alice/checkins/2026-11-10"), rec({ date: "2026-11-10", sleep: 9, soreness: 1, fatigue: 1, energy: 1, motivation: 1, pain: 1 })));
  await assertSucceeds(setDoc(doc(a, "users/alice/checkins/2026-11-10"), rec({ date: "2026-11-10", sleep: 3, soreness: 1, fatigue: 1, energy: 1, motivation: 1, pain: 1 })));
  await assertFails(setDoc(doc(a, "users/alice/secret/x"), rec({})));                // unknown collection
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), { data: run("r1"), rev: 1, deleted: false, updatedAt: Timestamp.fromMillis(0), device: "t" })); // client clock
});

test("tombstones: deleting = writing deleted:true with data null; hard delete is denied", async () => {
  const a = db("alice");
  await assertSucceeds(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1"))));
  await assertFails(setDoc(doc(a, "users/alice/runs/r1"), rec(run("r1"), 2, true)));
  await assertSucceeds(setDoc(doc(a, "users/alice/runs/r1"), rec(null, 2, true)));
  await assertFails(deleteDoc(doc(a, "users/alice/runs/r1")));
});

test("user doc: own profile only, whitelisted keys, https photo", async () => {
  const a = db("alice");
  await assertSucceeds(setDoc(doc(a, "users/alice"), { profile: { displayName: "Alice", photoURL: "https://x/y.png" }, schemaVersion: 3, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(a, "users/alice"), { profile: { displayName: "A", photoURL: "javascript:alert(1)" }, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(a, "users/alice"), { isAdmin: true, updatedAt: serverTimestamp() }));
});

// ---------------- Groups ----------------
const member = (uid, extra = {}) => Object.assign({ uid, displayName: uid, photoURL: "", joinedAt: serverTimestamp() }, extra);
// v4 retired group creation: legacy groups exist as data created before v4.
async function makeGroup(owner = "alice", gid = "g1") {
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    await setDoc(doc(d, `groups/${gid}`), { name: "Tim", ownerUid: owner, createdAt: Timestamp.now() });
    await setDoc(doc(d, `groups/${gid}/members/${owner}`), { uid: owner, displayName: owner, photoURL: "", joinedAt: Timestamp.now() });
  });
}
async function makeInvite(owner = "alice", gid = "g1", iid = "i1", token = "t".repeat(32), ms = 864e5) {
  await setDoc(doc(db(owner), `groups/${gid}/invites/${iid}`), { token, expiresAt: Timestamp.fromMillis(Date.now() + ms), usedBy: null, usedAt: null, createdAt: serverTimestamp() });
}
function joinBatch(uid, token = "t".repeat(32), gid = "g1", iid = "i1") {
  const d = db(uid), b = writeBatch(d);
  b.set(doc(d, `groups/${gid}/members/${uid}`), member(uid, { inviteId: iid, token }));
  b.update(doc(d, `groups/${gid}/invites/${iid}`), { usedBy: uid, usedAt: serverTimestamp() });
  return b;
}

test("legacy groups: no new group can be created any more (v4), existing ones stay readable to members", async () => {
  await makeGroup();
  const nd = db("dave"), nb = writeBatch(nd);
  nb.set(doc(nd, "groups/gnew"), { name: "Baru", ownerUid: "dave", createdAt: serverTimestamp() });
  nb.set(doc(nd, "groups/gnew/members/dave"), member("dave"));
  await assertFails(nb.commit());
  await assertSucceeds(getDoc(doc(db("alice"), "groups/g1")));
  const d = db("carol");
  await assertFails(setDoc(doc(d, "groups/g2"), { name: "X", ownerUid: "carol", createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(d, "groups/g3"), { name: "X", ownerUid: "alice", createdAt: serverTimestamp() })); // impersonation
});

test("non-members cannot read group, members or progress", async () => {
  await makeGroup();
  const c = db("carol");
  await assertFails(getDoc(doc(c, "groups/g1")));
  await assertFails(getDocs(collection(c, "groups/g1/members")));
  await assertFails(getDocs(collection(c, "groups/g1/progress")));
  await assertSucceeds(getDoc(doc(db("alice"), "groups/g1")));
});

test("join with a valid invite; invite is one-time", async () => {
  await makeGroup(); await makeInvite();
  await assertSucceeds(joinBatch("bob").commit());
  await assertSucceeds(getDoc(doc(db("bob"), "groups/g1")));
  await assertFails(joinBatch("carol").commit());     // already used
});

test("join is rejected with a wrong token, an expired invite, or without consuming it", async () => {
  await makeGroup(); await makeInvite();
  await assertFails(joinBatch("bob", "x".repeat(32)).commit());
  const d = db("bob");
  await assertFails(setDoc(doc(d, "groups/g1/members/bob"), member("bob", { inviteId: "i1", token: "t".repeat(32) }))); // not consuming
  await assertFails(setDoc(doc(d, "groups/g1/members/bob"), member("bob")));                                         // no invite at all
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "groups/g1/invites/i2"), { token: "u".repeat(32), expiresAt: Timestamp.fromMillis(Date.now() - 1000), usedBy: null, usedAt: null, createdAt: Timestamp.now() }); });
  await assertFails(joinBatch("carol", "u".repeat(32), "g1", "i2").commit());                                        // expired
});

test("invites are readable and creatable by the owner only", async () => {
  await makeGroup(); await makeInvite();
  await assertFails(getDoc(doc(db("bob"), "groups/g1/invites/i1")));
  await assertFails(setDoc(doc(db("bob"), "groups/g1/invites/i9"), { token: "z".repeat(32), expiresAt: Timestamp.fromMillis(Date.now() + 1e6), usedBy: null, usedAt: null, createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(db("alice"), "groups/g1/invites/i1")));
  await assertFails(setDoc(doc(db("alice"), "groups/g1/invites/i9"), { token: "z".repeat(32), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 864e5), usedBy: null, usedAt: null, createdAt: serverTimestamp() })); // > 8 days
});

const progress = (uid, extra = {}) => Object.assign({ totalKm: 12.5, weekKm: 4, runs: 3, longest: 6, bestPace: 420, fullWeeks: 1, lastRun: "2026-11-10", week: 1, displayName: uid, photoURL: "", updatedAt: serverTimestamp() }, extra);

test("progress: members write only their own whitelisted summary", async () => {
  await makeGroup(); await makeInvite(); await joinBatch("bob").commit();
  const b = db("bob");
  await assertSucceeds(setDoc(doc(b, "groups/g1/progress/bob"), progress("bob")));
  await assertFails(setDoc(doc(b, "groups/g1/progress/alice"), progress("alice")));          // impersonation
  await assertFails(setDoc(doc(b, "groups/g1/progress/bob"), progress("bob", { notes: "sakit lutut" }))); // sensitive extra field
  await assertFails(setDoc(doc(b, "groups/g1/progress/bob"), progress("bob", { runs: "<b>" })));
  await assertSucceeds(getDoc(doc(db("alice"), "groups/g1/progress/bob")));
  await assertFails(setDoc(doc(db("carol"), "groups/g1/progress/carol"), progress("carol"))); // non-member
});

test("leave, remove, and private logs stay private to group members", async () => {
  await makeGroup(); await makeInvite(); await joinBatch("bob").commit();
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "users/bob/runs/r1"), { data: run("r1"), rev: 1, deleted: false, device: "x" }); });
  await assertFails(getDoc(doc(db("alice"), "users/bob/runs/r1")));        // owner of a shared group still can't read logs
  await assertFails(deleteDoc(doc(db("bob"), "groups/g1/members/alice")));  // member can't remove others
  await assertSucceeds(deleteDoc(doc(db("alice"), "groups/g1/members/bob"))); // owner removes bob
  await assertFails(getDoc(doc(db("bob"), "groups/g1")));                   // bob lost access
  await assertFails(deleteDoc(doc(db("alice"), "groups/g1/members/alice"))); // owner can't orphan the group
});

test("member can leave voluntarily; owner deletes the whole group", async () => {
  await makeGroup(); await makeInvite(); await joinBatch("bob").commit();
  await assertSucceeds(deleteDoc(doc(db("bob"), "groups/g1/members/bob")));
  const a = db("alice"), b = writeBatch(a);
  b.delete(doc(a, "groups/g1/invites/i1")); b.delete(doc(a, "groups/g1/members/alice")); b.delete(doc(a, "groups/g1"));
  await assertSucceeds(b.commit());
});

// ================= Friends (v4) =================
const TOK = "c".repeat(26);
const pair = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
async function invite(from = "alice", code = TOK, ms = 864e5) {
  await setDoc(doc(db(from), `invites/${code}`), { from, fromName: from, fromPhoto: "", expiresAt: Timestamp.fromMillis(Date.now() + ms), usedBy: null, createdAt: serverTimestamp() });
}
function requestBatch(by, to, code = TOK) {
  const d = db(by), b = writeBatch(d);
  b.update(doc(d, `invites/${code}`), { usedBy: by });
  b.set(doc(d, `requests/${pair(by, to)}`), { from: by, to, fromName: by, fromPhoto: "", code, createdAt: serverTimestamp() });
  return b;
}
function acceptBatch(by, other) {
  const d = db(by), b = writeBatch(d), id = pair(by, other);
  b.set(doc(d, `friendships/${id}`), { members: [by, other].sort(), createdAt: serverTimestamp() });
  b.delete(doc(d, `requests/${id}`));
  return b;
}
async function makeFriends(a = "alice", b = "bob") { await invite(a); await requestBatch(b, a).commit(); await acceptBatch(a, b).commit(); }

test("friends: invite → request → accept; invite is single-use and codes cannot be listed", async () => {
  await invite();
  await assertFails(getDocs(collection(db("eve"), "invites")));                  // no enumeration
  await assertSucceeds(getDoc(doc(db("bob"), `invites/${TOK}`)));                 // exact code only
  await assertSucceeds(requestBatch("bob", "alice").commit());
  await assertFails(requestBatch("carol", "alice").commit(), "already used");
  await assertFails(acceptBatch("bob", "alice").commit(), "sender cannot accept own request");
  await assertSucceeds(acceptBatch("alice", "bob").commit());
  await assertSucceeds(getDoc(doc(db("bob"), `friendships/${pair("alice", "bob")}`)));
  await assertFails(getDoc(doc(db("carol"), `friendships/${pair("alice", "bob")}`)));
});

test("friends: no friendship without a pending request; no requests without a valid invite; expired, self and impersonation denied", async () => {
  await assertFails(setDoc(doc(db("bob"), `friendships/${pair("alice", "bob")}`), { members: ["alice", "bob"], createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db("bob"), `requests/${pair("alice", "bob")}`), { from: "bob", to: "alice", fromName: "b", fromPhoto: "", code: TOK, createdAt: serverTimestamp() }));
  await assertFails(invite("alice", "e".repeat(26), -1), "an already-expired invite cannot be created");
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), `invites/${"x".repeat(26)}`), { from: "alice", fromName: "a", fromPhoto: "", expiresAt: Timestamp.fromMillis(Date.now() - 1000), usedBy: null, createdAt: Timestamp.now() }); });
  await assertFails(requestBatch("bob", "alice", "x".repeat(26)).commit(), "expired");
  await invite("alice");
  await assertFails(requestBatch("alice", "alice").commit(), "self");
  const d = db("bob"), b = writeBatch(d);                                        // bob pretends carol sent it
  b.update(doc(d, `invites/${TOK}`), { usedBy: "bob" });
  b.set(doc(d, `requests/${pair("carol", "alice")}`), { from: "carol", to: "alice", fromName: "c", fromPhoto: "", code: TOK, createdAt: serverTimestamp() });
  await assertFails(b.commit());
  await assertFails(setDoc(doc(db("bob"), `invites/${"z".repeat(26)}`), { from: "alice", fromName: "a", fromPhoto: "", expiresAt: Timestamp.fromMillis(Date.now() + 1e6), usedBy: null, createdAt: serverTimestamp() }), "invite in someone else's name");
});

test("friends: blocked users cannot send requests; either side can remove the friendship; cancel/reject", async () => {
  await setDoc(doc(db("alice"), "users/alice/blocks/bob"), { at: serverTimestamp() });
  await assertFails(getDoc(doc(db("bob"), "users/alice/blocks/bob")), "block list is private");
  await invite();
  await assertFails(requestBatch("bob", "alice").commit(), "blocked");
  await deleteDoc(doc(db("alice"), "users/alice/blocks/bob"));
  await assertSucceeds(requestBatch("bob", "alice").commit());
  await assertSucceeds(deleteDoc(doc(db("bob"), `requests/${pair("alice", "bob")}`)), "sender cancels");
  await invite("alice", "d".repeat(26));
  await requestBatch("bob", "alice", "d".repeat(26)).commit();
  await assertFails(deleteDoc(doc(db("carol"), `requests/${pair("alice", "bob")}`)));
  await assertSucceeds(acceptBatch("alice", "bob").commit());
  await assertFails(deleteDoc(doc(db("carol"), `friendships/${pair("alice", "bob")}`)));
  await assertSucceeds(deleteDoc(doc(db("bob"), `friendships/${pair("alice", "bob")}`)));
});

const share = (o = {}) => Object.assign({ owner: "alice", viewer: "bob", name: "Alice", photo: "", weekKm: 12.5, weekDone: 2, weekPlanned: 3, updatedAt: serverTimestamp() }, o);
test("shares: only to friends, only whitelisted fields, only the viewer reads, revocable", async () => {
  await assertFails(setDoc(doc(db("alice"), "shares/alice_bob"), share()), "not friends yet");
  await makeFriends();
  await assertSucceeds(setDoc(doc(db("alice"), "shares/alice_bob"), share({ hrPace: [{ date: "2026-11-10", pace: 400, hrAvg: 150 }] })));
  await assertFails(setDoc(doc(db("alice"), "shares/alice_bob"), share({ notes: "nyeri lutut" })), "private field rejected");
  await assertFails(setDoc(doc(db("alice"), "shares/alice_bob"), share({ checkins: [] })), "check-ins never shareable");
  await assertFails(setDoc(doc(db("bob"), "shares/alice_bob"), share()), "impersonating the owner");
  await assertSucceeds(getDoc(doc(db("bob"), "shares/alice_bob")));
  await assertFails(getDoc(doc(db("carol"), "shares/alice_bob")));
  await deleteDoc(doc(db("bob"), `friendships/${pair("alice", "bob")}`));
  await assertFails(getDoc(doc(db("bob"), "shares/alice_bob")), "unfriended → no access even if the share doc still exists");
  await assertSucceeds(deleteDoc(doc(db("alice"), "shares/alice_bob")));
  await assertSucceeds(getDoc(doc(db("bob"), "shares/carol_bob")), "viewer may listen before the first write (missing doc)");
  await assertFails(getDoc(doc(db("dave"), "shares/carol_bob")), "but not on docs addressed to others");
  await assertFails(getDoc(doc(db("bob"), "users/alice/runs/r1")), "friends never read private runs");
});

test("shared goals: friends only, participants read, each writes only own contribution", async () => {
  const g = { name: "HM bareng", targetKm: 300, targetDate: "2027-06-13", participants: ["alice", "bob"], createdBy: "alice", status: "active", createdAt: serverTimestamp() };
  await assertFails(setDoc(doc(db("alice"), "goals/g1"), g), "not friends");
  await makeFriends();
  await assertSucceeds(setDoc(doc(db("alice"), "goals/g1"), g));
  await assertFails(setDoc(doc(db("alice"), "goals/g2"), Object.assign({}, g, { participants: ["alice", "carol"] })));
  await assertSucceeds(setDoc(doc(db("bob"), "goals/g1/contrib/bob"), { km: 20.5, runs: 3, updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db("bob"), "goals/g1/contrib/alice"), { km: 999, runs: 1, updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(db("alice"), "goals/g1/contrib/bob")));
  await assertFails(getDoc(doc(db("carol"), "goals/g1")));
  await assertFails(getDoc(doc(db("carol"), "goals/g1/contrib/bob")));
  await assertSucceeds(updateDoc(doc(db("bob"), "goals/g1"), { status: "completed" }));
  await assertFails(updateDoc(doc(db("bob"), "goals/g1"), { targetKm: 1 }));
});

test("server-only data: Strava tokens unreachable from clients; inbox readable/deletable by its owner only", async () => {
  await env.withSecurityRulesDisabled(async c => {
    await setDoc(doc(c.firestore(), "serverOnly/strava/tokens/alice"), { refresh: "secret" });
    await setDoc(doc(c.firestore(), "users/alice/inbox/strava_1"), { extId: "strava:1", distance: 5 });
  });
  await assertFails(getDoc(doc(db("alice"), "serverOnly/strava/tokens/alice")));
  await assertFails(setDoc(doc(db("alice"), "serverOnly/strava/tokens/alice"), { refresh: "x" }));
  await assertSucceeds(getDoc(doc(db("alice"), "users/alice/inbox/strava_1")));
  await assertFails(getDoc(doc(db("bob"), "users/alice/inbox/strava_1")));
  await assertFails(setDoc(doc(db("alice"), "users/alice/inbox/fake"), { extId: "strava:2", distance: 42 }), "clients cannot forge imports");
  await assertSucceeds(deleteDoc(doc(db("alice"), "users/alice/inbox/strava_1")));
});

test("profiles directory: owner-only writes with exact fields; signed-in prefix search capped at 10; search-based requests need a profile", async () => {
  const prof = (name, x = {}) => Object.assign({ name, nameLower: name.toLowerCase(), photo: "", updatedAt: serverTimestamp() }, x);
  await assertSucceeds(setDoc(doc(db("alice"), "profiles/alice"), prof("Alice Rahma", { emailHash: "a".repeat(64) })));
  await assertFails(setDoc(doc(db("bob"), "profiles/alice"), prof("Mallory")), "only the owner");
  await assertFails(setDoc(doc(db("bob"), "profiles/bob"), prof("Bob", { email: "bob@x.com" })), "no raw email");
  await assertFails(setDoc(doc(db("bob"), "profiles/bob"), Object.assign(prof("Bob"), { nameLower: "someone else" })), "nameLower must match");
  await assertSucceeds(getDocs(query(collection(db("bob"), "profiles"), orderBy("nameLower"), startAt("ali"), endAt("ali"), limit(10))));
  await assertSucceeds(getDocs(query(collection(db("bob"), "profiles"), where("emailHash", "==", "a".repeat(64)), limit(10))));
  await assertFails(getDocs(query(collection(db("bob"), "profiles"), limit(500))), "no directory dump");
  await assertFails(getDocs(query(collection(db(null), "profiles"), limit(5))), "signed-in only");
  const req = (from, to) => ({ from, to, fromName: from, fromPhoto: "", createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(db("bob"), "requests/alice_bob"), req("bob", "alice")), "alice is discoverable");
  await assertFails(setDoc(doc(db("bob"), "requests/bob_carol"), req("bob", "carol")), "carol has no profile (hidden)");
  await assertSucceeds(setDoc(doc(db("alice"), "users/alice/blocks/dave"), { at: serverTimestamp() }));
  await assertFails(setDoc(doc(db("dave"), "requests/alice_dave"), req("dave", "alice")), "blocked");
  await assertSucceeds(deleteDoc(doc(db("alice"), "profiles/alice")));
});
