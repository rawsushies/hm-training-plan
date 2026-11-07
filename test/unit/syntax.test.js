// Every shipped script must parse (catches broken edits before any browser test runs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
test("all app scripts parse", () => {
  for (const f of readdirSync("public/js").filter(f => f.endsWith(".js") && f !== "cloud-firebase.js")) {
    assert.doesNotThrow(() => new Function(readFileSync(`public/js/${f}`, "utf8")), f);
  }
  const html = readFileSync("public/index.html", "utf8");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(inline.length >= 2);
  inline.forEach((src, i) => assert.doesNotThrow(() => new Function(src), `inline script ${i}`));
});
