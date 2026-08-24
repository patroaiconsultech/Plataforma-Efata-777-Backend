import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("PWA V9 has a new root-scoped immersive identity", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.id, "/?app=patroai-immersive-v10");
  assert.equal(manifest.start_url, "/?source=pwa&experience=immersive&v=10");
  assert.equal(manifest.scope, "/");
});

test("legacy PWA launch is normalized before service worker registration", () => {
  const source = read("src/pwa/registerServiceWorker.ts");
  assert.match(source, /if \(isLegacyPwaLaunch\(\)\)/);
  assert.match(source, /window\.location\.replace\("\/\?source=pwa&experience=immersive&v=10"\)/);
});

test("public landing global failures are fail-soft", () => {
  const source = read("src/components/RuntimeErrorBoundary.tsx");
  assert.match(source, /window\.location\.pathname === "\/"/);
  assert.match(source, /non-fatal landing browser diagnostic/);
  assert.match(source, /non-fatal public landing rejection/);
});

test("bootstrap no longer exposes ORKIO branding", () => {
  const source = read("src/main.tsx");
  assert.doesNotMatch(source, /ORKIO/);
  assert.match(source, /PatroAI root container not found/);
});

test("service worker migrates legacy standalone launch to immersive root", () => {
  const source = read("public/sw.js");
  assert.match(source, /experience=immersive/);
  assert.match(source, /skipWaiting/);
  assert.match(source, /clients\.claim/);
});
