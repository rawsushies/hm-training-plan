// RUNLAB Milestone 1: the Lab tab end to end (Chromium + Auth/Firestore emulators + real rules).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

const FAKE_RESULT = /hasil analisis:|AI menemukan|riset menunjukkan|penelitian membuktikan|kemungkinan cedera|diagnos(is|a) kamu/i;

test("Lab: create → one question at a time (answer, unknown, skip, correct) → honest scope → reload → edit → notes → export → delete; synced privately", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.signIn(page, "rina"); await H.waitSynced(page);
  for (const [d, km, dur] of [["2026-11-10", 5, "35:00"], ["2026-11-12", 8, ""], ["2026-11-14", 10, "1:05:00"]]) await H.logRun(page, { date: d, km, dur });
  await page.click('#dock [data-t="lab"]');
  assert.deepEqual(await page.$$eval("#dock button span", e => e.map(x => x.textContent)), ["Hari ini", "Lab", "Lari", "Kamu"]);
  assert.match(await page.textContent(".lab-status"), /Analisis: belum tersedia[\s\S]*Riset: belum terhubung[\s\S]*AI: tidak aktif/);
  // Workout Compiler is a visibly disabled placeholder with no action
  const tool = await page.$('[data-tour="lab-compiler"]');
  assert.equal(await tool.getAttribute("aria-disabled"), "true"); assert.equal(await tool.$("[data-act]"), null);
  assert.match(await tool.textContent(), /Segera hadir/);
  // create
  await page.fill("#lab-q", "Kenapa pace-ku nggak membaik padahal aku lari lebih banyak?");
  await page.click('[data-act="labCreate"]');
  await page.waitForSelector('[data-tour="lab-ask"]');
  assert.match(await page.textContent(".lab-type"), /Tren performa[\s\S]*dikenali dari kata: .*pace/);
  // exactly one question card at a time, each with a reason
  assert.equal((await page.$$('[data-tour="lab-ask"]')).length, 1);
  assert.match(await page.textContent('[data-tour="lab-ask"]'), /Periode mana[\s\S]*Kenapa ditanya:/);
  await page.click('[data-act="labAns"][data-v="28"]');
  assert.match(await page.textContent('[data-tour="lab-ask"]'), /“Membaik” buat kamu artinya apa\?/);
  await page.click('[data-act="labSkip"][data-s="unknown"]');
  await page.click('[data-act="labSkip"][data-s="skipped"]');
  // scope: real counts, missing durations shown, no fabricated result
  await page.waitForSelector('[data-tour="lab-scope"]');
  const scope = await page.textContent('[data-tour="lab-scope"]');
  assert.match(scope, /Lari dipakai\s*3/); assert.match(scope, /Durasi[\s\S]*2\/3/); assert.match(scope, /Kadens\s*0\/3/);
  assert.match(scope, /Analisis belum tersedia di versi ini/);
  assert.ok(!FAKE_RESULT.test(await page.textContent("main")), "no fake analysis, research or AI result");
  // answers read back honestly; correction reopens only that question
  assert.match(await page.textContent(".lab-answers"), /4 minggu[\s\S]*nggak tahu[\s\S]*dilewati/);
  await page.click('[data-act="labReopen"][data-k="window"]');
  await page.waitForSelector('[data-tour="lab-ask"]');
  await page.click('[data-act="labAns"][data-v="0"]');
  assert.match(await page.textContent('[data-tour="lab-scope"]'), /Semua data sampai/);
  // edit question, notes
  await page.click('[data-act="labEditQ"]'); await page.fill("#lab-eq", "Apakah pace easy run-ku membaik 3 bulan ini?"); await page.click('[data-act="labSaveQ"]');
  assert.match(await page.textContent(".lab-head"), /Pertanyaan asli: Kenapa pace-ku/);
  await page.fill("#lab-notes", "Mungkin karena lebih sering lari malam."); await page.click('[data-act="labSaveNotes"]');
  await H.waitSynced(page);
  // synced as a private record
  const uid = (await H.state(page)).uid, docs = await H.adminDocs(`users/${uid}/lab`);
  assert.equal(docs.length, 1); assert.match(JSON.stringify(docs[0]), /Apakah pace easy run-ku/);
  // reload: still there, reopenable
  await page.reload(); await H.ready(page);
  await page.click('#dock [data-t="lab"]'); await page.click('[data-act="labOpen"]');
  assert.match(await page.textContent(".lab-title"), /Apakah pace easy run-ku membaik/);
  // export: self-describing snapshot
  await page.click('[data-act="labExport"]'); await page.waitForSelector("#tx-out");
  const ex = JSON.parse(await page.inputValue("#tx-out"));
  assert.equal(ex.kind, "werunit-lab-investigation"); assert.equal(ex.methods.analysis, null); assert.equal(ex.scope.included.length, 3);
  await page.click('.sheet [data-act="closeM"]');
  // backup taken before the first Lab write
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith("hmtp:backup:") && /investigasi Lab/.test(localStorage.getItem(k)))));
  // delete
  await page.click('[data-act="labDelete"]'); await page.click('[data-act="labDeleteOk"]');
  await H.waitSynced(page);
  assert.equal(await page.evaluate(() => Object.keys(window.__hmtpTest.S().lab).length), 0);
  const after = await H.adminDocs(`users/${uid}/lab`);
  assert.ok(after.every(d => d.fields.deleted.booleanValue === true), "tombstone, like every other record");
  assert.deepEqual(page.errors, []);
});

test("existing flows survive: Race via Kamu and the Hari ini chip, continue-investigation card; no transit feature", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.act(page, "nav", { t: "more" });
  await page.click('[data-tour="kamu-race"] [data-act="nav"][data-t="race"]');
  assert.equal(await page.getAttribute('#dock [data-t="more"]', "aria-current"), "page");
  assert.ok(await page.$("#rtabs"), "race workspace renders");
  await H.act(page, "nav", { t: "home" });
  assert.ok(await page.$('[data-tour="race-chip"]'), "countdown chip on Hari ini");
  await H.act(page, "nav", { t: "lab" });
  await page.fill("#lab-q", "Apakah aku lebih efisien lari pagi atau malam?"); await page.click('[data-act="labCreate"]');
  await H.act(page, "nav", { t: "home" });
  assert.match(await page.textContent(".lab-cont"), /Lanjutkan investigasi[\s\S]*pagi atau malam/);
  assert.ok(!/transit|stridetransit/i.test(await page.textContent("body")));
  assert.deepEqual(page.errors, []);
});
