import { test } from "node:test";
import assert from "node:assert/strict";
import { brandOf, isRunningShoe, modelName, parseSpecs, useOf, buildModels, derivePlusMinus, merge, validate } from "../../scripts/shoes/lib.mjs";

const P = (id, vendor, title, o = {}) => Object.assign({ id, vendor, title, handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), product_type: "Footwear", tags: ["Running"], published_at: "2026-07-01T10:00:00+10:00", body_html: "", variants: [{ price: "220.00" }], images: [{ src: "https://cdn.shopify.com/s/files/1/x/" + id + ".jpg?v=1" }] }, o);
const feedA = { label: "Shop A", base: "https://a.example", currency: "AUD", products: [
  P(1, "ASICS", "Men's Novablast 6 - Black/White", { body_html: "<p>Weight: 255g. Drop: 8mm. Stack height 41.5mm.</p>" }),
  P(2, "ASICS", "Women's Novablast 6 (D Wide) - Pink", { published_at: "2026-06-28T09:00:00Z" }),
  P(3, "Nike", "Alphafly 3 Men's Road Racing Shoes", { body_html: "Carbon fiber Flyplate. 7.7 oz", variants: [{ price: "450" }], published_at: "2024-01-05T00:00:00Z" }),
  P(4, "HOKA ONE ONE", "Speedgoat 7 GTX", { body_html: "Vibram Megagrip lugs, GORE-TEX waterproof", tags: ["Trail"] }),
  P(5, "ASICS", "Men's Running Singlet", { product_type: "Apparel" }),
  P(6, "Unknown Brand", "Fast Shoe"),
  P(7, "Saucony", "Endorphin Speed 5 - Lapis", { body_html: "nylon plate for uptempo running", tags: ["Tempo"] }),
  P(8, "Brooks", "Ghost 18", { published_at: "2099-01-01T00:00:00Z" })
] };

test("feed parsing: brands, shoe filter, model names without gender/width/colour", () => {
  assert.equal(brandOf("HOKA ONE ONE"), "HOKA"); assert.equal(brandOf("adidas"), "adidas"); assert.equal(brandOf("Acme"), null);
  assert.equal(isRunningShoe(feedA.products[4]), false, "apparel out");
  assert.equal(modelName("Men's Novablast 6 - Black/White", "ASICS"), "Novablast 6");
  assert.equal(modelName("Women's Novablast 6 (D Wide) - Pink", "ASICS"), "Novablast 6");
  assert.equal(modelName("Alphafly 3 Men's Road Racing Shoes", "Nike"), "Alphafly 3");
  assert.equal(modelName("Pegasus Trail 5", "Nike"), "Pegasus Trail 5");
  assert.equal(modelName("Men's ASICS Novablast 6 Tenka", "ASICS"), "Novablast 6");
  assert.equal(modelName("Air Zoom Pegasus 42 RSG", "Nike"), "Pegasus 42");
  assert.equal(modelName("Adizero Adios Pro Evo 2 x Satisfy", "adidas"), "Adizero Adios Pro Evo 2");
  assert.equal(modelName("Speedgoat 7 GTX", "HOKA"), "Speedgoat 7 GTX");
  assert.equal(isRunningShoe({ title: "Nike ACG Radical AirFlow Long-Sleeve Running Top", product_type: "Footwear", tags: [] }), false);
});

test("specs only from stated text; missing stays null", () => {
  assert.deepEqual(parseSpecs(feedA.products[0]), { weightG: 255, dropMm: 8, stackMm: 41.5, plate: null, stability: false, waterproof: false, trail: false, price: 220 });
  const af = parseSpecs(feedA.products[2]); assert.equal(af.plate, "carbon"); assert.equal(af.weightG, null, "oz without the word weight is not guessed");
  const sg = parseSpecs(feedA.products[3]); assert.equal(sg.waterproof, true); assert.equal(sg.trail, true);
  assert.equal(useOf(feedA.products[3], sg), "trail"); assert.equal(useOf(feedA.products[2], af), "race"); assert.equal(useOf(feedA.products[6], parseSpecs(feedA.products[6])), "tempo");
});

test("models: grouped, earliest listing = first listed (approx), image + credit, future/unknown dropped; rule-based notes cite data", () => {
  const m = derivePlusMinus(buildModels([feedA], "2026-11-07"));
  const ids = m.map(x => x.id).sort();
  assert.deepEqual(ids, ["asics-novablast-6", "hoka-speedgoat-7-gtx", "nike-alphafly-3", "saucony-endorphin-speed-5"]);
  const nb = m.find(x => x.id === "asics-novablast-6");
  assert.equal(nb.released, "2026-06-28"); assert.equal(nb.approx, true);
  assert.match(nb.image.url, /^https:\/\/cdn\.shopify\.com\/.+\?width=480$/); assert.equal(nb.image.credit, "Shop A");
  assert.ok(nb.plus.some(t => /stack 41.5 mm/.test(t)));
  const af = m.find(x => x.id === "nike-alphafly-3");
  assert.ok(af.plus.some(t => /carbon plate/i.test(t)) && af.minus.some(t => /aus/.test(t)));
  for (const x of m) for (const t of [...x.plus, ...x.minus]) assert.ok(/\d|carbon|plate|stability|Gore|tahan air|panas/i.test(t), "each note is backed by a parsed value: " + t);
});

test("merge keeps first-seen dates and validate rejects bad data", () => {
  const prev = { models: [{ id: "asics-novablast-6", released: "2026-06-20", source: { label: "Old", url: "https://o.example/p" } }] };
  const fresh = derivePlusMinus(buildModels([feedA], "2026-11-07"));
  const all = merge(prev, fresh, { today: "2026-11-07" });
  assert.equal(all.find(x => x.id === "asics-novablast-6").released, "2026-06-20");
  const cat = { models: all.map(x => Object.assign({}, x)) };
  assert.equal(validate(cat, "2026-11-07"), true);
  cat.models[0] = Object.assign({}, cat.models[0], { image: { url: "javascript:alert(1)", credit: "x" } });
  assert.throws(() => validate(cat, "2026-11-07"), /bad image/);
});
