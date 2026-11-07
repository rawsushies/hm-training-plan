import { test } from "node:test";
import assert from "node:assert/strict";
import { H, defaults, run, ci, FakeCloud, device } from "./helpers.js";

test("initial sync uploads every record once; second flush writes nothing (no duplicate writes)", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A");
  A.S.logs = [run("a"), run("b")]; A.engine.start();
  await A.engine.flush();
  const w = cloud.writes;
  assert.ok(cloud.all("u1")["runs/a"]); assert.equal(A.engine.pendingCount(), 0);
  await A.engine.flush(); await A.engine.flush();
  assert.equal(cloud.writes, w);
  assert.equal(A.engine.status.state, "synced");
});

test("two devices adding different runs never overwrite each other", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A"), B = device(cloud, "u1", "B");
  A.engine.start(); B.engine.start();
  await A.engine.flush(); await B.engine.flush();
  A.S.logs.push(run("fromA")); B.S.logs.push(run("fromB", { date: "2026-11-14" }));
  await A.engine.flush(); await B.engine.flush();
  assert.deepEqual(A.S.logs.map(l => l.id).sort(), ["fromA", "fromB"]);
  assert.deepEqual(B.S.logs.map(l => l.id).sort(), ["fromA", "fromB"]);
});

test("offline edits are kept and pushed after reconnect", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A");
  A.engine.start(); await A.engine.flush();
  A.online = false; A.S.logs.push(run("off1")); A.S.checkins.push(ci("2026-11-10"));
  await A.engine.flush();
  assert.equal(A.engine.status.state, "offline");
  assert.ok(A.engine.pendingCount() >= 2);
  assert.equal(cloud.all("u1")["runs/off1"], undefined);
  A.online = true; await A.engine.flush();
  assert.ok(cloud.all("u1")["runs/off1"]); assert.equal(A.engine.pendingCount(), 0);
});

test("failed writes are retried and not lost", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A");
  A.engine.start(); await A.engine.flush();
  cloud.fail = "unavailable"; A.S.logs.push(run("x"));
  await A.engine.flush();
  assert.equal(A.engine.status.state, "offline"); assert.equal(A.engine.retry, 1);
  cloud.fail = null; await A.engine.flush();
  assert.ok(cloud.all("u1")["runs/x"]); assert.equal(A.engine.status.state, "synced");
});

test("concurrent edits of the same run: first committed wins, the other is preserved as a conflict", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A"), B = device(cloud, "u1", "B");
  A.S.logs = [run("r")]; A.engine.start(); await A.engine.flush();
  B.engine.start(); B.engine.seed(cloud.all("u1")); B.S = H.recordsToState(Object.fromEntries(Object.entries(cloud.all("u1")).map(([k, v]) => [k, v.data])), B.S, defaults);
  // B goes offline, both edit the same run
  B.online = false; B.S.logs[0].distance = 9; A.S.logs[0].distance = 5;
  await A.engine.flush();
  // B receives nothing while offline (simulate by un-subscribing B's listener during A's push)… then reconnects
  B.online = true; await B.engine.flush();
  assert.equal(B.S.logs[0].distance, 5, "B adopts the committed version");
  assert.equal(B.engine.meta.conflicts.length, 1);
  assert.equal(B.engine.meta.conflicts[0].local.distance, 9, "B's version is kept for recovery");
  assert.equal(cloud.conflicts.length, 1);
  // user picks their own version → becomes a normal new edit
  B.engine.resolveStored(B.engine.meta.conflicts[0].id, "mine");
  await B.engine.flush();
  assert.equal(cloud.all("u1")["runs/r"].data.distance, 9);
  assert.equal(A.S.logs[0].distance, 9);
});

test("settings edited on two devices merge field by field", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A"), B = device(cloud, "u1", "B");
  A.engine.start(); await A.engine.flush();
  B.engine.start(); B.engine.seed(cloud.all("u1"));
  const unsubB = B.engine.unsub; unsubB();      // B misses A's live update (e.g. was offline)
  A.S.settings.theme = "light"; await A.engine.flush();
  B.S.settings.unit = "mi"; await B.engine.flush();
  const s = cloud.all("u1")["plan/settings"].data;
  assert.equal(s.theme, "light"); assert.equal(s.unit, "mi");
  assert.equal(B.engine.meta.conflicts.length, 0);
});

test("delete on one device propagates as tombstone; edit vs delete keeps the edit", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "u1", "A"), B = device(cloud, "u1", "B");
  A.S.logs = [run("r1"), run("r2", { date: "2026-11-12" })]; A.engine.start(); await A.engine.flush();
  B.engine.start(); B.engine.seed(cloud.all("u1")); B.S = H.recordsToState(Object.fromEntries(Object.entries(cloud.all("u1")).map(([k, v]) => [k, v.data])), B.S, defaults);
  A.S.logs = A.S.logs.filter(l => l.id !== "r1"); await A.engine.flush();
  assert.equal(B.S.logs.some(l => l.id === "r1"), false, "B removed r1 via live tombstone");
  B.engine.unsub();
  A.S.logs = []; await A.engine.flush();                 // A deletes r2
  B.S.logs[0].notes = "edited offline"; await B.engine.flush();
  assert.equal(cloud.all("u1")["runs/r2"].deleted, false, "edit wins over a concurrent delete");
  assert.equal(cloud.all("u1")["runs/r2"].data.notes, "edited offline");
});

test("account isolation: engines for different uids never touch each other's records", async () => {
  const cloud = new FakeCloud(), A = device(cloud, "alice", "D1"), B = device(cloud, "bob", "D1");
  A.S.logs = [run("a1")]; A.engine.start(); await A.engine.flush();
  B.engine.start(); await B.engine.flush();
  assert.equal(B.S.logs.length, 0);
  assert.equal(Object.keys(cloud.all("bob")).some(k => k.startsWith("runs/")), false);
});
