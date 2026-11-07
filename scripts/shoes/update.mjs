// Weekly shoe catalogue update (runs in GitHub Actions; see .github/workflows/shoes.yml).
// usage: node scripts/shoes/update.mjs <previous shoes.json or ""> <output shoes.json>
// Reads public /products.json feeds of running retailers (no login, no private API), honours robots.txt,
// identifies itself, waits between requests, and publishes only validated data.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildModels, collapseEditions, derivePlusMinus, merge, validate } from "./lib.mjs";

const SOURCES = [
  { label: "Pace Athletic", base: "https://www.paceathletic.com", currency: "AUD" },
  { label: "Up There Athletics", base: "https://upthereathletics.com", currency: "AUD" },
  { label: "Vancouver Running Co.", base: "https://vanrunco.com", currency: "CAD" }
];
const UA = "WeRunItCatalogBot/1.0 (+https://we-run-it.web.app; weekly, public product feed only)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

async function allowed(base) {
  try {
    const r = await fetch(base + "/robots.txt", { headers: { "user-agent": UA } });
    if (!r.ok) return true;
    let applies = false;
    for (const line of (await r.text()).split(/\r?\n/)) {
      const [k, ...rest] = line.split(":"); const v = rest.join(":").trim();
      if (/^user-agent$/i.test(k.trim())) applies = v === "*" || /werunit/i.test(v);
      else if (applies && /^disallow$/i.test(k.trim()) && v && ("/products.json".startsWith(v) || v === "/")) return false;
    }
    return true;
  } catch { return true; }
}
async function feed(src) {
  if (!(await allowed(src.base))) { console.log(`skip ${src.label}: robots.txt disallows /products.json`); return null; }
  const products = [];
  for (let page = 1; page <= 6; page++) {
    const r = await fetch(`${src.base}/products.json?limit=250&page=${page}`, { headers: { "user-agent": UA, accept: "application/json" } });
    if (!r.ok) { console.log(`${src.label} page ${page}: HTTP ${r.status}`); break; }
    const j = await r.json(); const n = (j.products || []).length;
    products.push(...(j.products || [])); console.log(`${src.label} page ${page}: ${n} products`);
    if (n < 250) break;
    await sleep(2000);
  }
  return products.length ? Object.assign({}, src, { products }) : null;
}

const [prevPath, outPath] = process.argv.slice(2);
const SCHEMA = 4;                                   // bump when normalization changes: older data is rebuilt, not merged
let prev = prevPath && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
if (prev && prev.schema !== SCHEMA) { console.log(`previous catalogue schema ${prev.schema} → rebuilding`); prev = null; }
const feeds = [];
for (const s of SOURCES) { try { const f = await feed(s); if (f) feeds.push(f); } catch (e) { console.log(`skip ${s.label}: ${e.message}`); } await sleep(1500); }
if (!feeds.length) { console.log("no feed reachable; keeping previous catalogue"); process.exit(prev ? 0 : 1); }
const fresh = derivePlusMinus(collapseEditions(buildModels(feeds, today)));
// Exchange rates to IDR for an approximate rupiah price (ECB reference rates via frankfurter.app; free, no key).
let fx = null;
try {
  const cur = [...new Set(feeds.map(f => f.currency).filter(Boolean))];
  const rates = {};
  for (const c of cur) { const r = await fetch(`https://api.frankfurter.app/latest?from=${c}&to=IDR`, { headers: { "user-agent": UA } }); if (r.ok) { const j = await r.json(); if (j.rates && j.rates.IDR) { rates[c] = j.rates.IDR; fx = { date: j.date, source: "ECB via frankfurter.app", rates }; } } }
} catch (e) { console.log("fx unavailable: " + e.message); }
const cat = { schema: SCHEMA, fx, generated: new Date().toISOString(), retrieved: today, sources: feeds.map(f => ({ label: f.label, url: f.base })), models: merge(prev, fresh, { today }) };
derivePlusMinus(cat.models);                       // re-derive on the merged set so medians cover everything
validate(cat, today);
writeFileSync(outPath, JSON.stringify(cat, null, 1));
console.log(`catalogue: ${cat.models.length} models (${fresh.length} seen this run) from ${feeds.map(f => f.label).join(", ")}`);
