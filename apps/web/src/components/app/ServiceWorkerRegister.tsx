"use client";

import { useEffect } from "react";

/** Registers a minimal pass-through SW in production so Chromium can offer “Install app”. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  }, []);

  return null;
}
