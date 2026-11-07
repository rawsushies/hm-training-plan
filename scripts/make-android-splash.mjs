// Replaces Capacitor's default splash images with a dark Kiki splash (same sizes).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const list = JSON.parse(readFileSync(process.argv[2], "utf8"));
const face = `<circle cx="40" cy="42" r="26" fill="#c8f03c"/><path d="M15 34 Q40 25 65 34 L65 41 Q40 32 15 41Z" fill="#7b9cc2"/><ellipse cx="31" cy="47" rx="3.2" ry="4" fill="#1d2124"/><ellipse cx="49" cy="47" rx="3.2" ry="4" fill="#1d2124"/><path d="M35 56 Q40 61 45 56" stroke="#1d2124" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const b = await chromium.launch(), p = await b.newPage();
for (const [f, w, h] of list) {
  const s = Math.min(w, h) * 0.32;
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<html><body style="margin:0;background:#131517;display:flex;align-items:center;justify-content:center;height:${h}px"><svg width="${s}" height="${s}" viewBox="0 0 80 80">${face}</svg></body></html>`);
  await p.screenshot({ path: f });
}
await b.close();
