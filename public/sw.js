/* EFATA777 / PatroAI PWA — explicit public allowlist only */
const VERSION = "efata777-v10-20260824-mobile-fluid-drag";
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;
const CACHE_PREFIXES = ["efata777-", "orkio-v2-"];

const PUBLIC_SHELL = Object.freeze([
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/patroai-48.png",
  "/icons/patroai-192.png",
  "/icons/patroai-maskable-192.png",
  "/icons/patroai-512.png",
  "/icons/patroai-maskable-512.png",
  "/icons/apple-touch-icon-180.png",
]);

const EXACT_PUBLIC_PATHS = new Set([
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
]);

const PUBLIC_PREFIXES = Object.freeze([
  "/assets/",
  "/icons/",
]);

const PROTECTED_PREFIXES = Object.freeze([
  "/api",
  "/auth",
  "/oidc",
  "/realtime",
  "/stream",
  "/events",
  "/sockjs",
  "/admin",
  "/health",
  "/metrics",
]);

const PROTECTED_EXACT = new Set([
  "/env.js",
]);

function responseIsPrivate(response) {
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  const vary = (response.headers.get("vary") || "").toLowerCase();

  return (
    cacheControl.includes("no-store") ||
    cacheControl.includes("private") ||
    vary.split(",").some((value) => {
      const normalized = value.trim();
      return normalized === "authorization" || normalized === "cookie";
    })
  );
}

function isProtectedPath(pathname) {
  if (PROTECTED_EXACT.has(pathname)) return true;
  return PROTECTED_PREFIXES.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicAllowlistedPath(pathname) {
  if (EXACT_PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldHandleRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (request.headers.has("authorization")) return false;
  if (isProtectedPath(url.pathname)) return false;
  return isPublicAllowlistedPath(url.pathname);
}

async function cacheIfPublic(cache, request, response) {
  if (
    response.ok &&
    response.type === "basic" &&
    !responseIsPrivate(response)
  ) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await cache.addAll(PUBLIC_SHELL);
      // V9 is a mobile recovery release: activate immediately so installed
      // standalone PWAs cannot remain controlled by a stale landing shell.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
              key !== PRECACHE &&
              key !== RUNTIME,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirstNavigation(request) {
  const requestUrl = new URL(request.url);
  if (
    requestUrl.pathname === "/app" &&
    (requestUrl.searchParams.get("source") || "").startsWith("pwa")
  ) {
    return Response.redirect(`${self.location.origin}/?source=pwa&experience=immersive&v=10`, 302);
  }

  const runtime = await caches.open(RUNTIME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      await cacheIfPublic(runtime, request, response);
    }
    return response;
  } catch {
    return (
      (await runtime.match(request)) ||
      (await runtime.match("/")) ||
      (await caches.match("/offline.html")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const runtime = await caches.open(RUNTIME);
  const cached = await runtime.match(request);
  const network = fetch(request)
    .then((response) => cacheIfPublic(runtime, request, response))
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!shouldHandleRequest(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
