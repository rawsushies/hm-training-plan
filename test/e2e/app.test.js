// End-to-end tests: real browser (Chromium) + Firebase Auth & Firestore emulators + real firestore.rules.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

const legacyState = () => ({
  v: 2, updatedAt: 1, owner: "claude-user-1",
  settings: { weekday: 3, unit: "km", startDate: "2026-11-09", raceDate: "2027-06-13", goalTime: "3:15:00", theme: "dark" },
  logs: [
    { id: "leg1", date: "2026-11-12", type: "easy", sessionId: "w1-wd", distance: 4.2, duration: 1900, rpe: 4, notes: "lari pertama" },
    { id: "leg2", date: "2026-11-14", type: "long", sessionId: "w1-sat", distance: 6, duration: 3100 }
  ],
  checkins: [{ date: "2026-11-12", sleep: 4, soreness: 2, fatigue: 2, energy: 4, motivation: 5, pain: 1 }],
  strength: [], shoes: [{ id: "sh1", name: "Sepatu biru", limit: 700, retired: false }], reviews: { 0: { best: "rutin", hard: "", rec: "", fix: "" } },
  overrides: {}, status: {}, locked: {}, elev: {}, ui: { tab: "home", tourDone: true, tourV: 2 }
});

test("legacy hmtp:v1 data → anonymous slot → first Google sign-in offers merge → verified in Firestore; idempotent", async () => {
  const { page } = await H.device({ seed: { "hmtp:v1": legacyState() } });
  await H.open(page);
  // legacy data visible locally, legacy key untouched
  assert.deepEqual((await H.state(page)).logs.sort(), ["leg1", "leg2"]);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("hmtp:v1"))).owner, "claude-user-1");
  // v2 graduates get a banner instead of a forced tour
  assert.ok(await page.isVisible('[data-act="tutBanner"]'));
  await H.signIn(page, "alice");
  await page.waitForSelector('[data-act="migMerge"]');
  const summary = await page.textContent(".sheet");
  assert.match(summary, /2\s*lari ditambah|2<\/b> lari ditambah|Kalau digabung: 2/);
  await page.click('[data-act="migMerge"]');
  await H.waitSynced(page);
  await H.waitFor(page, () => window.__hmtpTest.sync().meta.migration.verified);
  const st = await H.state(page);
  const runs = await H.adminDocs(`users/${st.uid}/runs`);
  assert.equal(runs.length, 2);
  assert.equal((await H.adminDocs(`users/${st.uid}/checkins`)).length, 1);
  assert.equal((await H.adminDocs(`users/${st.uid}/shoes`)).length, 1);
  const settings = (await H.adminDocs(`users/${st.uid}/plan`)).find(d => d.name.endsWith("/settings"));
  assert.equal(settings.fields.data.mapValue.fields.weekday.integerValue, "3", "device settings carried into empty account");
  // a backup was made before migrating, and the anonymous slot was cleared only after verification
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith("hmtp:backup:"))));
  assert.equal(await page.evaluate(() => localStorage.getItem("hmtp:anon:v3")), null);
  // running the same import again adds nothing
  await page.evaluate(() => { const b = Object.keys(localStorage).find(k => k.startsWith("hmtp:backup:")); const el = document.createElement("button"); el.dataset.act = "backupMerge"; el.dataset.id = b; document.body.appendChild(el); el.click(); el.remove(); });
  await page.waitForSelector(".sheet");
  assert.match(await page.textContent(".sheet"), /Lari: 0 ditambah, 2 duplikat/);
  await H.waitSynced(page);
  assert.equal((await H.adminDocs(`users/${st.uid}/runs`)).length, 2);
  assert.deepEqual(page.errors, []);
});

