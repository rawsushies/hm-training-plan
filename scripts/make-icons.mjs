import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icon.svg", "utf8");
const b = await chromium.launch(), p = await b.newPage();
for (const n of [192, 512]) {
  await p.setViewportSize({ width: n, height: n });
  await p.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${n}" height="${n}" `)}</body></html>`);
  await p.screenshot({ path: `public/icon-${n}.png`, omitBackground: true });
}
await b.close();
