// Renders Android launcher icons (legacy + adaptive foreground) from the Kiki mascot.
import { chromium } from "playwright";
const face = `<circle cx="40" cy="42" r="26" fill="#c8f03c"/><path d="M15 34 Q40 25 65 34 L65 41 Q40 32 15 41Z" fill="#7b9cc2"/><ellipse cx="31" cy="47" rx="3.2" ry="4" fill="#1d2124"/><ellipse cx="49" cy="47" rx="3.2" ry="4" fill="#1d2124"/><path d="M35 56 Q40 61 45 56" stroke="#1d2124" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
const legacy = n => `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#131517"/>${face}</svg>`;
const round = n => `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="0 0 80 80"><circle cx="40" cy="40" r="40" fill="#131517"/>${face}</svg>`;
// adaptive foreground: 108dp canvas, art inside the central 66dp safe zone
const fg = n => `<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}" viewBox="-29 -27 138 138">${face}</svg>`;
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const b = await chromium.launch(), p = await b.newPage();
const shot = async (svg, n, path) => { await p.setViewportSize({ width: n, height: n }); await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`); await p.screenshot({ path, omitBackground: true }); };
for (const [d, k] of Object.entries(D)) {
  const dir = `android/app/src/main/res/mipmap-${d}`;
  await shot(legacy(48 * k), 48 * k, `${dir}/ic_launcher.png`);
  await shot(round(48 * k), 48 * k, `${dir}/ic_launcher_round.png`);
  await shot(fg(108 * k), 108 * k, `${dir}/ic_launcher_foreground.png`);
}
await b.close();
