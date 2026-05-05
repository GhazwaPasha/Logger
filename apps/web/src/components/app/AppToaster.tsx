"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

function resolveSonnerTheme(): "light" | "dark" | "system" {
  if (typeof document === "undefined") return "system";
  const mode = document.documentElement.getAttribute("data-theme");
  if (mode === "dark" || mode === "light") return mode;
  return "system";
}

/** Theme-aware Sonner host; follows `html[data-theme]` and system preference when theme is system. */
export function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(resolveSonnerTheme());
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", read);
    };
  }, []);

  return (
    <Toaster
      theme={theme}
      richColors={false}
      closeButton
      position="top-center"
      className="app-toaster"
      gap={16}
      offset={{ top: 12 }}
      toastOptions={{
        classNames: {
          content: "app-toaster__content",
        },
      }}
    />
  );
}
