"use client";

import { createContext, useContext, useMemo } from "react";
import type { ThemePref } from "@/hooks/useThemePreference";

type Ctx = { theme: ThemePref; setTheme: (t: ThemePref) => void };

const AppPreferencesContext = createContext<Ctx | null>(null);

export function AppPreferencesProvider({
  theme,
  setTheme,
  children,
}: {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const v = useContext(AppPreferencesContext);
  if (!v) throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  return v;
}