test("account isolation on one device: B never sees or uploads A's data; A's cache survives sign-out", async () => {
  const { page } = await H.device();
  await H.open(page);
  await H.signIn(page, "alice"); await H.waitSynced(page);
  await H.logRun(page, { date: "2026-11-10", km: 5, dur: "35:00" });
  await H.waitSynced(page);
  const aUid = (await H.state(page)).uid;
  // sign out via the UI
  await H.act(page, "askSignOut"); await page.click('[data-act="doSignOut"]');
  await H.waitFor(page, () => !window.__hmtpTest.uid() && window.__hmtpTest.cloud().state === "signedout");
  assert.equal((await H.state(page)).logs.length, 0, "previous account's runs leave the screen");
  assert.ok(await page.evaluate(u => !!localStorage.getItem(`hmtp:user:${u}:v3`), aUid), "A's local cache kept (no forget)");
  await H.signIn(page, "bob"); await H.waitSynced(page);
  const b = await H.state(page);
  assert.notEqual(b.uid, aUid);
  assert.equal(b.logs.length, 0);
  assert.equal((await H.adminDocs(`users/${b.uid}/runs`)).length, 0, "nothing of A uploaded to B");
  assert.equal(await page.isVisible('[data-act="migMerge"]'), false, "no merge prompt: anonymous slot is empty");
  // switch back to A: A's data returns from its own slot
  await H.act(page, "askSignOut"); await page.click('[data-act="doSignOut"]');
  await H.waitFor(page, () => window.__hmtpTest.cloud().state === "signedout");
  await H.signIn(page, "alice"); await H.waitSynced(page);
  assert.equal((await H.state(page)).logs.length, 1);
});

