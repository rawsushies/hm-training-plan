// Firestore security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, collection, getDocs } from "firebase/firestore";

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
async function makeGroup(owner = "alice", gid = "g1") {
  const d = db(owner), b = writeBatch(d);
  b.set(doc(d, `groups/${gid}`), { name: "Tim", ownerUid: owner, createdAt: serverTimestamp() });
  b.set(doc(d, `groups/${gid}/members/${owner}`), member(owner));
  await b.commit();
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

test("create group: owner must add self as member in the same batch", async () => {
  await assertSucceeds(makeGroup());
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
