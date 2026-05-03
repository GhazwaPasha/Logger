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
  "/icons/logbase-app-192.png",
  "/icons/logbase-app-256.png",
  "/icons/logbase-app-512.png",
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

self.addEventListener("push", (event) => {
  let data = { title: "LogBase", body: "Task activity", url: "/" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        data = {
          title: typeof parsed.title === "string" ? parsed.title : data.title,
          body: typeof parsed.body === "string" ? parsed.body : data.body,
          url: typeof parsed.url === "string" ? parsed.url : data.url,
        };
      }
    }
  } catch {
    /* ignore */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/logbase-app-192.png",
      badge: "/icons/logbase-app-192.png",
      data: { url: data.url },
      tag: "logbase-task",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url;
  const target = typeof url === "string" && url.length > 0 ? url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          void client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    }),
  );
});
