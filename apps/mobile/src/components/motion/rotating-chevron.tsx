import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Duration, POP_EASE } from '@/constants/motion';
import type { ThemeColor } from '@/constants/theme';

/**
 * A chevron that turns when its section opens (the web's `rotate-90` with a 150ms transition).
 * The default points right and turns 90° to point down; pass a down chevron and `openDeg={180}` for
 * one that flips to point up.
 */
export function RotatingChevron({
  open,
  size = 12,
  color = 'muted',
  icon = faChevronRight,
  openDeg = 90,
}: {
  open: boolean;
  size?: number;
  color?: ThemeColor | (string & {});
  icon?: IconDefinition;
  openDeg?: number;
}) {
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: Duration.micro, easing: POP_EASE });
  }, [open, turn]);

  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * openDeg}deg` }] }));

  return (
    <Animated.View style={animated}>
      <Icon icon={icon} size={size} color={color} />
    </Animated.View>
  );
}
