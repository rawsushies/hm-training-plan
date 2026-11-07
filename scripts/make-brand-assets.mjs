// Generates every WeRunIt icon from public/js/brand.js (single source of the mark):
// favicon/PWA SVG + PNGs (incl. maskable), Android launcher (legacy, round, adaptive foreground),
// Android notification small icon (white silhouette), and splash images.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import vm from "node:vm";
const ctx = {}; vm.runInNewContext(readFileSync("public/js/brand.js", "utf8"), ctx);
const B = ctx.WRI_BRAND, BG = "#13131C";
const svgDoc = (inner, n, bg = "transparent") => `<html><body style="margin:0;background:${bg}">${inner.replace("<svg ", `<svg style="display:block" `).replace(/width="\d+" height="\d+"/, `width="${n}" height="${n}"`)}</body></html>`;
const scaled = (opts, pad) => { // mark inside a padded square (pad = fraction of the canvas left around the mark)
  const m = B.mark(Object.assign({ size: 64 }, opts)).replace('viewBox="0 0 64 64"', `viewBox="${-64 * pad} ${-64 * pad} ${64 * (1 + 2 * pad)} ${64 * (1 + 2 * pad)}"`);
  return m;
};
writeFileSync("public/icon.svg", B.mark({ size: 64, bg: BG, bgRadius: 15 }).replace(/<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace('class="wri-mark" ', ""));
const b = await chromium.launch(), p = await b.newPage();
const shot = async (html, n, path, transparent = true) => { await p.setViewportSize({ width: n, height: n }); await p.setContent(html); await p.screenshot({ path, omitBackground: transparent }); };
const tile = n => svgDoc(`<div style="width:${n}px;height:${n}px;border-radius:${n * 0.22}px;background:${BG};display:flex;align-items:center;justify-content:center">${B.mark({ size: Math.round(n * 0.74) })}</div>`, n);
await shot(tile(192), 192, "public/icon-192.png");
await shot(tile(512), 512, "public/icon-512.png");
await shot(svgDoc(scaled({}, 0.32), 512, BG), 512, "public/icon-maskable-512.png", false);
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }, res = "android/app/src/main/res";
for (const [d, k] of Object.entries(D)) {
  const dir = `${res}/mipmap-${d}`; mkdirSync(dir, { recursive: true });
  await shot(tile(48 * k), 48 * k, `${dir}/ic_launcher.png`);
  await shot(svgDoc(`<div style="width:${48 * k}px;height:${48 * k}px;border-radius:50%;background:${BG};display:flex;align-items:center;justify-content:center">${B.mark({ size: Math.round(48 * k * 0.66) })}</div>`, 48 * k), 48 * k, `${dir}/ic_launcher_round.png`);
  await shot(svgDoc(scaled({}, 0.36), 108 * k), 108 * k, `${dir}/ic_launcher_foreground.png`);
  const nd = `${res}/drawable-${d}`; mkdirSync(nd, { recursive: true });
  await shot(svgDoc(scaled({ mode: "white", weight: 7 }, 0.08), 24 * k), 24 * k, `${nd}/ic_stat_werunit.png`);   // notification small icon
}
for (const dir of readdirSync(res).filter(x => x.startsWith("drawable"))) {
  const f = `${res}/${dir}/splash.png`; if (!existsSync(f)) continue;
  const buf = readFileSync(f), w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), s = Math.round(Math.min(w, h) * 0.3);
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;background:${BG};display:flex;align-items:center;justify-content:center;height:${h}px">${B.mark({ size: s })}</body></html>`);
  await p.screenshot({ path: f });
}
await shot(svgDoc(B.mark({ size: 32 }), 32), 32, "public/favicon-32.png");
await b.close();
console.log("brand assets written");
