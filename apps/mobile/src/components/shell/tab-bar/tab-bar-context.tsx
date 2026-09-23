import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Duration, POP_EASE } from '@/constants/motion';

/** Height of the floating bar row (the pill and the search circle). */
export const TAB_BAR_HEIGHT = 60;
/** Gap between the bar and the bottom safe-area edge. */
export const TAB_BAR_GAP = 8;

type TabBarValue = {
  /** 0 = full bar, 1 = collapsed to the current tab's pill. Animated. */
  collapse: SharedValue<number>;
  /** Where `collapse` is heading, so scroll events don't restart the animation on every frame. */
  collapseTarget: SharedValue<number>;
  /** 1 while search or the expanded panel is open: scrolling must not collapse the bar then. */
  collapseLocked: SharedValue<number>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

const TabBarContext = createContext<TabBarValue | null>(null);

/** Shared state between the floating tab bar and the screens under it. Lives in the tabs layout. */
export function TabBarProvider({ children }: { children: ReactNode }) {
  const collapse = useSharedValue(0);
  const collapseTarget = useSharedValue(0);
  const collapseLocked = useSharedValue(0);
  const [searchQuery, setSearchQuery] = useState('');
  const value = useMemo(
    () => ({ collapse, collapseTarget, collapseLocked, searchQuery, setSearchQuery }),
    [collapse, collapseTarget, collapseLocked, searchQuery],
  );
  return <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>;
}

export function useTabBar(): TabBarValue {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error('useTabBar must be used inside <TabBarProvider>');
  return ctx;
}

/**
 * Bottom padding a scrolling screen needs so its last row clears the floating bar. Zero on screens pushed
 * above the tabs (task detail, settings…), where there is no bar.
 */
export function useTabBarInset(): number {
  const ctx = useContext(TabBarContext);
  const insets = useSafeAreaInsets();
  return ctx ? TAB_BAR_HEIGHT + TAB_BAR_GAP + insets.bottom + 12 : 0;
}

/** Scrolled less than this from the top, the bar always shows in full. */
const TOP_ZONE = 48;
/** Per-event movement that counts as a deliberate scroll direction. */
const DIRECTION_SLOP = 6;

/**
 * Scroll handler that collapses the bar while scrolling down and restores it when scrolling up (Apple's
 * `minimizeBehavior="onScrollDown"`). Pass it to an `Animated.ScrollView` / `Animated.FlatList` `onScroll`.
 * Outside the tabs it drives a throwaway value, so screens can use it unconditionally.
 */
export function useCollapseOnScroll() {
  const ctx = useContext(TabBarContext);
  const fallback = useSharedValue(0);
  const fallbackTarget = useSharedValue(0);
  const fallbackLocked = useSharedValue(0);
  const collapse = ctx?.collapse ?? fallback;
  const target = ctx?.collapseTarget ?? fallbackTarget;
  const locked = ctx?.collapseLocked ?? fallbackLocked;
  const lastY = useSharedValue(0);

  return useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const dy = y - lastY.value;
      lastY.value = y;
      if (locked.value === 1) return;
      let next = target.value;
      if (y < TOP_ZONE) next = 0;
      else if (dy > DIRECTION_SLOP) next = 1;
      else if (dy < -DIRECTION_SLOP) next = 0;
      if (next !== target.value) {
        target.value = next;
        collapse.value = withTiming(next, { duration: Duration.pill, easing: POP_EASE });
      }
    },
  });
}
