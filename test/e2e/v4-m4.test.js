// M4: shoes (initial km, rotation, discovery links) and integrations (honest statuses, Health Connect import through
// Capacitor's real Android bridge with a fake native Health plugin). Does NOT prove Health Connect on a real phone.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "./harness.js";

const BRIDGE = readFileSync("node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js", "utf8");
const P = { Filesystem: ["writeFile"], WebView: ["setServerBasePath"], Health: ["isAvailable", "requestAuthorization", "checkAuthorization", "queryWorkouts"] };
const pluginJS = () => Object.entries(P).map(([id, ms]) => `(function(w){var a=(w.Capacitor=w.Capacitor||{});var p=(a.Plugins=a.Plugins||{});var t=(p['${id}']={});
t.addListener=function(e,cb){return w.Capacitor.addListener('${id}',e,cb)};${ms.map(m => `t['${m}']=function(o){return w.Capacitor.nativePromise('${id}','${m}',o)};`).join("")}})(window);`).join("\n")
  + `\nwindow.Capacitor.PluginHeaders=${JSON.stringify(Object.entries(P).map(([name, ms]) => ({ name, methods: ms.map(m => ({ name: m, rtype: "promise" })) })))};`;
const FAKE = () => {
  window.__hc = [];
  const W = [
    { workoutType: "running", duration: 2100, totalDistance: 6020, startDate: "2026-11-03T22:40:00.000Z", endDate: "2026-11-03T23:15:00.000Z", sourceName: "Jam", platformId: "w1" },
    { workoutType: "cycling", duration: 3600, totalDistance: 20000, startDate: "2026-11-04T22:00:00.000Z", endDate: "2026-11-04T23:00:00.000Z", platformId: "w2" },
    { workoutType: "running", duration: 1800, totalDistance: 5000, startDate: "2026-11-05T22:40:00.000Z", endDate: "2026-11-05T23:10:00.000Z", platformId: "w3" }];
  const ans = { isAvailable: () => ({ available: true, platform: "android" }), requestAuthorization: o => ({ readAuthorized: o.read, readDenied: [], writeAuthorized: [], writeDenied: [] }), queryWorkouts: () => ({ workouts: W }) };
  window.androidBridge = { postMessage: j => { const c = JSON.parse(j); if (c.pluginId !== "Health") return; window.__hc.push([c.methodName, c.options]);
    setTimeout(() => window.Capacitor.fromNative({ callbackId: c.callbackId, pluginId: c.pluginId, methodName: c.methodName, success: true, data: ans[c.methodName](c.options || {}) }), 5); } };
};

before(async () => { await H.startServer(); await H.launch(); });
after(async () => { await H.closeBrowser(); H.stopServer(); });
beforeEach(async () => { await H.resetEmulators(); });

test("shoes: initial km + tracked, rotation suggestion with reason, catalogue with sourced facts above our plus/minus", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.act(page, "nav", { t: "shoes" });
  await page.click('[data-act="askStart"][data-f="shoe"]');        // adding a shoe is five questions from Kiki
  await H.askType(page, "MerkA"); await H.askType(page, "Harian"); await H.askPick(page, "daily");
  await H.askType(page, 250); await H.askType(page, 600);
  assert.match(await page.textContent(".ask-sum"), /Harian[\s\S]*250[\s\S]*600/, "summary before saving");
  await page.click('[data-act="askSave"]');
  await H.logRun(page, { date: "2026-11-10", km: 8, dur: "56:00" });
  await H.act(page, "nav", { t: "shoes" });
  const t = await page.textContent("main");
  assert.match(t, /258 \/ 600 km/); assert.match(t, /250 km awal \(diisi manual\) \+ 8 km tercatat/);
  assert.ok(await page.$('[data-pill="shoetab"] .glass-pill'), "glass segmented control");
  await page.click('[data-act="shoeTab"][data-v="rotation"]');
  assert.match(await page.textContent("main"), /Saran: Harian[\s\S]*Kenapa: dipakai buat harian/);
  // Rekomendasi: sourced facts first, then our Plus/Minus tab below; one tap adds the model
  await page.click('[data-act="shoeTab"][data-v="catalog"]');
  const card = '[data-cat="nike-pegasus-42"]';
  const facts = await page.textContent(card + " .cat-facts");
  assert.match(facts, /Nike[\s\S]*Pegasus 42[\s\S]*Rilis 9 Apr 2026[\s\S]*Sumber: nike\.com · diambil 7 Nov 2026/);
  assert.match(await page.getAttribute(card + " .cat-facts a", "href"), /^https:\/\/www\.nike\.com\//);
  const order = await page.$eval(card, el => [el.querySelector(".cat-facts"), el.querySelector(".cat-notes")].map(n => n.getBoundingClientRect().top));
  assert.ok(order[0] < order[1], "notes are below the sourced facts");
  assert.match(await page.textContent(card + " .cat-list"), /Serba bisa/);
  await page.click(card + ' [data-act="catSide"][data-v="nike-pegasus-42|minus"]');
  assert.match(await page.textContent(card + " .cat-list.minus"), /bantalan maksimal/);
  await page.click('[data-act="catUse"][data-v="race"]');
  assert.equal(await page.$(card), null, "filter hides daily shoes");
  await page.click('[data-act="catAdd"][data-id="nike-alphafly-3"]');
  assert.equal(await page.evaluate(() => window.__hmtpTest.S().shoes.find(s => s.model === "Alphafly 3").use), "race");
  const shoe = await page.evaluate(() => window.__hmtpTest.S().shoes[0]);
  assert.equal(shoe.initialKm, 250); assert.equal(shoe.use, "daily"); assert.equal(shoe.brand, "MerkA");
  assert.deepEqual(page.errors, []);
});

