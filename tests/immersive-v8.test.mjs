import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const markup = fs.readFileSync("src/landing/premiumMarkup.ts", "utf8");
const css = fs.readFileSync("src/landing/premium.css", "utf8");
const interactions = fs.readFileSync("src/landing/premiumInteractions.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const sw = fs.readFileSync("public/sw.js", "utf8");
const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));

test("V8 plasma is layered instead of relying on a single visible line", () => {
  for (const layer of ["haze", "body", "filament", "pulse"]) {
    assert.match(markup, new RegExp(`neural-lobby__stream--${layer}`));
  }
  assert.match(css, /IMMERSIVE V8 — ADAPTIVE PLASMA/);
});

test("V8 performance governor preserves reactivity while adapting visual cost", () => {
  assert.match(interactions, /runPerformanceGovernor/);
  assert.match(interactions, /data-immersive-quality|immersiveQuality/);
  assert.match(css, /data-immersive-quality="balanced"/);
  assert.match(css, /data-immersive-quality="performance"/);
});

test("V8 mobile gate has deterministic first-surface priority", () => {
  assert.match(css, /immersive-gate:not\(\[hidden\]\)[\s\S]*z-index: 2147483000/);
  assert.match(interactions, /immersiveGate\.hidden = false/);
});

test("V8 PWA launches at the public immersive root and migrates legacy PWA launches", () => {
  assert.equal(manifest.start_url, "/?source=pwa&experience=immersive&v=10");
  assert.match(app, /source\.startsWith\("pwa"\)/);
  assert.match(sw, /requestUrl\.pathname === "\/app"/);
  assert.match(sw, /Response\.redirect\(`\$\{self\.location\.origin\}\/\?source=pwa&experience=immersive&v=10`/);
});

test("V8 music path uses fast kick attack instead of only slow average energy", () => {
  assert.match(interactions, /audioBeatFast[\s\S]*\* 0\.72/);
  assert.match(interactions, /beatCandidate[\s\S]*\* 12\.5/);
  assert.match(interactions, /beatCandidate > audioBeatLevel[\s\S]*\* 0\.93/);
});
