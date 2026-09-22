import Svg, { Path } from 'react-native-svg';

/**
 * The menu icon: two rounded lines, the bottom one shorter, in place of the usual three equal bars.
 * The artwork is 18px wide with the line caps flush to the edge, so its left edge sits exactly at the
 * component's left edge (handy for aligning it with the page gutter).
 */
export function MenuGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={(size * 12) / 18} viewBox="0 0 18 12">
      <Path d="M1.1 2.6H16.9M1.1 9.4H11.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
