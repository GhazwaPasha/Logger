/**
 * LogBase design tokens. Values mirror the web app's `apps/web/src/app/globals.css` (the redesign tokens:
 * chrome / sheet / card / ink / line / fill, plus status, priority and department hues) so the native and web
 * apps read as one product. The older names (`fg`, `muted`, `surfaceElevated`…) stay as aliases onto the new
 * set, exactly as the web keeps `--fg`, `--muted`, `--surface-*`.
 */
const light = {
  // Surfaces
  /** Header + tab bar frame. */
  chrome: '#ECECEF',
  /** The page behind the content — a whisper of gray so white cards read. */
  sheet: '#F7F7F9',
  /** Cards and panels on the sheet. */
  card: '#FFFFFF',
  /** Selected / popped card, menus and bottom sheets. */
  cardRaised: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.18)',

  // Ink
  ink: '#1C1C1E',
  ink2: '#6E6E73',
  ink3: '#A1A1A6',

  // Lines and fills
  line: 'rgba(0, 0, 0, 0.08)',
  lineStrong: 'rgba(0, 0, 0, 0.14)',
  fill: 'rgba(0, 0, 0, 0.045)',
  fill2: 'rgba(0, 0, 0, 0.075)',
  fill3: 'rgba(0, 0, 0, 0.11)',

  // Primary (neutral)
  primary: '#1C1C1E',
  onPrimary: '#FFFFFF',

  // Departments (charts, icons)
  dept1: '#3366E0',
  dept2: '#E0761F',
  dept3: '#8A57D6',
  dept4: '#1F9A7E',
  dept1Tint: '#E7EEFC',
  dept2Tint: '#FCEBDD',
  dept3Tint: '#EFE7FA',
  dept4Tint: '#DDF2EC',

  // Status
  statusPending: '#8C9AB5',
  statusProgress: '#7C5CDB',
  statusDone: '#2E9E68',
  statusCancelled: '#C4C4CA',
  statusPendingBg: '#ECEEF3',
  statusPendingInk: '#4B5466',
  statusProgressBg: '#EEEAFB',
  statusProgressInk: '#5A3DB8',
  statusDoneBg: '#DFF3E8',
  statusDoneInk: '#1F7A4D',
  warning: '#E09A00',
  warningBg: '#FCF0D2',
  warningInk: '#8A5A00',

  // Priority
  priorityHigh: '#E5484D',
  priorityMedium: '#F59E0B',
  priorityLow: '#94A3B8',

  // Feedback
  danger: '#D23F57',
  success: '#2E9E68',
  infoBg: '#EAF0FD',
  infoInk: '#2552C4',
  online: '#22C55E',

  // Elevation shades (box-shadow colours)
  shadeSoft: 'rgba(0, 0, 0, 0.05)',
  shadeMid: 'rgba(0, 0, 0, 0.1)',
  shadeDeep: 'rgba(0, 0, 0, 0.14)',
  hairlineStrong: 'rgba(0, 0, 0, 0.16)',

  // Legacy aliases (same mapping as globals.css)
  bg: '#F7F7F9',
  fg: '#1C1C1E',
  muted: '#6E6E73',
  border: 'rgba(0, 0, 0, 0.14)',
  borderSubtle: 'rgba(0, 0, 0, 0.08)',
  accent: '#1C1C1E',
  accentHover: '#000000',
  onAccent: '#FFFFFF',
  accentMuted: 'rgba(0, 0, 0, 0.075)',
  surfaceBase: '#F7F7F9',
  surface: '#F4F4F6',
  /** Cards — the web moved every card onto `--card`. */
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EDEDF0',
  surfaceHover: '#EDEDF0',
  surfaceNav: '#ECECEF',
  bgHeader: '#ECECEF',
};

export type Palette = { [K in keyof typeof light]: string };

/**
 * Dark: a true-black page with gray cards on it (the mobile app's own call — the web does the reverse). Cards
 * read by their fill, so dark has no shadows or hairline rings at all (see `elevation`).
 */
