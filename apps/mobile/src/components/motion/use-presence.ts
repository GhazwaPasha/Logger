import { useEffect, useState } from 'react';
import { runOnJS, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Duration, POP_EASE, Spring } from '@/constants/motion';

/**
 * Keeps an overlay mounted while it animates out. Drive the overlay's styles from `progress` (0 = hidden,
 * 1 = shown) and render it while `mounted` is true, e.g. `<Modal visible={mounted}>`.
 */
export function usePresence(
  visible: boolean,
  { spring = false, openMs = Duration.pop, closeMs = Duration.base }: { spring?: boolean; openMs?: number; closeMs?: number } = {},
) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  // Mount immediately when asked to show; unmounting waits for the exit animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      progress.value = spring
        ? withSpring(1, Spring.sheet)
        : withTiming(1, { duration: openMs, easing: POP_EASE });
    } else {
      progress.value = withTiming(0, { duration: closeMs, easing: POP_EASE }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, spring, openMs, closeMs, progress]);

  return { mounted, progress };
}
