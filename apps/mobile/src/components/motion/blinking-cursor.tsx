import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';

/** The terminal-style block cursor on the activity log (the web's `term-cursor-blink`). */
export function BlinkingCursor() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1, easing: Easing.linear }),
        withTiming(0, { duration: 520 }),
        withTiming(1, { duration: 1, easing: Easing.linear }),
        withTiming(1, { duration: 520 }),
      ),
      -1,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={animated}>
      <Text font="mono" size="xs" color="accent">
        ▍
      </Text>
    </Animated.View>
  );
}
