// Visual QA for RUNLAB: drives the real app in Chromium and captures screenshots.
// usage: node scripts/visual-qa.mjs <outDir> [--only=name]
// Seeds clearly synthetic local test runs (never shipped, never synced) so populated states can be inspected.
import { chromium } from "playwright";
import { createServer } from "http-server";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "qa-shots"; mkdirSync(out, { recursive: true });
const only = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7);
const server = createServer({ root: "public", cache: -1, silent: true });
await new Promise(r => server.listen(5191, "127.0.0.1", r));
const URL = "http://127.0.0.1:5191/";

function seedRuns() {
  const logs = [], d0 = new Date(2026, 7, 25);
  for (let i = 0; i < 34; i++) {
    const d = new Date(d0); d.setDate(d.getDate() + i * 2 + (i % 3));
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const long = i % 5 === 4, km = long ? 12 + (i % 4) : 5 + (i % 3), pace = (long ? 430 : 410) - i * 1.4 + (i % 4) * 6;
    const morning = i % 4 === 1;
    logs.push({ id: "qa" + i, date, type: long ? "long" : "easy", sessionId: null, distance: km, duration: i % 9 === 3 ? null : Math.round(km * pace),
      elev: i % 3 ? 20 + i : null, hrAvg: i % 4 ? 140 + (i % 10) : null, hrMax: null, rpe: 3 + (i % 4), weather: i % 6 ? "" : "panas", notes: "",
      src: i % 2 ? "File" : undefined, extId: i % 2 ? `t:${date}T${morning ? "06" : "19"}:15` : undefined, shoeId: i % 2 ? "sh1" : "sh2" });
  }
  return logs;
}
const shots = [];
async function page(vp, theme, seed) {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: theme });
  await ctx.addInitScript(([seed, theme]) => {
    localStorage.setItem("hmtp:gate:v4", '"local"');
    if (seed && !localStorage.getItem("__qa")) {
      const s = { v: 3, settings: { theme, startDate: "2026-11-09", raceDate: "2027-06-13" }, logs: seed, shoes: [{ id: "sh1", name: "Biru", limit: 700 }, { id: "sh2", name: "Merah", limit: 700 }], profile: { onboarded: true }, tutorial: { v: 3, quick: true, tours: {}, bannerDismissed: true }, ui: { tab: "lab", tourDone: true, tourV: 3 } };
      localStorage.setItem("hmtp:anon:v3", JSON.stringify(s)); localStorage.setItem("__qa", "1");
    }
  }, [seed, theme]);
  const p = await ctx.newPage(); p.errs = [];
  p.on("pageerror", e => p.errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource|net::/.test(m.text()) && p.errs.push(m.text()));
  await p.goto(URL); await p.waitForFunction(() => window.__bootDone && !document.getElementById("boot"), null, { timeout: 15000 });
  await p.evaluate(() => { document.querySelector('[data-act="obDone"]')?.click(); document.querySelector('[data-act="tutClose"]')?.click(); });
  return { b, p };
}
const snap = async (p, name, full = false) => { if (only && !name.includes(only)) return; const f = `${out}/${name}.png`; await p.screenshot({ path: f, fullPage: full }); shots.push(f); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const report = [];
const top = p => p.evaluate(() => window.scrollTo(0, 0));
for (const [label, vp] of [["m390", { width: 390, height: 844 }], ["t768", { width: 768, height: 1024 }], ["d1440", { width: 1440, height: 900 }], ["n320", { width: 320, height: 640 }], ["l844", { width: 844, height: 390 }]]) {
  for (const theme of label === "m390" || label === "d1440" ? ["dark", "light"] : ["dark"]) {
    // empty state
    let { b, p } = await page(vp, theme, null);
    await p.evaluate(() => { const el = document.createElement("button"); el.dataset.act = "nav"; el.dataset.t = "lab"; document.body.appendChild(el); el.click(); el.remove(); });
    await p.waitForTimeout(400); await snap(p, `${label}-${theme}-lab-empty`, true);
    report.push([label, theme, "empty overflow", await overflow(p), p.errs.slice()]); await b.close();
    // populated
    ({ b, p } = await page(vp, theme, seedRuns()));
    await p.evaluate(() => { const el = document.createElement("button"); el.dataset.act = "nav"; el.dataset.t = "lab"; document.body.appendChild(el); el.click(); el.remove(); });
    await p.waitForTimeout(500);
    await p.click('[data-act="chartSel"][data-chart="weekly"][data-i="5"]').catch(() => {});
    await snap(p, `${label}-${theme}-lab-home`, true);
    await p.click('[data-act="labStarter"][data-i="1"]'); await p.click('[data-act="labCreate"]'); await p.waitForTimeout(300);
    await snap(p, `${label}-${theme}-inv-ask`);
    await p.click('[data-act="labAns"][data-v="84"]'); await p.click('[data-act="labAns"][data-v="time"]'); await p.click('[data-act="labAns"][data-v="pace"]');
    await p.waitForTimeout(300); await snap(p, `${label}-${theme}-inv-evidence`, true);
    await p.click('[data-act="labAnalyze"]'); await p.waitForTimeout(500);
    await p.click('#ch-compare [data-act="chartSel"]').catch(() => {});
    await top(p); await snap(p, `${label}-${theme}-inv-findings`, true);
    report.push([label, theme, "populated overflow", await overflow(p), p.errs.slice()]);
    // comparison controls: time view, then hide one group (viewport shot around the lead chart)
    if (theme === "dark" || label === "m390") {
      await p.click('#ch-compare [data-act="labCompView"][data-v="time"]').catch(() => {});
      await p.click('#ch-compare [data-act="labCompHide"][data-g="b"]').catch(() => {});
      await p.evaluate(() => document.getElementById("ch-compare")?.scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
      await snap(p, `${label}-${theme}-compare-time`);
      report.push([label, theme, "compare controls", await overflow(p), p.errs.slice()]);
    }
    await b.close();
  }
}
// pace trend with a selected point (performance investigation)
{
  const { b, p } = await page({ width: 1440, height: 900 }, "dark", seedRuns());
  await p.evaluate(() => { const el = document.createElement("button"); el.dataset.act = "nav"; el.dataset.t = "lab"; document.body.appendChild(el); el.click(); el.remove(); });
  await p.click('[data-act="labStarter"][data-i="0"]'); await p.click('[data-act="labCreate"]');
  await p.click('[data-act="labAns"][data-v="0"]'); await p.click('[data-act="labAns"][data-v="pace"]'); await p.click('[data-act="labAns"][data-v="all"]');
  await p.click('[data-act="labAnalyze"]'); await p.waitForTimeout(400);
  await p.click('#ch-trend [data-act="chartSel"][data-i="3"]').catch(() => {});
  await snap(p, "d1440-dark-trend-selected", true); report.push(["d1440", "dark", "trend", await overflow(p), p.errs.slice()]);
  await p.evaluate(() => { const el = document.createElement("button"); el.dataset.act = "nav"; el.dataset.t = "home"; document.body.appendChild(el); el.click(); el.remove(); });
  await p.waitForTimeout(400); await snap(p, "d1440-dark-home"); await b.close();
}
console.log(JSON.stringify({ report, shots: shots.length }, null, 0));
server.close();
