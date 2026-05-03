"use client";

import { useEffect } from "react";

/** Registers the app service worker (PWA install + web push). Pass-through fetch; push handled in `public/sw.js`. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }, []);

  return null;
}
