import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { StyleProp, ViewStyle } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** FontAwesome icon — the same icon set (v7) the web app uses, tinted from the theme. */
export function Icon({
  icon,
  size = 16,
  color = 'fg',
  style,
}: {
  icon: IconDefinition;
  size?: number;
  color?: ThemeColor | (string & {});
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const resolved = color in theme ? theme[color as ThemeColor] : color;
  return <FontAwesomeIcon icon={icon} size={size} color={resolved} style={style as never} />;
}
