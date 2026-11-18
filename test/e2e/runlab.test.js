// RUNLAB Milestone 1: the Lab tab end to end (Chromium + Auth/Firestore emulators + real rules).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.js";
// Inspector sections are collapsible on phones; open one the way a user would (tap its summary).
const openFold = async (page, cls) => { if (!(await page.$eval(`details.${cls}`, d => d.open))) await page.click(`details.${cls} > summary`); };

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

const FAKE_RESULT = /hasil analisis:|AI menemukan|riset menunjukkan|penelitian membuktikan|kemungkinan cedera|diagnos(is|a) kamu/i;

test("Lab: create → one question at a time (answer, unknown, skip, correct) → honest scope → reload → edit → notes → export → delete; synced privately", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.signIn(page, "rina"); await H.waitSynced(page);
  for (const [d, km, dur] of [["2026-11-10", 5, "35:00"], ["2026-11-12", 8, ""], ["2026-11-14", 10, "1:05:00"]]) await H.logRun(page, { date: d, km, dur });
  await page.click('#dock [data-t="lab"]');
  assert.deepEqual(await page.$$eval("#dock button span", e => e.map(x => x.textContent)), ["Hari ini", "Lari", "Lab", "Kamu"]);
  const caps = await page.textContent(".lab-caps");
  assert.match(caps, /Analisis lokal[\s\S]*Aktif/); assert.match(caps, /Konsultasi AI[\s\S]*Tidak aktif[\s\S]*Belum diatur/);
  // Workout Compiler is a visibly disabled placeholder with no action
  const tool = await page.$('[data-tour="lab-compiler"]');
  assert.equal(await tool.getAttribute("aria-disabled"), "true"); assert.equal(await tool.$("[data-act]"), null);
  assert.match(await tool.textContent(), /Segera hadir/);
  // create
  await page.fill("#lab-q", "Kenapa pace-ku nggak membaik padahal aku lari lebih banyak?");
  await page.click('[data-act="labCreate"]');
  await page.waitForSelector('[data-tour="lab-ask"]');
  // feedback: compact success snackbar; the floating record button never covers the Lab
  assert.equal(await page.getAttribute("#toast", "data-kind"), "ok"); assert.match(await page.textContent("#toast"), /Investigasi tersimpan/);
  assert.equal(await page.$eval("#rec", e => getComputedStyle(e).display), "none");
  const tb = await page.$eval("#toast", e => e.getBoundingClientRect().height); assert.ok(tb < 64, "snackbar stays compact");
  assert.match(await page.textContent(".lab-type"), /Tren performa[\s\S]*dikenali dari: .*pace/);
  // exactly one question card at a time, each with a reason
  assert.equal((await page.$$('[data-tour="lab-ask"]')).length, 1);
  assert.match(await page.textContent('[data-tour="lab-ask"]'), /Periode mana[\s\S]*Kenapa ditanya\?/);
  await page.click('[data-act="labAns"][data-v="28"]');
  assert.match(await page.textContent('[data-tour="lab-ask"]'), /“Membaik” buat kamu artinya apa\?/);
  await page.click('[data-act="labSkip"][data-s="unknown"]');
  await page.click('[data-act="labSkip"][data-s="skipped"]');
  // scope: real counts, missing durations shown, no fabricated result
  await page.waitForSelector('[data-tour="lab-scope"]');
  const scope = await page.textContent('[data-tour="lab-scope"]');
  assert.match(scope, /3 lari masuk analisis/); assert.match(scope, /Durasi[\s\S]*2\/3/); assert.match(scope, /Kadens\s*0\/3/);
  assert.match(scope, /Jalankan analisis/);
  assert.ok(!FAKE_RESULT.test(await page.textContent("main")), "no fake analysis, research or AI result");
  // answers read back honestly; correction reopens only that question
  assert.match(await page.textContent(".lab-answers"), /4 minggu[\s\S]*nggak tahu[\s\S]*dilewati/);
  await page.click('[data-act="labReopen"][data-k="window"]');
  await page.waitForSelector('[data-tour="lab-ask"]');
  await page.click('[data-act="labAns"][data-v="0"]');
  assert.match(await page.textContent('[data-tour="lab-scope"]'), /semua data sampai/i);
  // edit question, notes
  await page.click('[data-act="labEditQ"]'); await page.fill("#lab-eq", "Apakah pace easy run-ku membaik 3 bulan ini?"); await page.click('[data-act="labSaveQ"]');
  assert.match(await page.textContent(".lab-head"), /Pertanyaan asli: Kenapa pace-ku/);
  await openFold(page, "lab-notes"); await page.fill("#lab-notes", "Mungkin karena lebih sering lari malam."); await page.click('[data-act="labSaveNotes"]');
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

test("Lab analysis + research: deterministic findings with method and record set; chart selection; real-shaped PubMed/OpenAlex results (mocked) saved as sources; no AI claims", async () => {
  const d = await H.device();
  await d.ctx.route(/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/esearch/, r => r.fulfill({ json: { esearchresult: { count: "2", idlist: ["38000001", "38000002"] } } }));
  await d.ctx.route(/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/esummary/, r => r.fulfill({ json: { result: { uids: ["38000001", "38000002"],
    "38000001": { uid: "38000001", title: "Time-of-day effects on running performance: a systematic review.", authors: [{ name: "Doe J" }, { name: "Roe A" }], pubdate: "2024 Mar", fulljournalname: "Sports Medicine", pubtype: ["Journal Article", "Systematic Review"], articleids: [{ idtype: "doi", value: "10.1000/tod.2024.1" }] },
    "38000002": { uid: "38000002", title: "Cell signalling in yeast.", authors: [{ name: "X Y" }], pubdate: "2020", fulljournalname: "Yeast", pubtype: ["Journal Article"], articleids: [] } } } }));
  await d.ctx.route(/eutils\.ncbi\.nlm\.nih\.gov\/entrez\/eutils\/efetch/, r => r.fulfill({ contentType: "text/xml", body: '<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>38000001</PMID><Article><Abstract><AbstractText>Running performance varied by time of day in recreational runners.</AbstractText></Abstract></Article></MedlineCitation></PubmedArticle></PubmedArticleSet>' }));
  await d.ctx.route(/api\.openalex\.org\/works/, r => r.fulfill({ json: { results: [
    { id: "https://openalex.org/W111", doi: "https://doi.org/10.1000/tod.2024.1", display_name: "Time-of-day effects on running performance", publication_year: 2024, authorships: [{ author: { display_name: "J. Doe" } }], primary_location: { source: { display_name: "Sports Medicine" } }, abstract_inverted_index: { Running: [0], varies: [1] }, type: "review", ids: { pmid: "https://pubmed.ncbi.nlm.nih.gov/38000001" } },
    { id: "https://openalex.org/W222", doi: null, display_name: "Morning versus evening training in endurance runners", publication_year: 2022, authorships: [], primary_location: null, abstract_inverted_index: null, type: "article", ids: {} } ] } }));
  const { page } = d; await H.open(page);
  const t = (id, hh, sec, date) => ({ id, date, type: "easy", sessionId: null, distance: 6, duration: sec, elev: null, hrAvg: null, hrMax: null, rpe: 4, weather: "", notes: "", src: "File", extId: `t:${date}T${hh}:10` });
  await page.evaluate(runs => { const S = window.__hmtpTest.S(); S.logs.push(...runs); }, [t("m1", "06", 2400, "2026-11-02"), t("m2", "06", 2460, "2026-11-04"), t("m3", "07", 2430, "2026-11-06"), t("n1", "19", 2520, "2026-11-03"), t("n2", "20", 2580, "2026-11-05"), t("n3", "19", 2550, "2026-11-07")]);
  await H.act(page, "nav", { t: "lab" });
  await page.click('[data-act="labStarter"][data-i="1"]');
  assert.equal(await page.getAttribute('[data-act="labStarter"][data-i="1"]', "aria-pressed"), "true", "selected starter tile is unmistakable");
  await page.click('[data-act="labCreate"]');
  await page.click('[data-act="labAns"][data-v="28"]'); await page.click('[data-act="labAns"][data-v="time"]'); await page.click('[data-act="labAns"][data-v="pace"]');
  await page.click('[data-act="labAnalyze"]');
  await page.waitForSelector('[data-tour="lab-findings"]');
  const cmp = await page.textContent('[data-analysis="compare"]');
  assert.match(cmp, /Pagi \(sebelum 10:00\): median 6:45 \/km \(n 3\)[\s\S]*Sore\/malam \(setelah 15:00\): median 7:05 \/km \(n 3\)/);
  assert.match(cmp, /Data terbatas|Data cukup/);
  // focal finding: evidence grade (3 per group can never be "supported"), metric n vs eligible records, exclusions
  assert.match(await page.getAttribute('[data-analysis="compare"]', "class"), /is-lead/);
  assert.match(cmp, /Observasi/); assert.ok(!/Didukung uji statistik/.test(cmp));
  assert.match(cmp, /n 6 \(3 \+ 3\) dipakai di analisis ini dari \d+ lari yang memenuhi syarat/);
  // chart point selection → readout with a link to the source run
  await page.click('#ch-compare [data-act="chartSel"][data-i="0"]');
  assert.match(await page.textContent("#ro-compare"), /6 km[\s\S]*Buka lari/);
  assert.equal(await page.getAttribute('#ch-compare [data-act="chartSel"][data-i="0"]', "aria-pressed"), "true");
  // comparison controls: time view keeps the selection; hiding a group drops its marks and the median bracket; both can never be hidden
  await page.click('#ch-compare [data-act="labCompView"][data-v="time"]');
  assert.equal(await page.locator('#ch-compare .ch-medline').count(), 2);
  assert.equal(await page.getAttribute('#ch-compare [data-act="chartSel"][data-i="0"]', "aria-pressed"), "true");
  await page.click('#ch-compare [data-act="labCompHide"][data-g="b"]');
  assert.equal(await page.getAttribute('#ch-compare [data-act="labCompHide"][data-g="b"]', "aria-pressed"), "false");
  assert.equal(await page.locator('#ch-compare [data-act="chartSel"]').count(), 3);
  await page.click('#ch-compare [data-act="labCompHide"][data-g="a"]');
  assert.equal(await page.getAttribute('#ch-compare [data-act="labCompHide"][data-g="b"]', "aria-pressed"), "true");
  assert.equal(await page.getAttribute('#ch-compare [data-act="labCompHide"][data-g="a"]', "aria-pressed"), "false");
  assert.match(await page.textContent("#ro-compare"), /Arahkan atau ketuk titik/);
  await page.click('#ch-compare [data-act="labCompHide"][data-g="a"]');
  await page.click('#ch-compare [data-act="labCompView"][data-v="spread"]');
  assert.equal(await page.locator('#ch-compare .ch-bracket').count(), 1);
  // method inspector: version, window and exclusions are inspectable
  await page.click('[data-analysis="compare"] .lab-method summary');
  assert.match(await page.textContent('[data-analysis="compare"] .lab-method'), /compare-1[\s\S]*Cara hitung[\s\S]*Batasan/);
  // snapshot saved with exact record ids + method version
  const snaps = await page.evaluate(() => Object.values(window.__hmtpTest.S().lab)[0].snapshots);
  assert.deepEqual(snaps.map(s => s.methodVersion).sort(), ["compare-1", "quality-1"]);
  assert.deepEqual(snaps.find(s => s.analysisId === "compare").includedRecordIds.sort(), ["m1", "m2", "m3", "n1", "n2", "n3"]);
  // correcting an earlier answer drops the dependent answer and makes the snapshot stale
  await openFold(page, "lab-answers"); await page.click('[data-act="labReopen"][data-k="factor"]');
  assert.equal(await page.evaluate(() => Object.values(window.__hmtpTest.S().lab)[0].answers.measure), undefined, "dependent answer removed");
  assert.equal(await page.$('[data-tour="lab-findings"]'), null, "no stale findings shown");
  await page.click('[data-act="labAns"][data-v="time"]'); await page.click('[data-act="labAns"][data-v="rpe"]');
  assert.match(await page.textContent('[data-tour="lab-scope"]'), /Snapshot lama tidak cocok/, "different answers → stale snapshot");
  await page.click('[data-act="labAnalyze"]'); await page.waitForSelector('[data-tour="lab-findings"]');
  // research: real-shaped provider data, deduplicated, irrelevant item dropped, no invented fields
  await page.click('[data-act="labResearch"]');
  await page.waitForSelector("#lab-research .lab-src-card");
  const cards = await page.$$eval("#lab-research .lab-src-card", els => els.map(e => e.textContent));
  assert.equal(cards.length, 2, "DOI duplicate merged, yeast paper dropped as irrelevant");
  assert.match(cards[0], /Time-of-day effects on running performance[\s\S]*Doe J[\s\S]*Sports Medicine[\s\S]*PMID 38000001[\s\S]*10\.1000\/tod\.2024\.1/);
  assert.match(cards[0], /tinjauan|meta/);
  await page.click('#lab-research [data-act="labSaveSrc"]');
  const src = await page.evaluate(() => Object.values(window.__hmtpTest.S().lab)[0].sources);
  assert.equal(src.length, 1); assert.equal(src[0].pmid, "38000001"); assert.match(src[0].url, /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/38000001\//);
  assert.match(await page.textContent("main"), /belum diatur/);
  assert.ok(!/AI menemukan|menurut AI/i.test(await page.textContent("main")));
  assert.deepEqual(page.errors, []);
});
