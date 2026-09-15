"use client";

import { useEffect, useState } from "react";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/theme-color";

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "theme-pref";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function readStored(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** There must only ever be one `meta[name=theme-color]` in the document — some Android/PWA
 *  standalone renderers don't evaluate this tag's `media` attribute and just latch onto whichever
 *  one appears first, so a second tag (e.g. an appended "override") silently gets ignored instead
 *  of taking priority. Always find-and-mutate the single tag layout.tsx's inline script created. */
function setThemeColorMeta(isDark: boolean) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePref>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);

    if (theme !== "system") {
      setThemeColorMeta(theme === "dark");
      return;
    }
    // "system" has no fixed color — track the OS preference live instead of a one-time read.
    const mql = window.matchMedia(DARK_MEDIA_QUERY);
    setThemeColorMeta(mql.matches);
    const onChange = () => setThemeColorMeta(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
