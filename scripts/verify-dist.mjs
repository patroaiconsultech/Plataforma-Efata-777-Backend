import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");
const required = [
  "index.html",
  "env.js",
  "manifest.webmanifest",
  "sw.js",
  "offline.html",
  "icons/patroai-192.png",
  "icons/patroai-maskable-192.png",
  "icons/patroai-512.png",
  "icons/patroai-maskable-512.png",
  "icons/apple-touch-icon-180.png",
];

const missing = required.filter((item) => !fs.existsSync(path.join(root, item)));
if (missing.length) {
  console.error(`DIST_VERIFY=FAIL\nmissing=${missing.join(",")}`);
  process.exit(1);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!index.includes("manifest.webmanifest") || !index.includes("apple-touch-icon")) {
  console.error("DIST_VERIFY=FAIL\nPWA metadata missing from dist/index.html");
  process.exit(1);
}

const maps = [];
for (const item of fs.readdirSync(root, { recursive: true })) {
  if (String(item).endsWith(".map")) maps.push(String(item));
}
if (maps.length) {
  console.error(`DIST_VERIFY=FAIL\nsource maps forbidden: ${maps.join(",")}`);
  process.exit(1);
}

console.log(JSON.stringify({ status: "PASS", requiredFiles: required.length }, null, 2));
