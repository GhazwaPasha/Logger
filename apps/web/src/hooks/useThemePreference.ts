"use client";

import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemePref>("system");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, setTheme };
}
