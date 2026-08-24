import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("V10 manifest is a fresh PatroAI immersive identity", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.id, "/?app=patroai-immersive-v10");
  assert.equal(manifest.name, "PatroAI");
  assert.equal(manifest.short_name, "PatroAI");
  assert.match(manifest.start_url, /experience=immersive&v=10/);
});

test("manifest and apple icon references are cache-busted", () => {
  const html = read("index.html");
  assert.match(html, /manifest\.webmanifest\?v=10/);
  assert.match(html, /apple-touch-icon-180\.png\?v=10/);
});

test("mobile logo dragging tracks pointer at window scope", () => {
  const source = read("src/landing/premiumInteractions.ts");
  assert.match(source, /window\.addEventListener\("pointermove", onPointerMove/);
  assert.match(source, /window\.addEventListener\("pointerup", onPointerUp/);
  assert.match(source, /window\.removeEventListener\("pointermove", onPointerMove/);
});

test("mobile starts performance-first and never auto-upgrades to full", () => {
  const source = read("src/landing/premiumInteractions.ts");
  assert.match(source, /return "performance" as const/);
  assert.match(source, /mobile never auto-upgrades to the expensive FULL profile/i);
  const css = read("src/landing/premium.css");
  assert.match(css, /EFATA777 V10 MOBILE FLUID DRAG/);
  assert.match(css, /touch-action: none !important/);
});

test("legacy ORKIO icons are not referenced by the manifest", () => {
  const manifest = read("public/manifest.webmanifest");
  assert.doesNotMatch(manifest, /orkio-/i);
  assert.match(manifest, /patroai-192\.png/);
});
