import { test } from "node:test";
import assert from "node:assert/strict";
import { H, defaults, run, ci } from "./helpers.js";

test("sanitizeState drops/cleans hostile values (audit hotfix R3)", () => {
  const s = H.sanitizeState({
    settings: { theme: "dark", startDate: "2026-11-09\"><img>", weekday: 9 },
    logs: [run('x" onmouseover="alert(1)'), run("ok", { type: "easy;--c:red" }), run("bad", { date: "nope" }), run("ok")],
    checkins: [ci("2026-11-10", { sleep: 99 }), ci("2026-11-11")],
    strength: [{ id: "s1", date: "2026-11-10", kind: "<b>", done: [] }],
    overrides: { "w1-wd": { title: "T", dist: 5 }, "evil": { title: "x" } },
    ui: { tab: "<script>", run: { id: "w1-wd", steps: [] } }
  }, defaults);
  assert.equal(s.settings.startDate, "2026-11-09");
  assert.equal(s.settings.weekday, 1);
  assert.equal(s.logs.length, 2, "invalid date dropped, duplicate id dropped");
  assert.match(s.logs[0].id, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(s.logs[0].id, 'x" onmouseover="alert(1)');
  assert.equal(s.logs[1].type, "other");
  assert.equal(s.checkins.length, 1);
  assert.equal(s.strength.length, 0);
  assert.deepEqual(Object.keys(s.overrides), ["w1-wd"]);
  assert.equal(s.ui.tab, "home");
});

test("records round-trip: stateToRecords → recordsToState is lossless", () => {
  const S = defaults();
  S.logs = [run("a"), run("b", { distance: 6, shoeId: "sh1", extId: "gpx:1" })];
  S.checkins = [ci("2026-11-10")];
  S.strength = [{ id: "s1", date: "2026-11-11", kind: "A", sets: 2, done: ["lunge"], sessionId: "w1-sA" }];
  S.shoes = [{ id: "sh1", name: "Biru", limit: 700, retired: false }];
  S.reviews = { 0: { best: "a", hard: "", rec: "", fix: "" } };
  S.overrides = { "w2-sat": { dist: 7, date: "2026-11-20" } }; S.status = { "w1-sun": "skip" };
  S.locked = { "w2-wd": { targetPace: 400 } }; S.elev = { "w3-sat": { target: 120 } }; S.raceCheck = { 3: true };
  const r = H.stateToRecords(S);
  assert.ok(r["runs/a"] && r["checkins/2026-11-10"] && r["plan/ovr_w2-sat"] && r["plan/status_w1-sun"] === "skip");
  const back = H.recordsToState(r, S, defaults);
  for (const k of ["logs", "checkins", "strength", "shoes", "reviews", "overrides", "status", "locked", "elev", "raceCheck", "settings"])
    assert.equal(H.stableStringify(back[k]), H.stableStringify(S[k]), k);
});

test("computeDirty detects adds, edits and deletes", () => {
  const S = defaults(); S.logs = [run("a")];
  const base = {};
  for (const [k, v] of Object.entries(H.stateToRecords(S))) base[k] = { rev: 1, h: H.hashOf(v) };
  assert.equal(H.computeDirty(H.stateToRecords(S), base).length, 0);
  S.logs[0].distance = 5; S.logs.push(run("b"));
  const d = H.computeDirty(H.stateToRecords(S), base);
  assert.deepEqual(d.map(x => x.key + ":" + x.op).sort(), ["runs/a:set", "runs/b:set"]);
  S.logs = [];
  assert.deepEqual(H.computeDirty(H.stateToRecords(S), base).filter(x => x.key.startsWith("runs")).map(x => x.op).sort(), ["del"]);
});

test("merge3: independent field edits combine, same-field edits keep server + report", () => {
  const base = { unit: "km", theme: "dark", wdTime: "19:30" };
  const local = { unit: "mi", theme: "dark", wdTime: "18:00" };
  const server = { unit: "km", theme: "light", wdTime: "20:00" };
  const m = H.merge3(base, local, server);
  assert.deepEqual(m.value, { unit: "mi", theme: "light", wdTime: "20:00" });
  assert.equal(m.conflicts.length, 1); assert.equal(m.conflicts[0].field, "wdTime");
});

test("resolveConflict policies", () => {
  assert.equal(H.resolveConflict("runs/a", run("a"), { data: run("a"), deleted: false }).adopt, true);
  const both = H.resolveConflict("runs/a", run("a", { distance: 5 }), { data: run("a", { distance: 6 }), deleted: false });
  assert.equal(both.write, undefined); assert.equal(both.conflict.kind, "edit"); assert.equal(both.conflict.local.distance, 5);
  const theyDeleted = H.resolveConflict("runs/a", run("a", { distance: 5 }), { data: null, deleted: true });
  assert.equal(theyDeleted.write.distance, 5, "a local edit is never lost to a remote delete");
  const weDeleted = H.resolveConflict("runs/a", undefined, { data: run("a", { distance: 7 }), deleted: false });
  assert.equal(weDeleted.write, undefined); assert.equal(weDeleted.conflict.kind, "deleteLost");
});

test("mergeStates: dedupe by id, by session, by date+distance+duration; idempotent", () => {
  const cloud = defaults(), local = defaults();
  cloud.logs = [run("c1", { sessionId: "w1-wd" }), run("c2", { date: "2026-11-14", distance: 6, duration: 3000 })];
  local.logs = [
    run("c1", { sessionId: "w1-wd" }),                                    // same id
    run("l2", { date: "2026-11-14", distance: 6.1, duration: 3030 }),     // same run, different id (re-import)
    run("l3", { date: "2026-11-15", distance: 3, sessionId: "w1-wd" }),   // different run, session already logged in cloud
    run("l4", { date: "2026-11-21", distance: 8 }),                       // new
    run("smp", { sample: true })                                          // sample data never migrates
  ];
  cloud.checkins = [ci("2026-11-10")]; local.checkins = [ci("2026-11-10"), ci("2026-11-11", { pain: 3 }), ci("2026-11-12")];
  cloud.checkins.push(ci("2026-11-11", { pain: 1 }));
  cloud.reviews = { 0: { best: "A", hard: "", rec: "", fix: "" } }; local.reviews = { 0: { best: "B", hard: "H", rec: "", fix: "" } };
  local.shoes = [{ id: "sh1", name: "Biru", limit: 700, retired: false }];
  const m = H.mergeStates(cloud, local, defaults);
  assert.equal(m.state.logs.length, 4);
  assert.deepEqual(m.report.logs, { added: 2, dup: 2, unlinked: 1 });
  assert.equal(m.state.logs.find(l => l.id === "l3").sessionId, null);
  assert.equal(m.report.checkins.conflict, 1, "differing check-in on same date reported, not dropped");
  assert.equal(m.conflicts.find(c => c.key === "checkins/2026-11-11").local.pain, 3);
  assert.match(m.state.reviews[0].best, /A[\s\S]*B/);
  assert.equal(m.state.reviews[0].hard, "H");
  assert.equal(m.state.shoes.length, 1);
  const again = H.mergeStates(m.state, local, defaults);
  assert.equal(again.report.logs.added, 0);
  assert.equal(H.stableStringify(again.state.logs), H.stableStringify(m.state.logs));
  assert.equal(H.stableStringify(again.state.reviews), H.stableStringify(m.state.reviews));
});

test("verifyBackup round-trips counts", () => {
  const S = defaults(); S.logs = [run("a"), run("b")]; S.checkins = [ci("2026-11-10")];
  assert.ok(H.verifyBackup(JSON.stringify(S), S, defaults));
  assert.ok(!H.verifyBackup("{broken", S, defaults));
});

class MemStore { constructor(o = {}) { this.m = new Map(Object.entries(o)); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }

test("legacy hmtp:v1 moves to the anonymous v3 slot once, original untouched", () => {
  const legacy = JSON.stringify(Object.assign(defaults(), { owner: "claude-123", logs: [run("a")] }));
  const ls = new MemStore({ "hmtp:v1": legacy, "hmtp:v1:claude-999": "{}" });
  const r = H.migrateLegacyStorage(ls);
  assert.ok(r.moved); assert.deepEqual(r.legacyKeys, ["hmtp:v1", "hmtp:v1:claude-999"]);
  assert.equal(ls.getItem("hmtp:v1"), legacy, "legacy key never modified");
  const anon = JSON.parse(ls.getItem("hmtp:anon:v3")); assert.equal(anon.logs.length, 1); assert.equal(anon.owner, undefined);
  ls.setItem("hmtp:anon:v3", "{}");
  assert.equal(H.migrateLegacyStorage(ls).moved, false, "second run is a no-op");
  assert.equal(ls.getItem("hmtp:anon:v3"), "{}");
});

test("tutorial version policy", () => {
  const S = defaults();
  assert.equal(H.tutorialStartMode(S), "auto");
  S.ui.tourDone = true; S.ui.tourV = 2;
  assert.equal(H.tutorialStartMode(S), "banner");
  S.tutorial.bannerDismissed = true; assert.equal(H.tutorialStartMode(S), "none");
  S.tutorial.quick = true; S.tutorial.bannerDismissed = false; assert.equal(H.tutorialStartMode(S), "none");
});

test("buildReminders: disabled by default, uses real schedule, respects quiet hours and lead time", () => {
  const sessions = [
    { id: "w1-wd", date: "2026-11-10", time: "19:30", title: "Easy Run", dist: 4, type: "easy" },
    { id: "w1-sat", date: "2026-11-14", time: "06:00", title: "Long Run", dist: 6, type: "long" },
    { id: "w1-sA", date: "2026-11-12", time: "19:30", title: "Strength A", dist: 0, type: "strength" }
  ];
  const weeks = [{ n: 1, start: "2026-11-09", end: "2026-11-15", kind: "base", total: 13, block: 0 }];
  const now = new Date(2026, 10, 9, 8, 0);
  assert.equal(H.buildReminders({ sessions, weeks, logs: [], prefs: H.defaultNotif(), now }).length, 0, "off unless enabled");
  const prefs = Object.assign(H.defaultNotif(), { enabled: true, tips: false, weekly: false, monthly: false, leadMin: 60, quietStart: "22:00", quietEnd: "06:00" });
  const r = H.buildReminders({ sessions, weeks, logs: [], prefs, now });
  const pre = r.find(x => x.id === "pre:w1-wd"); assert.equal(pre.at.getHours(), 18); assert.equal(pre.at.getMinutes(), 30);
  const preLong = r.find(x => x.id === "pre:w1-sat");
  assert.equal(preLong, undefined, "05:00 is in quiet hours and moving to 06:00 would be too late → dropped");
  assert.match(r.find(x => x.id === "eve:w1-sat").body, /Long Run 6 km.*sepatu/);
  assert.ok(!r.some(x => x.id.includes("w1-sA")), "strength is not a workout reminder");
  assert.ok(r.every(x => !H.inQuiet(x.at.getHours() * 60 + x.at.getMinutes(), "22:00", "06:00")));
});

test("weekly analysis reminder only states facts from logs", () => {
  const weeks = [{ n: 1, start: "2026-11-09", end: "2026-11-15", kind: "base", total: 13, block: 0 }, { n: 2, start: "2026-11-16", end: "2026-11-22", kind: "locked", total: 14, block: 0 }];
  const logs = [run("a", { date: "2026-11-10", distance: 4 }), run("b", { date: "2026-11-14", distance: 7 })];
  const prefs = Object.assign(H.defaultNotif(), { enabled: true, workout: false, tips: false, monthly: false });
  const r = H.buildReminders({ sessions: [], weeks, logs, prefs, now: new Date(2026, 10, 15, 12, 0) });
  const wk = r.find(x => x.id === "wk:w1");
  assert.match(wk.body, /2 lari, 11 dari 13 km/);
});
