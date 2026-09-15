"use client";

import { useEffect, useState } from "react";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/theme-color";

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "theme-pref";
const THEME_COLOR_OVERRIDE_ID = "theme-color-override";

function readStored(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** Keeps the status-bar color in step with an explicit light/dark pick; "system" defers back to
 *  the prefers-color-scheme meta tags in layout.tsx so it tracks the OS instead. */
function syncThemeColorMeta(theme: ThemePref) {
  const existing = document.getElementById(THEME_COLOR_OVERRIDE_ID);
  if (theme === "system") {
    existing?.remove();
    return;
  }
  const content = theme === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  if (existing) {
    existing.setAttribute("content", content);
  } else {
    const meta = document.createElement("meta");
    meta.id = THEME_COLOR_OVERRIDE_ID;
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePref>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    syncThemeColorMeta(theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
