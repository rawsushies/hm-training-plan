// Copies the Firebase CDN-format ES modules from node_modules into public/vendor
// and rewrites their absolute gstatic imports to relative ones, so the app loads
// Firebase from its own origin (works offline via the service worker, pinned version).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const pkg = JSON.parse(readFileSync("node_modules/firebase/package.json", "utf8"));
const v = pkg.version, out = `public/vendor/firebase/${v}`;
mkdirSync(out, { recursive: true });
for (const f of ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"]) {
  let src = readFileSync(`node_modules/firebase/${f}`, "utf8");
  src = src.split(`https://www.gstatic.com/firebasejs/${v}/`).join("./");
  src = src.replace(/\n\/\/# sourceMappingURL=.*$/m, "");
  writeFileSync(`${out}/${f}`, src);
  console.log(`${out}/${f}`, src.length);
}

// Capacitor's runtime (window.Capacitor.registerPlugin etc.) for the Android app; harmless on the web.
const capV = JSON.parse(readFileSync("node_modules/@capacitor/core/package.json", "utf8")).version;
mkdirSync(`public/vendor/capacitor/${capV}`, { recursive: true });
writeFileSync(`public/vendor/capacitor/${capV}/capacitor.js`, readFileSync("node_modules/@capacitor/core/dist/capacitor.js", "utf8").replace(/\n\/\/# sourceMappingURL=.*$/m, ""));
console.log(`public/vendor/capacitor/${capV}/capacitor.js`);
