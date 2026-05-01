/**
 * Windows taskbar / pinned shortcuts resolve `/favicon.ico` outside normal tab caching.
 * Keep it as a plain `public/` static file (not `app/`) so it isn’t tied to the App Router,
 * and skip it in `public/sw.js` so the service worker never intercepts icon fetches.
 * Source PNG must stay alpha-preserving (see `gen-pwa-icons.ps1`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const icon256 = path.join(webRoot, "public", "icons", "logbase-app-256.png");
const icon192 = path.join(webRoot, "public", "icons", "logbase-app-192.png");
const srcPng = fs.existsSync(icon256) ? icon256 : icon192;
const outIco = path.join(webRoot, "public", "favicon.ico");

async function main() {
  if (!fs.existsSync(srcPng)) {
    console.error(
      "build-favicon: missing public/icons/logbase-app-256.png (or -192) — run scripts/gen-pwa-icons.ps1",
    );
    process.exit(1);
  }
  const buf = await pngToIco(srcPng);
  fs.writeFileSync(outIco, buf);
  console.log("Wrote public/favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
