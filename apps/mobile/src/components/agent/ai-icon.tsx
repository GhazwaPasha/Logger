import Svg, { Path } from 'react-native-svg';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The AI mark: the common "sparkles" glyph (same shape as the web's `AiIcon`), tinted from the theme. */
export function AiIcon({ size = 18, color = 'fg' }: { size?: number; color?: ThemeColor | (string & {}) }) {
  const theme = useTheme();
  const fill = color in theme ? theme[color as ThemeColor] : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>
      <Path d="M10 3.5Q11.1 11.4 18.5 13Q11.1 14.6 10 22.5Q8.9 14.6 1.5 13Q8.9 11.4 10 3.5Z" />
      <Path d="M18.5 1.5Q19 4.6 22.5 5.5Q19 6.4 18.5 9.5Q18 6.4 14.5 5.5Q18 4.6 18.5 1.5Z" />
    </Svg>
  );
}