test("integrations (web): only file import is available; the rest say exactly why", async () => {
  const { page } = await H.device(); await H.open(page);
  await H.act(page, "nav", { t: "integ" });
  const t = await page.textContent('[data-tour="integ"]');
  assert.equal((t.match(/Tersedia/g) || []).length, 1);
  assert.match(t, /Strava[\s\S]*Butuh server/); assert.match(t, /Huawei[\s\S]*Butuh kredensial/); assert.match(t, /Garmin[\s\S]*Khusus partner/);
  assert.match(t, /Health Connect[\s\S]*Tidak didukung di sini/);
  assert.deepEqual(page.errors, []);
});

test("Health Connect (Android bridge): read-only permission, runs only, review before saving, re-sync marks duplicates", async () => {
  const d = await H.device();
  await d.ctx.addInitScript(FAKE);
  await d.ctx.addInitScript({ content: `window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} };\n${BRIDGE}\n${pluginJS()}` });
  const { page } = d; await H.open(page);
  await page.click(".gate [data-act='gateHc']");               // on the Android app Health Connect is linked at the gate first
  await page.waitForFunction(() => !document.querySelector(".gate"));
  await H.finishOnboarding(page);
  await page.evaluate(() => { if (document.querySelector("#tour")) document.querySelector('[data-act="tutClose"]').click(); });
  await H.act(page, "nav", { t: "integ" });
  await page.click('[data-act="hcSync"]');
  await page.waitForSelector('[data-act="impSave"]');
  const calls = await page.evaluate(() => window.__hc);
  assert.deepEqual(calls.find(c => c[0] === "requestAuthorization")[1], { read: ["workouts", "distance"] }, "read-only, no write scopes");
  assert.equal(await page.evaluate(() => M.items.length), 2, "cycling workout skipped");
  await H.act(page, "impAll", { v: "1" });             // runs before the plan start are listed but not preselected
  await page.click('[data-act="impSave"]');
  await H.waitFor(page, () => window.__hmtpTest.S().logs.length === 2);
  const logs = await page.evaluate(() => window.__hmtpTest.S().logs.map(l => ({ d: l.distance, src: l.src, ext: l.extId, hr: l.hrAvg })));
  assert.deepEqual(logs.map(l => l.d).sort(), [5, 6.02]); assert.ok(logs.every(l => l.src === "Health Connect" && /^hc:w[13]$/.test(l.ext) && l.hr === null));
  await H.act(page, "nav", { t: "integ" }); await page.click('[data-act="hcSync"]');
  await page.waitForSelector('[data-act="impSave"]');
  assert.equal(await page.evaluate(() => M.items.filter(i => i.dup).length), 2, "second sync: both already imported");
  assert.deepEqual(page.errors, []);
});

