import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(
  fs.readFileSync("public/manifest.webmanifest", "utf8"),
);
const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

test("manifest supports Android installability fields", () => {
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.start_url, "/?source=pwa&experience=immersive&v=10");
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  for (const size of ["192x192", "512x512"]) {
    assert.ok(manifest.icons.some((icon) => icon.sizes === size));
  }
});

test("manifest includes dedicated maskable icons", () => {
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "192x192" && icon.purpose === "maskable",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable",
    ),
  );
});

test("iOS metadata and apple touch icon are present", () => {
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-mobile-web-app-status-bar-style/);
  assert.match(html, /apple-touch-icon-180\.png/);
  assert.match(html, /viewport-fit=cover/);
});

test("service worker never caches protected surfaces", () => {
  for (const marker of [
    '"/api"',
    '"/auth"',
    '"/oidc"',
    '"/realtime"',
    '"/stream"',
    '"/env.js"',
  ]) {
    assert.match(serviceWorker, new RegExp(marker.replaceAll("/", "\\/")));
  }
  assert.match(serviceWorker, /request\.headers\.has\("authorization"\)/);
  assert.match(serviceWorker, /request\.method !== "GET"/);
});

test("service worker provides public offline fallback", () => {
  assert.match(serviceWorker, /offline\.html/);
  assert.match(serviceWorker, /networkFirstNavigation/);
  assert.match(serviceWorker, /staleWhileRevalidate/);
});

test("service worker keeps manual update support and V9 mobile recovery activates immediately", () => {
  assert.match(serviceWorker, /SKIP_WAITING/);
  assert.match(serviceWorker, /install[\s\S]{0,500}skipWaiting\(\)/);
});

test("service worker and manifest files exist", () => {
  for (const file of [
    "public/sw.js",
    "public/offline.html",
    "public/manifest.webmanifest",
    "public/icons/patroai-192.png",
    "public/icons/patroai-maskable-192.png",
    "public/icons/patroai-512.png",
    "public/icons/patroai-maskable-512.png",
    "public/icons/apple-touch-icon-180.png",
  ]) {
    assert.ok(fs.existsSync(file), `${file} is missing`);
  }
});
