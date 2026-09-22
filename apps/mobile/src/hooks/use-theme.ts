import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** Current palette (light or dark) — same token names as the web app's CSS variables. */
export function useTheme(): Palette {
  return Colors[useIsDark() ? 'dark' : 'light'];
}

export type ThemePreference = 'system' | 'light' | 'dark';
const PREF_KEY = 'logbase.theme';

/** Applies a stored preference (mirrors the web's `theme-pref`). Call once at startup. */
export async function restoreThemePreference() {
  try {
    const stored = await SecureStore.getItemAsync(PREF_KEY);
    if (stored === 'light' || stored === 'dark') Appearance.setColorScheme(stored);
  } catch {
    // keep the system default
  }
}

export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY)
      .then((v) => setPref(v === 'light' || v === 'dark' ? v : 'system'))
      .catch(() => {});
  }, []);

  const update = (next: ThemePreference) => {
    setPref(next);
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
    SecureStore.setItemAsync(PREF_KEY, next).catch(() => {});
  };

  return [pref, update];
}
