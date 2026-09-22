/**
 * LogBase design tokens. Values mirror the web app (`apps/web/src/app/globals.css` and Tailwind's
 * palette as used by `apps/web/src/lib/task-board.ts`) so the native and web apps read as one product.
 */
export const Colors = {
  light: {
    bg: '#ffffff',
    fg: '#0c0c0d',
    border: '#e5e5e5',
    borderSubtle: '#ededed',
    accent: '#27272a',
    accentHover: '#18181b',
    onAccent: '#fafafa',
    muted: '#737373',
    surfaceBase: '#ffffff',
    surface: '#f4f4f5',
    surfaceElevated: '#f4f4f5',
    surfaceMuted: '#ececed',
    surfaceHover: '#ececed',
    surfaceNav: '#f4f4f5',
    bgHeader: '#f4f4f5',
    accentMuted: 'rgba(39, 39, 42, 0.09)',
    scrim: 'rgba(0, 0, 0, 0.4)',
  },
  /**
   * Dark palette: the web's zinc tokens (globals.css) with the blue bias taken out — every gray is
   * neutral (R = G = B). The originals carry a 2–5 step blue cast (e.g. header/sidebar #0f0f12) that
   * reads as navy on OLED panels and in screen captures; luminance and layering are unchanged.
   */
  dark: {
    bg: '#090909',
    fg: '#fafafa',
    border: '#272727',
    borderSubtle: '#1f1f1f',
    accent: '#e4e4e4',
    accentHover: '#fafafa',
    onAccent: '#181818',
    muted: '#a1a1a1',
    surfaceBase: '#090909',
    surface: '#121212',
    surfaceElevated: '#121212',
    surfaceMuted: '#181818',
    surfaceHover: '#1c1c1c',
    surfaceNav: '#0f0f0f',
    bgHeader: '#0f0f0f',
    accentMuted: 'rgba(228, 228, 228, 0.12)',
    scrim: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof (typeof Colors)['light'];
export type Palette = { [K in ThemeColor]: string };

/** Tailwind palette values the web app uses for status / priority / due tinting. */
export const Tone = {
  slate600: '#475569',
  slate500: '#64748b',
  slate400: '#94a3b8',
  sky600: '#0284c7',
  sky500: '#0ea5e9',
  sky400: '#38bdf8',
  violet600: '#7c3aed',
  violet500: '#8b5cf6',
  violet400: '#a78bfa',
  orange600: '#ea580c',
  orange500: '#f97316',
  orange400: '#fb923c',
  emerald600: '#059669',
  emerald500: '#10b981',
  emerald400: '#34d399',
  neutral600: '#525252',
  neutral500: '#737373',
  neutral400: '#a3a3a3',
  red500: '#ef4444',
  red600: '#dc2626',
  red400: '#f87171',
  green500: '#22c55e',
  green600: '#16a34a',
  green400: '#4ade80',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue400: '#60a5fa',
  amber500: '#f59e0b',
  amber400: '#fbbf24',
} as const;

/** `rgba()` from a `#rrggbb` colour. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Corner radii. The web app tightens Tailwind's defaults (`--radius-*` in globals.css),
 * so `rounded-xl` is 7px, not 12px. Plain `rounded` stays at 4px.
 */
export const Radius = { sm: 3, base: 4, md: 4, lg: 5, xl: 7, xxl: 9, xxxl: 12, full: 9999 } as const;

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

/** Font family names registered in the root layout (`@expo-google-fonts/*`). */
export const Fonts = {
  sans: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
  },
  /** Brand / navigation face (`font-outfit` on the web). */
  outfit: {
    regular: 'Outfit_500Medium',
    medium: 'Outfit_500Medium',
    semibold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
  },
  /** Ledger / activity face (`font-mono-ledger` on the web). */
  mono: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_500Medium',
    bold: 'JetBrainsMono_500Medium',
  },
} as const;

export type FontFamily = keyof typeof Fonts;
export type FontWeight = keyof (typeof Fonts)['sans'];