test("auto catalogue: weekly data is pulled, merged with the seed (seed notes win, photo added), new models appear with auto notes; bad data rejected", async () => {
  const d = await H.device();
  const data = { schema: 4, retrieved: "2026-11-09", fx: { date: "2026-11-06", source: "ECB via frankfurter.app", rates: { AUD: 10500 } }, models: [
    { id: "nike-pegasus-42-keely", brand: "Nike", model: "Pegasus 42 Keely Hodgkinson", released: "2026-04-01", use: "daily", source: { label: "Shop A", url: "https://a.example/products/peg" }, image: { url: "https://cdn.shopify.com/x/peg.jpg?width=480", credit: "Shop A", page: "https://a.example/products/peg" }, specs: { weightG: 280, price: 169, priceCurrency: "AUD" }, plus: ["auto plus"], minus: [] },
    { id: "puma-deviate-nitro-4", brand: "PUMA", model: "Deviate Nitro 4", released: "2026-10-20", use: "tempo", source: { label: "Shop B", url: "https://b.example/products/dn4" }, image: { url: "https://cdn.shopify.com/x/dn4.jpg?width=480", credit: "Shop B", page: "https://b.example/products/dn4" }, specs: { weightG: 245, dropMm: 8, plate: "carbon", price: 260, priceCurrency: "AUD" }, plus: ["Pakai carbon plate untuk race dan sesi cepat"], minus: ["Carbon plate: lebih cepat aus/kurang ekonomis kalau dipakai harian"] },
    { id: "evil", brand: "X", model: "<img src=x onerror=alert(1)>", released: "2026-10-01", use: "daily", source: { label: "x", url: "javascript:alert(1)" }, plus: [], minus: [] }
  ] };
  await d.ctx.route(/raw\.githubusercontent\.com\/rawsushies\/hm-training-plan\/data-shoes\/shoes\.json/, r => r.fulfill({ json: data, headers: { "access-control-allow-origin": "*" } }));
  await d.ctx.route(/cdn\.shopify\.com/, r => r.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' }));
  const { page } = d; await H.open(page);
  await H.act(page, "nav", { t: "shoes" });
  await page.click('[data-act="shoeTab"][data-v="catalog"]');
  await page.waitForSelector('[data-cat="auto-pumadeviatenitro4"]');
  const auto = await page.textContent('[data-cat="auto-pumadeviatenitro4"]');
  assert.match(auto, /Pertama terdaftar di toko 20 Okt 2026/); assert.match(auto, /245 g · drop 8 mm · carbon plate/); assert.match(auto, /AUD 260 ≈ Rp 2,7 jt/);
  assert.match(auto, /Otomatis dari spesifikasi yang ditulis toko/); assert.match(auto, /Foto: Shop B/);
  const peg = await page.textContent('[data-cat="nike-pegasus-42"]');
  assert.match(peg, /Rilis 9 Apr 2026/, "seed date wins"); assert.match(peg, /Serba bisa/, "seed notes win"); assert.match(peg, /Foto: Shop A/, "photo added from the edition listing");
  assert.match(peg, /AUD 169 ≈ Rp 1,8 jt/); assert.match(peg, /Harga terendah di Shop A · kurs ECB via frankfurter\.app 6 Nov 2026/);
  assert.equal(await page.$('[data-cat="auto-nikepegasus42keelyhodgkinson"]'), null, "edition listing folded into the seed card");
  assert.match(await page.textContent('[data-cat="hoka-speedgoat-7"]'), /Harga: belum ada di toko yang dipantau/);
  // Plus/Minus switches in place: no re-render, scroll position kept
  await page.$eval('[data-cat="hoka-speedgoat-7"]', el => el.scrollIntoView({ block: "center" }));
  const y0 = await page.evaluate(() => window.scrollY); await page.evaluate(() => { window.__marker = document.querySelector('[data-cat="hoka-speedgoat-7"] .cat-facts'); });
  await page.click('[data-cat="hoka-speedgoat-7"] [data-act="catSide"][data-v="hoka-speedgoat-7|minus"]');
  assert.match(await page.textContent('[data-cat="hoka-speedgoat-7"] .cat-list.minus'), /aspal/);
  assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - y0) < 3, "scroll kept");
  assert.equal(await page.evaluate(() => window.__marker.isConnected), true, "card was not re-rendered");
  assert.equal(await page.$('[data-cat="auto-xltimgsrcxonerroralert1gt"]'), null);
  assert.ok(!(await page.content()).includes("onerror=alert"), "invalid entry dropped");
  assert.deepEqual(page.errors, []);
});