const dark: Palette = {
  chrome: '#000000',
  sheet: '#000000',
  card: '#111113',
  cardRaised: '#1C1C1E',
  scrim: 'rgba(0, 0, 0, 0.5)',

  ink: '#F2F2F3',
  ink2: '#9A9AA0',
  ink3: '#5E5E64',

  line: 'rgba(255, 255, 255, 0.07)',
  lineStrong: 'rgba(255, 255, 255, 0.12)',
  fill: 'rgba(255, 255, 255, 0.045)',
  fill2: 'rgba(255, 255, 255, 0.08)',
  fill3: 'rgba(255, 255, 255, 0.12)',

  primary: '#F2F2F3',
  onPrimary: '#000000',

  dept1: '#5B8BF0',
  dept2: '#D27A2E',
  dept3: '#9D74E6',
  dept4: '#2A9C82',
  dept1Tint: 'rgba(91, 139, 240, 0.16)',
  dept2Tint: 'rgba(210, 122, 46, 0.16)',
  dept3Tint: 'rgba(157, 116, 230, 0.16)',
  dept4Tint: 'rgba(42, 156, 130, 0.16)',

  statusPending: '#8A94A8',
  statusProgress: '#9B84EE',
  statusDone: '#3A9E70',
  statusCancelled: '#5E5A56',
  statusPendingBg: 'rgba(255, 255, 255, 0.08)',
  statusPendingInk: '#E4E4E7',
  statusProgressBg: 'rgba(155, 132, 238, 0.16)',
  statusProgressInk: '#C2B4F8',
  statusDoneBg: 'rgba(58, 158, 112, 0.16)',
  statusDoneInk: '#5CC08F',
  warning: '#C98A12',
  warningBg: 'rgba(201, 138, 18, 0.16)',
  warningInk: '#E7B04A',

  priorityHigh: '#FF6369',
  priorityMedium: '#F5A524',
  priorityLow: '#8A94A8',

  danger: '#FF6B7F',
  success: '#3A9E70',
  infoBg: 'rgba(91, 139, 240, 0.15)',
  infoInk: '#8DB0F7',
  online: '#22C55E',

  shadeSoft: 'rgba(0, 0, 0, 0.3)',
  shadeMid: 'rgba(0, 0, 0, 0.55)',
  shadeDeep: 'rgba(0, 0, 0, 0.6)',
  hairlineStrong: 'rgba(255, 255, 255, 0.2)',

  bg: '#000000',
  fg: '#F2F2F3',
  muted: '#9A9AA0',
  border: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  accent: '#F2F2F3',
  accentHover: '#FFFFFF',
  onAccent: '#000000',
  accentMuted: 'rgba(255, 255, 255, 0.08)',
  surfaceBase: '#000000',
  surface: '#111113',
  surfaceElevated: '#111113',
  surfaceMuted: '#1C1C1E',
  surfaceHover: '#1C1C1E',
  surfaceNav: '#000000',
  bgHeader: '#000000',
};

export const Colors = { light, dark } as const;

export type ThemeName = keyof typeof Colors;
export type ThemeColor = keyof Palette;

/** Tailwind palette values still used for a few one-off tints (due chips, activity log). */
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

/**
 * A colour at a new opacity. Takes `#rgb`, `#rrggbb` or `rgba()`/`rgb()`; for an `rgba()` colour the
 * opacity multiplies the one it already has (so `alpha(theme.line, 0.5)` is half as strong as the line).
 */
export function alpha(color: string, a: number): string {
  const m = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    const base = m[4] === undefined ? 1 : Number(m[4]);
    return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${+(base * a).toFixed(4)})`;
  }
  const h = color.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Corner radii — the web's redesign scale (`--radius-*` in globals.css): sm 6 · md 8 · lg 9 · xl 12 ·
 * 2xl 16 · 3xl 24, scaled down a step for phone-sized cards: the web's 18px card corner on a ~170px tile reads
 * far rounder than on a desktop card, so cards here use `card` (12).
 */
export const Radius = { sm: 6, base: 6, md: 8, lg: 9, xl: 12, xxl: 14, card: 12, xxxl: 20, full: 9999 } as const;

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

/**
 * Elevation, as the web's `--elev-*` box shadows: a hairline ring plus a soft drop, no borders.
 * Spread these into a style (`{ ...elevation(theme, 'card') }`).
 *
 * Dark gets none: gray cards on a black page read by their fill, a shadow can't show on black, and the 0.5px
 * white ring jittered on Android while scrolling (sub-pixel ring snapping between pixels).
 */
export function elevation(theme: Palette, level: 'card' | 'raised' | 'overlay' = 'card') {
  if (theme === Colors.dark) return {};
  switch (level) {
    case 'raised':
      return { boxShadow: `0 0 0 1px ${theme.hairlineStrong}, 0 12px 32px ${theme.shadeMid}` };
    case 'overlay':
      return { boxShadow: `0 0 0 0.5px ${theme.hairlineStrong}, 0 12px 36px ${theme.shadeDeep}` };
    default:
      return { boxShadow: `0 0 0 0.5px ${theme.line}, 0 1px 3px ${theme.shadeSoft}` };
  }
}

/** A card on the sheet: card fill + the web's `shadow-card`. */
export function cardSurface(theme: Palette, radius: number = Radius.card) {
  return { backgroundColor: theme.card, borderRadius: radius, ...elevation(theme, 'card') };
}

/** Font family names registered in the root layout (`@expo-google-fonts/*`). */
export const Fonts = {
  sans: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
    bold: 'DMSans_700Bold',
  },
  /** Display face (`font-outfit` on the web): page titles, KPI figures, section headings. */
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
