import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const boundary = fs.readFileSync("src/components/RuntimeErrorBoundary.tsx", "utf8");
const landing = fs.readFileSync("src/routes/Landing.tsx", "utf8");
const interactions = fs.readFileSync("src/landing/premiumInteractions.ts", "utf8");
const css = fs.readFileSync("src/landing/premium.css", "utf8");

test("landing ignores benign ResizeObserver browser diagnostics", () => {
  assert.match(boundary, /resizeobserver loop limit exceeded/i);
  assert.match(boundary, /resizeobserver loop completed with undelivered notifications/i);
  assert.match(boundary, /non-fatal landing browser diagnostic/);
});

test("runtime fallback is route aware instead of always claiming console failure", () => {
  assert.match(boundary, /isPublicLanding/);
  assert.match(boundary, /Recarregar experiência/);
  assert.match(boundary, /PatroAI · Experiência/);
});

test("landing premium mount fails soft with a compatible recovery surface", () => {
  assert.match(landing, /try\s*{/);
  assert.match(landing, /setMountFailed\(true\)/);
  assert.match(landing, /landing-safe-recovery/);
  assert.match(css, /EFATA777 V9 RESILIENT MOBILE BOOT/);
});

test("optional immersive enhancements are isolated from core landing boot", () => {
  assert.match(interactions, /runOptionalLandingFeature/);
  assert.match(interactions, /optional landing feature disabled/);
  assert.match(interactions, /hero neural canvas/);
  assert.match(interactions, /lobby neural canvas/);
});

test("MediaQueryList change listener has a legacy mobile fallback", () => {
  assert.match(interactions, /addMediaQueryChangeListener/);
  assert.match(interactions, /addListener\?\./);
  assert.match(interactions, /removeListener\?\./);
});


test("V9 service worker activates immediately to replace stale mobile shells", () => {
  const sw = fs.readFileSync("public/sw.js", "utf8");
  assert.match(sw, /efata777-v10-20260824-mobile-fluid-drag/);
  assert.match(sw, /await self\.skipWaiting\(\)/);
  assert.match(sw, /await self\.clients\.claim\(\)/);
});
