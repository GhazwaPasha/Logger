import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Duration, POP_EASE } from '@/constants/motion';

/**
 * A header chip sliding in from its own edge (`-1` left, `1` right) once, on mount.
 *
 * A plain animated style rather than an `entering` Keyframe: the chips also carry a `layout` transition (the
 * bell + avatar pill springs as teammates come online), and the two layout-animation slots fight over the same
 * view. Transform only — no opacity — because the chips hold Liquid Glass, which stops rendering under a
 * faded ancestor (see `BarSurface`).
 */
export function useChipEnter(side: -1 | 1) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: Duration.panel, easing: POP_EASE });
  }, [p]);
  return useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - p.value) * side * 16 }, { scale: 0.94 + 0.06 * p.value }],
  }));
}
