import { Image } from 'react-native';

import { useIsDark } from '@/hooks/use-theme';

const light = require('@/assets/logbase-mark-light.png');
const dark = require('@/assets/logbase-mark-dark.png');

/** Brand mark: a square slot with the theme-appropriate artwork (`LogBaseMark` on the web; 34px in the header). */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="LogBase"
      source={useIsDark() ? dark : light}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
