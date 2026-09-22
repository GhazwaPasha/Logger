import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { alpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A 3px bar along the top of a card while it saves, with a soft highlight sweeping across
 * (the web's `task-sync-ribbon`: a 38%-wide gradient sliding over 1.05s).
 */
export function SyncRibbon() {
  const theme = useTheme();
  const width = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.ease) }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-width.value * 0.38, width.value]) }],
  }));

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => {
        width.set(e.nativeEvent.layout.width);
      }}
      style={[styles.track, { backgroundColor: alpha(theme.fg, 0.07) }]}>
      <Animated.View style={[styles.thumb, thumb]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={theme.accent} stopOpacity={0} />
              <Stop offset="0.5" stopColor={theme.accent} stopOpacity={0.9} />
              <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ribbon)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 5, overflow: 'hidden' },
  thumb: { position: 'absolute', top: 0, left: 0, height: '100%', width: '38%' },
});