test("unrelated anonymous data is never silently pushed: user can choose 'use cloud' and keep device data local", async () => {
  // Alice already has cloud data from another device
  const d1 = await H.device(); await H.open(d1.page); await H.signIn(d1.page, "alice"); await H.waitSynced(d1.page);
  await H.logRun(d1.page, { date: "2026-11-10", km: 5, dur: "35:00" }); await H.waitSynced(d1.page);
  // A shared device has someone's anonymous data
  const d2 = await H.device(); await H.open(d2.page);
  await H.logRun(d2.page, { date: "2026-11-11", km: 3, dur: "20:00" });
  await H.signIn(d2.page, "alice");
  await d2.page.waitForSelector('[data-act="migUseCloud"]');
  await d2.page.click('[data-act="migUseCloud"]');
  await H.waitSynced(d2.page);
  const st = await H.state(d2.page);
  assert.equal(st.logs.length, 1);
  assert.equal((await H.adminDocs(`users/${st.uid}/runs`)).length, 1);
  assert.ok(await d2.page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:anon:v3")).logs.length === 1), "anonymous data left untouched");
});

test("two devices sync live; offline edits are queued and delivered after reconnecting", async () => {
  const a = await H.device(), b = await H.device();
  await H.open(a.page); await H.signIn(a.page, "alice"); await H.waitSynced(a.page);
  await H.open(b.page); await H.signIn(b.page, "alice"); await H.waitSynced(b.page);
  await H.logRun(a.page, { date: "2026-11-10", km: 4, dur: "28:00" });
  await H.waitFor(b.page, () => window.__hmtpTest.S().logs.length === 1);
  // B goes offline and logs a run
  await b.ctx.setOffline(true);
  await H.logRun(b.page, { date: "2026-11-14", km: 6, dur: "45:00" });
  await H.waitFor(b.page, () => window.__hmtpTest.cloud().state === "offline");
  assert.ok((await H.state(b.page)).pending >= 1);
  assert.match(await b.page.evaluate(() => { const el = document.createElement("button"); el.dataset.act = "nav"; el.dataset.t = "more"; document.body.appendChild(el); el.click(); el.remove(); return document.querySelector(".js-sync").textContent; }), /Offline/);
  await b.ctx.setOffline(false);
  await H.waitSynced(b.page);
  await H.waitFor(a.page, () => window.__hmtpTest.S().logs.length === 2);
  const uid = (await H.state(a.page)).uid;
  assert.equal((await H.adminDocs(`users/${uid}/runs`)).length, 2, "no duplicate records");
});

test("concurrent edit of the same run: one wins, the other is preserved and restorable", async () => {
  const a = await H.device(), b = await H.device();
  await H.open(a.page); await H.signIn(a.page, "alice"); await H.waitSynced(a.page);
  await H.logRun(a.page, { date: "2026-11-10", km: 4, dur: "28:00" }); await H.waitSynced(a.page);
  await H.open(b.page); await H.signIn(b.page, "alice"); await H.waitSynced(b.page);
  await H.waitFor(b.page, () => window.__hmtpTest.S().logs.length === 1);
  await b.ctx.setOffline(true);
  // edit on both
  const edit = async (page, km) => { await page.evaluate(() => { const id = window.__hmtpTest.S().logs[0].id; const el = document.createElement("button"); el.dataset.act = "editLog"; el.dataset.id = id; document.body.appendChild(el); el.click(); el.remove(); }); await page.fill("#lg-dist", String(km)); await page.click('[data-act="saveLog"]'); };
  await edit(a.page, 5); await H.waitSynced(a.page);
  await edit(b.page, 9);
  await b.ctx.setOffline(false);
  await H.waitFor(b.page, () => window.__hmtpTest.sync().meta.conflicts.length === 1);
  await H.waitSynced(b.page);
  assert.equal(await b.page.evaluate(() => window.__hmtpTest.S().logs[0].distance), 5, "first committed version kept");
  const uid = (await H.state(b.page)).uid;
  assert.equal((await H.adminDocs(`users/${uid}/conflicts`)).length, 1, "losing version archived in Firestore");
  // restore B's version from the Data page
  await H.act(b.page, "nav", { t: "data" });
  await b.page.click('[data-act="conflictMine"]');
  await H.waitSynced(b.page);
  await H.waitFor(a.page, () => window.__hmtpTest.S().logs[0].distance === 9);
});

test("groups: create, one-time invite, opt-in sharing, privacy, reuse rejected, owner removes member", async () => {
  const a = await H.device(), b = await H.device(), c = await H.device();
  await H.open(a.page); await H.signIn(a.page, "alice"); await H.waitSynced(a.page);
  await H.act(a.page, "nav", { t: "bareng" });
  await a.page.fill("#grp-name", "Lari Kantor"); await a.page.click('[data-act="grpCreate"]');
  await a.page.waitForSelector('[data-act="grpInvite"]'); await a.page.click('[data-act="grpInvite"]');
  const link = await a.page.inputValue("#inv-link");
  assert.match(link, /#join=/);
  // Bob opens the link, signs in, joins
  await b.page.goto(H.appUrl() + link.slice(link.indexOf("#")));
  await H.waitFor(b.page, () => window.__hmtpTest);
  await b.page.evaluate(() => { const x = document.querySelector('[data-act="tutClose"]'); if (x) x.click(); });
  await H.signIn(b.page, "bob");
  await b.page.waitForSelector('[data-act="doJoin"]');
  await b.page.click('[data-act="doJoin"]');
  await H.waitFor(b.page, () => !document.querySelector(".sheet") && document.body.textContent.includes("Lari Kantor"));
  await H.logRun(b.page, { date: "2026-11-10", km: 7.5, dur: "52:00" }); await H.waitSynced(b.page);
  // private by default: Alice sees Bob as member without numbers
  await H.waitFor(a.page, () => document.body.textContent.includes("Bob"));
  assert.match(await a.page.textContent('[data-tour="groups"]'), /Belum berbagi progres/);
  // Bob opts in → only the whitelisted summary appears
  await b.page.click('[data-act="toggleShare"]');
  await H.waitFor(a.page, () => document.querySelector('[data-tour="groups"]').textContent.includes("7,5"));
  const gid = await a.page.evaluate(() => window.__hmtpTest && document.querySelector('[data-tour="groups"]') && GROUPS.sel);
  const prog = await H.adminDocs(`groups/${gid}/progress`);
  assert.equal(prog.length, 1);
  assert.deepEqual(Object.keys(prog[0].fields).sort(), ["bestPace", "displayName", "fullWeeks", "lastRun", "longest", "photoURL", "runs", "totalKm", "updatedAt", "week", "weekKm"]);
  // Carol reuses the same link → rejected
  await c.page.goto(H.appUrl() + link.slice(link.indexOf("#")));
  await H.waitFor(c.page, () => window.__hmtpTest);
  await c.page.evaluate(() => { const x = document.querySelector('[data-act="tutClose"]'); if (x) x.click(); });
  await H.signIn(c.page, "carol");
  await c.page.waitForSelector('[data-act="doJoin"]'); await c.page.click('[data-act="doJoin"]');
  await c.page.waitForSelector("#join-err .err");
  assert.match(await c.page.textContent("#join-err"), /udah dipakai|kedaluwarsa/);
  // Bob turns sharing off → summary deleted
  await b.page.click('[data-act="toggleShare"]');
  await H.waitFor(a.page, () => document.querySelector('[data-tour="groups"]').textContent.includes("Belum berbagi progres"));
  assert.equal((await H.adminDocs(`groups/${gid}/progress`)).length, 0);
  // Alice removes Bob → Bob loses access and his membership is cleaned up
  await a.page.click('[data-act="grpRemove"]'); await a.page.click('[data-act="grpRemoveOk"]');
  await H.waitFor(b.page, () => GROUPS.list && GROUPS.list.length === 0, null, 20000);
  for (const p of [a.page, b.page, c.page]) assert.deepEqual(p.errors, []);
});

test("tutorial: new user gets quick start; completion is per account and synced; contextual help opens a feature tour", async () => {
  const d = await H.device();
  await d.page.goto(H.appUrl());
  await H.waitFor(d.page, () => window.__hmtpTest);
  assert.ok(await d.page.isVisible("#tour"));
  assert.match(await d.page.textContent("#tour"), /Langkah 1 dari 6/);
  await H.signIn(d.page, "dina"); await H.waitSynced(d.page);
  // finish quick start
  for (let i = 0; i < 6; i++) await d.page.click('[data-act="tutNext"]');
  await H.waitSynced(d.page);
  const uid = (await H.state(d.page)).uid;
  const tut = (await H.adminDocs(`users/${uid}/plan`)).find(x => x.name.endsWith("/tutorial"));
  assert.equal(tut.fields.data.mapValue.fields.quick.booleanValue, true);
  // contextual help on the calendar → starts the calendar tour on the right page with a real highlight
  await H.act(d.page, "nav", { t: "cal" });
  await d.page.click('.helpbtn[data-k="cal"]');
  assert.match(await d.page.textContent(".sheet"), /Apa ini\?[\s\S]*Cara pakai/);
  await d.page.click('.sheet [data-act="tutStart"]');
  assert.match(await d.page.textContent("#tour"), /Jadwal latihan · Langkah 1 dari 6/);
  for (let i = 0; i < 4; i++) await d.page.click('[data-act="tutNext"]');
  assert.ok(await d.page.$('[data-tour="cal-actions"].tour-hl'), "session actions highlighted on a day that has sessions");
  // a new device for the same account does not show the quick start again
  const d2 = await H.device(); await d2.page.goto(H.appUrl()); await H.waitFor(d2.page, () => window.__hmtpTest);
  await d2.page.evaluate(() => { const x = document.querySelector('[data-act="tutClose"]'); if (x) x.click(); });
  await H.signIn(d2.page, "dina"); await H.waitSynced(d2.page);
  assert.equal(await d2.page.evaluate(() => window.__hmtpTest.S().tutorial.quick), true);
});

test("mobile + desktop layouts: no horizontal overflow, tour bubble does not cover the target", async () => {
  for (const vp of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    const { page } = await H.device({ viewport: vp, cloud: false });
    await page.goto(H.appUrl().replace("?emulator=1", ""));
    await page.waitForSelector("#tour");
    for (const t of ["home", "cal", "log", "review", "more", "bareng", "data", "notif", "tutorials", "settings"]) {
      await H.act(page, "nav", { t });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${t} @${vp.width}x${vp.height} overflows by ${over}px`);
    }
    await H.act(page, "tutStart", { id: "dashboard" });
    for (let i = 0; i < 7; i++) {
      const overlap = await page.evaluate(() => { const t = document.querySelector(".tour-hl"), b = document.querySelector("#tour .bubble"); if (!t || !b) return 0; const r = t.getBoundingClientRect(), q = b.getBoundingClientRect(); const top = Math.max(r.top, q.top), bot = Math.min(r.top + Math.min(r.height, 100), q.bottom); return Math.max(0, bot - top); });
      assert.ok(overlap < 30, `bubble covers target (step ${i + 1}) by ${overlap}px @${vp.width}x${vp.height}`);
      await page.click('[data-act="tutNext"]');
    }
    assert.deepEqual(page.errors, []);
  }
});

test("local-only mode (no Firebase config) works fully and is labelled honestly", async () => {
  const { page, ctx } = await H.device({ cloud: false });
  await ctx.addInitScript(() => { window.__permAsked = 0; if (window.Notification) Notification.requestPermission = () => { window.__permAsked++; return Promise.resolve("default"); }; });
  await page.goto(H.appUrl().replace("?emulator=1", ""));
  await page.evaluate(() => document.querySelector('[data-act="tutClose"]').click());
  await H.logRun(page, { date: "2026-11-10", km: 5, dur: "35:00" });
  await H.act(page, "nav", { t: "more" });
  assert.match(await page.textContent('[data-tour="acct"]'), /Mode lokal/);
  await H.act(page, "nav", { t: "notif" });
  assert.match(await page.textContent("main"), /Belum ada notifikasi yang dikirim/);
  await page.click('[data-act="notifSave"]');
  assert.equal(await page.evaluate(() => window.__permAsked), 0, "notification permission is never requested");
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("hmtp:anon:v3")).logs.length), 1);
  assert.deepEqual(page.errors, []);
});
