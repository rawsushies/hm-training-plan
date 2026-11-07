// WeRunIt shoe catalogue pipeline: pure functions (unit-tested). No network here.
// Input: public Shopify-style product feeds (`/products.json`) of running retailers.
// Output: normalized models with brand, model name, first-listed date, image (with credit), parsed specs,
// and rule-based plus/minus that only state what the parsed specs support. No AI, nothing invented.

export const BRANDS = ["ASICS", "Nike", "adidas", "HOKA", "Brooks", "Saucony", "New Balance", "On", "PUMA", "Mizuno", "Altra", "Salomon", "Under Armour", "Diadora", "Karhu", "Topo Athletic", "361°", "Li-Ning", "Xtep", "Anta"];
const BRAND_KEY = Object.fromEntries(BRANDS.map(b => [b.toLowerCase().replace(/[^a-z0-9]/g, ""), b]));
export function brandOf(vendor) {
  const k = String(vendor || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^hokaoneone$/, "hoka").replace(/^onrunning$/, "on").replace(/^puma$/, "puma");
  return BRAND_KEY[k] || null;
}

const NOT_SHOE = /\b(top|long-sleeve|sleeve|tank|jersey|anorak|windbreaker|pullover|parka|skirt|dress|brief|underwear|shirt|tee|singlet|short|shorts|tight|tights|sock|socks|jacket|vest|bra|hat|cap|visor|beanie|glove|bottle|flask|gel|chew|belt|pack|bag|insole|lace|laces|sandal|slide|hoodie|pant|pants|legging|crew|half.?zip|watch|headband|sunglass|gift card)\b/i;
const IS_SHOE = /\b(shoe|shoes|footwear|running|runner|trainer|racer|spike)\b/i;
export function isRunningShoe(p) {
  const text = [p.title, p.product_type, ...(Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(","))].join(" ");
  if (NOT_SHOE.test(p.title || "") || NOT_SHOE.test(p.product_type || "")) return false;
  if (/\b(spike|track spike|xc spike)\b/i.test(text)) return false;          // track spikes are out of scope
  return IS_SHOE.test(text) || /footwear|shoe/i.test(p.product_type || "");
}

