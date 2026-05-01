/* Minimal installable-PWA service worker: pass-through only (no offline cache).
 *
 * Do not intercept favicons, manifest, or app icons — Windows may fetch these when
 * building the pinned taskbar shortcut; going through fetch(event.request) here has
 * caused broken / placeholder taskbar icons for some Edge + Win11 setups.
 */
const BYPASS_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icon.png",
  "/apple-icon.png",
  "/pwa-192.png",
  "/pwa-256.png",
  "/pwa-512.png",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  let pathname = "";
  try {
    pathname = new URL(event.request.url).pathname;
  } catch {
    /* ignore */
  }
  if (BYPASS_PATHS.has(pathname)) {
    return;
  }
  event.respondWith(fetch(event.request));
});
