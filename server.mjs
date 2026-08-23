import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import {
  collectPublicRuntimeConfig,
  runtimeEnvScript,
} from "./public-config.js";

const port = Number(process.env.PORT || 8080);
const root = path.resolve("dist");
const collectedRuntimeConfig = collectPublicRuntimeConfig(process.env);
const runtimeConfigScript = runtimeEnvScript(collectedRuntimeConfig.config);

if (collectedRuntimeConfig.errors.length) {
  console.error(
    `[ORKIO frontend] invalid public runtime config keys: ${collectedRuntimeConfig.errors
      .map((item) => `${item.key}:${item.reason || "INVALID"}`)
      .join(",")}`,
  );
}

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

function securityHeaders(response) {
  const connectSrc = String(process.env.ORKIO_CSP_CONNECT_SRC || "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      `connect-src 'self' ${connectSrc}`.trim(),
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "manifest-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self'",
    ].join("; "),
  );
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
  );
}

function cacheHeaders(response, pathname) {
  if (pathname === "/sw.js" || pathname === "/env.js") {
    response.setHeader("Cache-Control", "no-store");
    return;
  }
  if (pathname === "/manifest.webmanifest") {
    response.setHeader("Cache-Control", "no-cache");
    return;
  }
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    response.setHeader("Cache-Control", "public, max-age=3600");
    return;
  }
  if (pathname.startsWith("/assets/")) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }
  if (pathname.startsWith("/icons/")) {
    response.setHeader("Cache-Control", "public, max-age=86400");
    return;
  }
  response.setHeader("Cache-Control", "no-cache");
}

function safePathname(rawUrl) {
  try {
    return decodeURIComponent(new URL(rawUrl || "/", "http://localhost").pathname);
  } catch {
    return null;
  }
}

function isStaticAssetRequest(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sw.js" ||
    Boolean(path.extname(pathname))
  );
}

function acceptsHtml(request) {
  const accept = String(request.headers.accept || "");
  return !accept || accept.includes("text/html") || accept.includes("*/*");
}

http
  .createServer((request, response) => {
    securityHeaders(response);

    const pathname = safePathname(request.url);
    if (!pathname || pathname.includes("\0")) {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (pathname === "/env.js") {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      cacheHeaders(response, pathname);
      response.writeHead(200);
      response.end(runtimeConfigScript);
      return;
    }

    let requested = pathname === "/" ? "/index.html" : pathname;
    let file = path.resolve(root, `.${requested}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (isStaticAssetRequest(pathname) || !acceptsHtml(request)) {
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      file = path.join(root, "index.html");
      requested = "/index.html";
    }
    const extension = path.extname(file).toLowerCase();
    response.setHeader(
      "Content-Type",
      MIME_TYPES.get(extension) || "application/octet-stream",
    );
    if (pathname === "/sw.js") {
      response.setHeader("Service-Worker-Allowed", "/");
    }
    cacheHeaders(response, pathname);

    const stream = fs.createReadStream(file);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(500);
      }
      response.end("Internal server error");
    });
    stream.pipe(response);
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`[ORKIO frontend] listening on ${port}`);
  });