/** "Men's Novablast 6 - Black/White (2E Wide)" by ASICS → "Novablast 6" */
export function modelName(title, brand) {
  let t = String(title || "");
  t = t.replace(/\s[-–|]\s.*$/, "");                                            // colourway after a dash
  t = t.replace(/\([^)]*\)/g, " ");
  t = t.replace(/\s+x\s+.+$/i, "");                                            // collaborations ("x Satisfy")
  t = t.replace(/\b(men'?s|women'?s|womens|mens|unisex|kids'?|junior|youth|w|m)\b\.?/gi, " ").replace(/\s{2,}/g, " ").trim();
  if (brand) t = t.replace(new RegExp("^\\s*" + brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+", "i"), "");
  t = t.replace(/^(nike|air zoom|zoom)\s+(?=\S)/i, m => /air zoom|zoom/i.test(m) && brand === "Nike" ? "" : m);   // "Air Zoom Pegasus 42" = "Pegasus 42"
  t = t.replace(/\b(tenka|rsg|laced|prm|premium|limited edition|limited|special edition|se|pas normal studios|pns)\b/gi, " ");   // editions/colour packs
  t = t.replace(/\b(2e|4e|d|b|extra wide|wide|narrow|running shoes?|road running shoes?|shoes?|sneakers?)\b/gi, " ");
  t = t.replace(/\s{2,}/g, " ").trim();
  while (/\s(road|racing|race|running|performance|trail|sneaker)$/i.test(t)) t = t.replace(/\s(road|racing|race|running|performance|trail|sneaker)$/i, "").trim();   // trailing descriptors only ("Pegasus Trail 5" keeps Trail)
  return t.slice(0, 60);
}
export const modelKey = (brand, model) => (brand + " " + model).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const strip = html => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** Specs stated in the retailer text/tags. Missing → null (never estimated). */
export function parseSpecs(p) {
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags || "");
  const t = strip(p.body_html) + " " + tags + " " + (p.title || "");
  const num = re => { const m = t.match(re); return m ? parseFloat(m[1].replace(",", ".")) : null; };
  let weightG = num(/(?:weight|berat)[^0-9]{0,25}(\d{2,3}(?:[.,]\d)?)\s*(?:g|grams?)\b/i);
  const oz = num(/(?:weight)[^0-9]{0,25}(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:oz|ounces?)\b/i);
  if (!weightG && oz) weightG = Math.round(oz * 28.35);
  if (weightG && (weightG < 120 || weightG > 450)) weightG = null;
  let dropMm = num(/(?:drop|offset|heel[- ]to[- ]toe)[^0-9]{0,20}(\d{1,2}(?:[.,]\d)?)\s*mm/i);
  if (dropMm !== null && dropMm > 16) dropMm = null;
  let stackMm = num(/(?:heel stack|stack height|stack)[^0-9]{0,20}(\d{2}(?:[.,]\d)?)\s*mm/i);
  if (stackMm !== null && (stackMm < 15 || stackMm > 60)) stackMm = null;
  const plate = /\bcarbon(?:[- ]fib(?:er|re))?\s*(?:plate|plated)|\bcarbitex|\bflyplate|\benergy ?rods?\b|\bcarbon plated\b/i.test(t) ? "carbon"
    : /\b(?:nylon|pebax|tpu|composite)\s*plate\b|\bplated\b/i.test(t) ? "plate" : null;
  const tagList = (Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",")).map(x => String(x).trim().toLowerCase());
  const stability = tagList.includes("stability") || /\b(stability (?:running )?shoe|support shoe|guiderails?|medial post|for overpronat)/i.test(t);
  const waterproof = /\b(gtx|gore-?tex|waterproof)\b/i.test(t);
  const trail = /\btrail\b|\blugs?\b|vibram|megagrip|contagrip/i.test(t);
  const prices = (p.variants || []).map(v => parseFloat(v.price)).filter(v => v > 0);
  return { weightG, dropMm, stackMm, plate, stability, waterproof, trail, price: prices.length ? Math.min(...prices) : null };
}

export function useOf(p, specs) {
  const t = [p.title, p.product_type, ...(Array.isArray(p.tags) ? p.tags : [])].join(" ");
  if (specs.trail || /\btrail\b/i.test(t)) return "trail";
  if (specs.plate === "carbon" || /\b(racing|racer|race day|marathon racing|super ?shoe|alphafly|vaporfly|adios pro|metaspeed|endorphin pro|endorphin elite|rocket ?x|deviate nitro elite|fast-r|hyperwarp|sc elite|cielo x|feidian)\b/i.test(t)) return "race";
  if (/\b(tempo|uptempo|speed|fast|performance training)\b/i.test(t) || specs.plate === "plate") return "tempo";
  if (/\b(max(?:imum)? cushion|maximal|long run|plush)\b/i.test(t) || (specs.stackMm && specs.stackMm >= 38)) return "long";
  return "daily";
}

/** Group products from one or more feeds into models (earliest listing wins as "first listed"). */
export function buildModels(feeds, today) {
  const out = new Map();
  for (const f of feeds) for (const p of f.products || []) {
    const brand = brandOf(p.vendor); if (!brand || !isRunningShoe(p)) continue;
    const model = modelName(p.title, brand); if (!model || model.length < 2) continue;
    const key = modelKey(brand, model), specs = parseSpecs(p);
    const listed = String(p.published_at || p.created_at || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(listed) || listed > today) continue;
    const img = (p.images || []).find(i => /^https:\/\//.test(i.src || ""));
    const url = `${f.base}/products/${encodeURIComponent(p.handle || "")}`;
    const cur = out.get(key);
    const entry = cur || { id: key, brand, model, released: listed, approx: true, use: useOf(p, specs), specs: {}, image: null, source: { label: f.label, url }, sources: [] };
    if (listed < entry.released) { entry.released = listed; entry.source = { label: f.label, url }; }
    for (const [k, v] of Object.entries(specs)) if (v !== null && v !== false && (entry.specs[k] === undefined || entry.specs[k] === null)) entry.specs[k] = v;
    if (specs.price !== null) entry.specs.priceCurrency = f.currency || null;
    if (!entry.image && img) entry.image = { url: img.src.split("?")[0] + "?width=480", credit: f.label, page: url };
    if (!entry.sources.some(s => s.label === f.label)) entry.sources.push({ label: f.label, url });
    out.set(key, entry);
  }
  return [...out.values()];
}

const median = a => { const s = a.filter(v => typeof v === "number").sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
/** Rule-based plus/minus. Every sentence cites a parsed number or flag; nothing without data. */
export function derivePlusMinus(models) {
  const by = {};
  for (const m of models) (by[m.use] = by[m.use] || []).push(m);
  const med = {};
  for (const [u, list] of Object.entries(by)) med[u] = { w: median(list.map(m => m.specs.weightG)), p: median(list.map(m => m.specs.price)), s: median(list.map(m => m.specs.stackMm)), n: list.length };
  for (const m of models) {
    const s = m.specs, M = med[m.use] || {}, plus = [], minus = [], enough = M.n >= 4;
    if (s.weightG && M.w && enough) { if (s.weightG <= M.w * 0.92) plus.push(`Ringan untuk kategorinya (${s.weightG} g vs median ${M.w} g)`); else if (s.weightG >= M.w * 1.08) minus.push(`Lebih berat dari kebanyakan di kategorinya (${s.weightG} g vs median ${M.w} g)`); }
    if (s.stackMm) { if (s.stackMm >= 38) plus.push(`Bantalan tebal (stack ${s.stackMm} mm)`); else if (s.stackMm <= 28) minus.push(`Bantalan tipis (stack ${s.stackMm} mm), kurang empuk untuk long run`); }
    if (s.dropMm !== null && s.dropMm !== undefined) { if (s.dropMm <= 4) minus.push(`Drop rendah (${s.dropMm} mm): butuh adaptasi betis kalau biasa sepatu drop tinggi`); else if (s.dropMm >= 10) plus.push(`Drop ${s.dropMm} mm, ramah untuk pelari yang mendarat di tumit`); }
    if (s.plate === "carbon") { plus.push("Pakai carbon plate untuk race dan sesi cepat"); minus.push("Carbon plate: lebih cepat aus/kurang ekonomis kalau dipakai harian"); }
    else if (s.plate === "plate") plus.push("Ada plate untuk dorongan di pace cepat");
    if (s.stability) plus.push("Disebut sebagai sepatu stability/support");
    if (s.waterproof) { plus.push("Tahan air (Gore-Tex/waterproof)"); minus.push("Versi tahan air biasanya lebih panas di cuaca tropis"); }
    if (s.price && M.p && enough) { if (s.price >= M.p * 1.15) minus.push(`Harga di atas median kategorinya (${s.price} vs ${M.p} ${s.priceCurrency || ""})`.trim()); else if (s.price <= M.p * 0.85) plus.push(`Harga di bawah median kategorinya (${s.price} vs ${M.p} ${s.priceCurrency || ""})`.trim()); }
    m.plus = plus.slice(0, 3); m.minus = minus.slice(0, 3); m.auto = true;
  }
  return models;
}

const HTTPS = /^https:\/\/[^\s"<>]+$/;
/** Merge freshly built models into the previous catalogue: first-seen dates and ids are stable. */
export function merge(prev, fresh, { keep = 120, sinceYears = 3, today }) {
  const old = new Map((prev && prev.models || []).map(m => [m.id, m]));
  for (const m of fresh) { const o = old.get(m.id); if (o && o.released < m.released) { m.released = o.released; m.source = o.source; } old.set(m.id, m); }
  const cutoff = String(Number(today.slice(0, 4)) - sinceYears) + today.slice(4);
  return [...old.values()].filter(m => m.released >= cutoff).sort((a, b) => b.released.localeCompare(a.released)).slice(0, keep);
}
/** Strict validation before publishing; throws with the first problem. */
export function validate(cat, today) {
  if (!cat || !Array.isArray(cat.models) || !cat.models.length) throw new Error("empty catalogue");
  const seen = new Set();
  for (const m of cat.models) {
    if (seen.has(m.id)) throw new Error("duplicate " + m.id); seen.add(m.id);
    if (!BRANDS.includes(m.brand) || !m.model) throw new Error("bad brand/model " + m.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.released) || m.released > today) throw new Error("bad date " + m.id);
    if (!["daily", "tempo", "long", "race", "trail"].includes(m.use)) throw new Error("bad use " + m.id);
    if (!HTTPS.test(m.source.url)) throw new Error("bad source " + m.id);
    if (m.image && (!HTTPS.test(m.image.url) || !m.image.credit)) throw new Error("bad image " + m.id);
    if (!Array.isArray(m.plus) || !Array.isArray(m.minus)) throw new Error("bad notes " + m.id);
  }
  return true;
}
