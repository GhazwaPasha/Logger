"use client";

import { AppHeader } from "./AppHeader";
import { useAppPreferences } from "./AppPreferencesContext";

/** Minimal chrome for full-page workspace selection (no workspace sidebar). */
export function PickerChrome() {
  const { theme, setTheme } = useAppPreferences();
  return <AppHeader theme={theme} onThemeChange={setTheme} />;
}
