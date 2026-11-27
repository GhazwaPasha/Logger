import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { LucideIcon } from 'lucide-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * An icon: a lucide icon (the set the web app uses), or a FontAwesome brand mark (Discord, Google) — the
 * only FontAwesome icons left, since lucide has no brand logos.
 */
export type IconType = LucideIcon | IconDefinition;

function isBrand(icon: IconType): icon is IconDefinition {
  return typeof icon === 'object' && icon !== null && 'iconName' in icon;
}

/**
 * Lucide strokes read thin at small sizes, so small icons get a slightly heavier line (the web does the
 * same with `strokeWidth={2.4}` on its 14px labels).
 */
function strokeFor(size: number) {
  return size <= 12 ? 2.5 : size <= 15 ? 2.25 : 2;
}

/** An icon tinted from the theme (`color` is a theme token or any raw colour). */
export function Icon({
  icon,
  size = 16,
  color = 'fg',
  strokeWidth,
  fill,
  style,
}: {
  icon: IconType;
  size?: number;
  color?: ThemeColor | (string & {});
  strokeWidth?: number;
  /** Fill for lucide shapes (e.g. a filled pin); brand marks are always solid. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const resolved = color in theme ? theme[color as ThemeColor] : color;
  if (isBrand(icon)) {
    return <FontAwesomeIcon icon={icon} size={size} color={resolved} style={style as never} />;
  }
  const Lucide = icon;
  return (
    <Lucide
      size={size}
      color={resolved}
      strokeWidth={strokeWidth ?? strokeFor(size)}
      fill={fill ?? 'none'}
      style={style as never}
    />
  );
}
