import { test } from "node:test";
import assert from "node:assert/strict";
import { H } from "./helpers.js";
import "../../public/js/notify.js";
const N = globalThis.HMTPNotify;

function fakePlugin(perm = "prompt") {
  const p = { perm, pending: [], channels: [], requests: 0,
    async checkPermissions() { return { display: p.perm }; },
    async requestPermissions() { p.requests++; p.perm = "granted"; return { display: p.perm }; },
    async createChannel(c) { p.channels.push(c.id); },
    async getPending() { return { notifications: p.pending.map(n => ({ id: n.id, extra: n.extra })) }; },
    async cancel({ notifications }) { const ids = new Set(notifications.map(n => n.id)); p.pending = p.pending.filter(n => !ids.has(n.id)); },
    async schedule({ notifications }) { p.pending.push(...notifications); return { notifications: notifications.map(n => ({ id: n.id })) }; }
  };
  return p;
}

test("web build: no adapter, nothing is requested or scheduled", async () => {
  assert.equal(N.platform(), "web");
  assert.equal(N.installNative(), false);
  assert.equal(N.isActive(), false);
  assert.equal(await N.adapter.permission(), "unsupported");
});

test("an older APK without the plugin is detected, not faked", () => {
  globalThis.Capacitor = { isNativePlatform: () => true, isPluginAvailable: () => false };
  try { assert.equal(N.platform(), "native-missing-plugin"); assert.equal(N.installNative(), false); }
  finally { delete globalThis.Capacitor; }
});

test("native adapter: permission only on request, channels, inexact OS alarms, replaces previous schedule", async () => {
  const P = fakePlugin(), A = N.nativeAdapter(P), now = new Date(2026, 10, 9, 8, 0);
  assert.equal(await A.permission(), "prompt");
  assert.equal(P.requests, 0, "checking does not prompt");
  assert.equal(await A.requestPermission(), "granted");
  assert.deepEqual(P.channels, N.CHANNELS.map(c => c.id));
  P.pending.push({ id: 1, extra: { app: "other-thing" } });
  const rem = [
    { id: "pre:w1-wd", cat: "workout", at: new Date(2026, 10, 10, 18, 30), title: "a", body: "b" },
    { id: "old", cat: "tips", at: new Date(2026, 10, 9, 7, 0), title: "past", body: "x" }
  ];
  assert.deepEqual(await A.schedule(rem, now), { scheduled: 1 }, "past reminders dropped");
  const n = P.pending.find(x => x.extra.app === "werunit");
  assert.equal(n.channelId, "workout"); assert.equal(n.smallIcon, "ic_stat_werunit");
  assert.equal(n.isExactNotification, false); assert.equal(n.schedule.allowWhileIdle, true);
  assert.equal(n.id, N.numId("pre:w1-wd")); assert.ok(n.id > 0 && n.id < 2 ** 31);
  await A.schedule([{ id: "pre:w1-sat", cat: "workout", at: new Date(2026, 10, 14, 5, 0), title: "c", body: "d" }], now);
  assert.equal(P.pending.filter(x => x.extra.app === "werunit").length, 1, "previous reminders replaced");
  assert.ok(P.pending.some(x => x.extra.app === "other-thing"), "foreign notifications untouched");
  const many = Array.from({ length: 200 }, (_, i) => ({ id: "r" + i, cat: "tips", at: new Date(2026, 10, 10 + (i % 20), 9), title: "t", body: "b" }));
  assert.equal((await A.schedule(many, now)).scheduled, N.MAX_SCHEDULED);
  await A.cancelAll(); assert.equal(await A.pending(), 0);
});

test("race countdown and hydration reminders come from the real event and long runs", () => {
  const prefs = Object.assign(H.defaultNotif(), { enabled: true, workout: false, tips: false, weekly: false, monthly: false, hydration: true });
  const ev = { id: "jakim-2027", name: "BTN JAKIM", date: "2026-11-22", distanceKm: 21.0975 };
  const sessions = [{ id: "w2-sat", date: "2026-11-14", time: "06:00", title: "Long Run", dist: 12, type: "long" }, { id: "w2-wd", date: "2026-11-11", time: "19:30", title: "Easy", dist: 5, type: "easy" }];
  const r = H.buildReminders({ sessions, weeks: [], logs: [], prefs, now: new Date(2026, 10, 9, 8, 0), horizonDays: 14, event: ev });
  const ids = r.map(x => x.id);
  assert.ok(ids.includes("race:jakim-2027:7") && ids.includes("race:jakim-2027:3") && ids.includes("race:jakim-2027:1"));
  assert.ok(!ids.includes("race:jakim-2027:14"), "already past");
  assert.ok(!ids.some(i => i === "hyd:w2-sat"), "04:30 falls in quiet hours and would be too late after them → dropped");
  assert.ok(!ids.some(i => i === "hyd:w2-wd"), "no hydration nudge for easy runs");
  const late = H.buildReminders({ sessions: [{ id: "w2-sun", date: "2026-11-15", time: "16:00", title: "Long Run", dist: 12, type: "long" }], weeks: [], logs: [], prefs, now: new Date(2026, 10, 9, 8, 0), horizonDays: 14 });
  assert.equal(late[0].id, "hyd:w2-sun"); assert.equal(late[0].at.getHours(), 14); assert.equal(late[0].at.getMinutes(), 30);
  assert.equal(H.buildReminders({ sessions, weeks: [], logs: [], prefs: Object.assign({}, prefs, { race: false, hydration: false }), now: new Date(2026, 10, 9), event: ev }).length, 0);
  assert.equal(H.cleanNotif({ race: false, hydration: true }).race, false);
});
