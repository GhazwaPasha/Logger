import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';

/**
 * Keep phones in portrait. The lock lives here rather than in app.json's `orientation` because a manifest lock
 * also pins tablets and foldables, which Google Play flags (and Android 16 ignores on large screens anyway).
 * Screens whose shortest side is 600dp or more — tablets, unfolded foldables — rotate freely.
 */
export function lockPhonesToPortrait() {
  const { width, height } = Dimensions.get('screen');
  if (Math.min(width, height) >= 600) return;
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
}
