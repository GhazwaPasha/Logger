import { Text as RNText, type TextProps } from 'react-native';

import { Fonts, type FontFamily, type FontWeight, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Tailwind text sizes (font-size / line-height), as used across the web app. */
const SIZES = {
  '10': [10, 14],
  '11': [11, 15],
  xs: [12, 16],
  '13': [13, 18],
  '15': [15, 21],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
} as const;

export type TextSize = keyof typeof SIZES;

export type AppTextProps = TextProps & {
  size?: TextSize;
  weight?: FontWeight;
  font?: FontFamily;
  /** A theme token (`fg`, `muted`, …) or any raw colour string. */
  color?: ThemeColor | (string & {});
  tabular?: boolean;
  /** Letter spacing in px (Tailwind `tracking-*`). */
  tracking?: number;
  uppercase?: boolean;
  /** Override the line height. */
  lh?: number;
};

/** Text in the LogBase type system: DM Sans by default, Outfit for brand/nav, JetBrains Mono for ledger copy. */
export function Text({
  size = 'sm',
  weight = 'regular',
  font = 'sans',
  color = 'fg',
  tabular,
  tracking,
  uppercase,
  lh,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const [fontSize, lineHeight] = SIZES[size];
  const resolved = color in theme ? theme[color as ThemeColor] : color;

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: Fonts[font][weight],
          fontSize,
          lineHeight: lh ?? lineHeight,
          color: resolved,
          ...(tabular ? { fontVariant: ['tabular-nums' as const] } : null),
          ...(tracking !== undefined ? { letterSpacing: tracking } : null),
          ...(uppercase ? { textTransform: 'uppercase' as const } : null),
        },
        style,
      ]}
    />
  );
}
