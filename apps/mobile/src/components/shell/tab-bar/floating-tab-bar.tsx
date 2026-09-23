import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCalendarDays,
  faChevronLeft,
  faChevronUp,
  faCircleXmark,
  faHashtag,
  faHouse,
  faListCheck,
  faMagnifyingGlass,
  faRoute,
} from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { useTabTrigger } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { barShadow, BarSurface } from '@/components/shell/tab-bar/bar-surface';
import { TAB_BAR_GAP, TAB_BAR_HEIGHT, useTabBar } from '@/components/shell/tab-bar/tab-bar-context';
import { Text } from '@/components/text';
import { Duration, POP_EASE } from '@/constants/motion';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export type TabName = 'dashboard' | 'my-tasks' | 'channels' | 'calendar' | 'roadmap' | 'search';
type TabDef = { name: TabName; label: string; icon: IconDefinition };

/** Always in the bar. */
const MAIN: TabDef[] = [
  { name: 'dashboard', label: 'Home', icon: faHouse },
  { name: 'my-tasks', label: 'My tasks', icon: faListCheck },
  { name: 'channels', label: 'Channels', icon: faHashtag },
];
/** Revealed when the bar expands. */
const MORE: TabDef[] = [
  { name: 'calendar', label: 'Calendar', icon: faCalendarDays },
  { name: 'roadmap', label: 'Roadmap', icon: faRoute },
];
const ALL: TabDef[] = [...MAIN, ...MORE, { name: 'search', label: 'Search', icon: faMagnifyingGlass }];

const SIDE = 16;
const RADIUS = TAB_BAR_HEIGHT / 2;
const PAD = 6;
const EXPAND_W = 52;
const COMPACT_W = 92;
const PANEL_ROW_H = 48;
const PANEL_PAD = 8;
const PANEL_H = PANEL_PAD * 2 + PANEL_ROW_H * 2;
const SPRING = { damping: 22, stiffness: 260, mass: 0.8 };

/**
 * The floating tab bar: Home / My tasks / Channels plus an expand button that grows the bar upward into a
 * Calendar / Roadmap panel, and a separate round Search button that turns the bar into a search field.
 * The always-visible tabs are icon-only (labels are for screen readers). Scrolling down shrinks the bar to a
 * pill of the current tab (`useCollapseOnScroll`); scrolling up restores it.
 */
export function FloatingTabBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { collapse, collapseTarget, collapseLocked, searchQuery, setSearchQuery } = useTabBar();
  const { getTrigger, switchTab } = useTabTrigger({ name: 'dashboard' });

  const focused: TabName = ALL.find((t) => getTrigger(t.name)?.isFocused)?.name ?? 'dashboard';
  const searchMode = focused === 'search';
  const focusedDef = ALL.find((t) => t.name === focused) ?? MAIN[0];
  const mainIndex = MAIN.findIndex((t) => t.name === focused);
  const moreFocused = MORE.some((t) => t.name === focused);

  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lastTab = useRef<TabName>('dashboard');
  const inputRef = useRef<TextInput>(null);

  // Geometry: full row = bar + gap + search circle; the bar's own width animates between the states.
  const rowW = screenW - SIDE * 2;
  const barFullW = rowW - TAB_BAR_HEIGHT - 8;
  const itemW = (barFullW - PAD * 2 - EXPAND_W) / MAIN.length;

  const expand = useSharedValue(0);
  const search = useSharedValue(searchMode ? 1 : 0);
  const highlightX = useSharedValue(PAD + Math.max(mainIndex, 0) * itemW);
  const highlightOn = useSharedValue(mainIndex >= 0 ? 1 : 0);
  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    if (!searchMode) lastTab.current = focused;
    // A new screen starts at its top, so the bar starts in full.
    collapseTarget.value = 0;
    collapse.value = withTiming(0, { duration: Duration.pill, easing: POP_EASE });
    search.value = withTiming(searchMode ? 1 : 0, { duration: Duration.pill, easing: POP_EASE });
    if (mainIndex >= 0) highlightX.value = withSpring(PAD + mainIndex * itemW, SPRING);
    highlightOn.value = withTiming(mainIndex >= 0 ? 1 : 0, { duration: Duration.micro });
  }, [focused, searchMode, mainIndex, itemW, collapse, collapseTarget, search, highlightX, highlightOn]);

  useEffect(() => {
    expand.value = withSpring(expanded ? 1 : 0, SPRING);
  }, [expanded, expand]);

  // While searching or with the panel open, scrolling the page must not collapse the bar.
  useEffect(() => {
    collapseLocked.value = searchMode || expanded ? 1 : 0;
  }, [searchMode, expanded, collapseLocked]);

  // Focus the field once the bar has morphed into it (focusing mid-animation makes the keyboard race the
  // layout); blur when leaving so the keyboard goes down with it.
  useEffect(() => {
    if (!searchMode) {
      inputRef.current?.blur();
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), Duration.pill);
    return () => clearTimeout(t);
  }, [searchMode]);

  // Mirror the collapsed state to JS so the right layer takes touches.
  useAnimatedReaction(
    () => collapseTarget.value === 1,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setCollapsed, now);
    },
  );

  // Android back: close the panel first, then leave search.
  useEffect(() => {
    if (!expanded && !searchMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (expanded) setExpanded(false);
      else leaveSearch();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, searchMode]);

  function go(name: TabName) {
    haptics.select();
    setExpanded(false);
    if (name === focused) {
      // Re-tapping Channels returns to the channel list from a board.
      if (name === 'channels') router.navigate('/channels');
      return;
    }
    switchTab(name, {});
  }

  function leaveSearch() {
    Keyboard.dismiss();
    switchTab(lastTab.current, {});
  }

  function restore() {
    collapseTarget.value = 0;
    collapse.value = withTiming(0, { duration: Duration.pill, easing: POP_EASE });
  }

  // Driven only by animated values, so it moves continuously with the keyboard: in search the bar rides on top
  // of the keyboard; elsewhere (renaming a channel, say) it slides down out of the keyboard's way.
  const wrapStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;
    const lift = Math.max(0, kb - insets.bottom);
    const hide = Math.min(kb, TAB_BAR_HEIGHT * 2 + insets.bottom + TAB_BAR_GAP);
    return { transform: [{ translateY: interpolate(search.value, [0, 1], [hide, -lift]) }] };
  }, [insets.bottom]);

  const barStyle = useAnimatedStyle(() => {
    const c = collapse.value * (1 - search.value) * (1 - expand.value);
    const base = interpolate(c, [0, 1], [barFullW, COMPACT_W]);
    return {
      width: interpolate(search.value, [0, 1], [base, rowW]),
      height: TAB_BAR_HEIGHT + PANEL_H * expand.value,
    };
  }, [barFullW, rowW]);

  const fullRow = useAnimatedStyle(() => ({
    opacity: (1 - collapse.value * (1 - expand.value)) * (1 - search.value),
  }));
  const compactRow = useAnimatedStyle(() => ({
    opacity: collapse.value * (1 - expand.value) * (1 - search.value),
  }));
  const panel = useAnimatedStyle(() => ({
    opacity: expand.value,
    transform: [{ translateY: (1 - expand.value) * 12 }],
  }));
  const highlight = useAnimatedStyle(() => ({
    opacity: highlightOn.value,
    transform: [{ translateX: highlightX.value }],
  }));
  const searchRow = useAnimatedStyle(() => ({
    opacity: interpolate(search.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const circle = useAnimatedStyle(() => ({
    width: TAB_BAR_HEIGHT * (1 - search.value),
    marginLeft: 8 * (1 - search.value),
  }));
  const circleIcon = useAnimatedStyle(() => ({
    opacity: interpolate(search.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${expand.value * 180}deg` }] }));
  const scrim = useAnimatedStyle(() => ({ opacity: expand.value }));

  return (
    <>
      {/* Dims the screen while the bar is expanded; tapping it closes the panel. */}
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpanded(false)} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.wrap, { left: SIDE, right: SIDE, bottom: insets.bottom + TAB_BAR_GAP }, wrapStyle]}>
        <Animated.View style={[styles.bar, barShadow, barStyle]}>
          <BarSurface radius={RADIUS} />

          {/* Expanded panel: the secondary tabs. */}
          <Animated.View pointerEvents={expanded ? 'auto' : 'none'} style={[styles.panel, panel]}>
            {MORE.map((t) => {
              const active = t.name === focused;
              return (
                <PressableScale
                  key={t.name}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: active }}
                  scaleTo={0.95}
                  onPress={() => go(t.name)}
                  style={({ pressed }) => [
                    styles.panelRow,
                    { backgroundColor: active ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
                  ]}>
                  <View style={[styles.panelIcon, { backgroundColor: active ? theme.accent : theme.surfaceMuted }]}>
                    <Icon icon={t.icon} size={15} color={active ? theme.onAccent : theme.fg} />
                  </View>
                  <Text size="sm" weight={active ? 'semibold' : 'medium'} numberOfLines={1}>
                    {t.label}
                  </Text>
                </PressableScale>
              );
            })}
          </Animated.View>

          {/* Full row: the main tabs and the expand toggle. */}
          <Animated.View
            pointerEvents={collapsed || searchMode ? 'none' : 'auto'}
            style={[styles.row, fullRow]}>
            <Animated.View
              pointerEvents="none"
              style={[styles.highlight, { width: itemW, backgroundColor: theme.accentMuted }, highlight]}
            />
            {MAIN.map((t) => {
              const active = t.name === focused;
              return (
                <PressableScale
                  key={t.name}
                  accessibilityRole="tab"
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: active }}
                  scaleTo={0.94}
                  onPress={() => go(t.name)}
                  style={[styles.item, { width: itemW }]}>
                  <Icon icon={t.icon} size={20} color={active ? theme.fg : theme.muted} />
                </PressableScale>
              );
            })}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Show fewer tabs' : 'Show more tabs'}
              accessibilityState={{ expanded }}
              scaleTo={0.9}
              haptic="select"
              onPress={() => {
                restore();
                setExpanded((v) => !v);
              }}
              style={[
                styles.expand,
                { backgroundColor: moreFocused && !expanded ? theme.accentMuted : 'transparent' },
              ]}>
              {moreFocused && !expanded ? (
                <Icon icon={focusedDef.icon} size={17} color={theme.fg} />
              ) : (
                <Animated.View style={chevron}>
                  <Icon icon={faChevronUp} size={15} color={theme.muted} />
                </Animated.View>
              )}
            </PressableScale>
          </Animated.View>

          {/* Collapsed: a pill of the current tab; tapping it brings the full bar back. */}
          <Animated.View pointerEvents={collapsed && !searchMode ? 'auto' : 'none'} style={[styles.row, compactRow]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${focusedDef.label}. Show tabs`}
              scaleTo={0.96}
              onPress={restore}
              style={styles.compact}>
              <Icon icon={focusedDef.icon} size={19} color={theme.fg} />
              <Icon icon={faChevronUp} size={11} color={theme.muted} />
            </PressableScale>
          </Animated.View>

          {/* Search mode: the bar becomes the search field. */}
          <Animated.View pointerEvents={searchMode ? 'auto' : 'none'} style={[styles.row, styles.searchRow, searchRow]}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Close search"
              scaleTo={0.9}
              hitSlop={6}
              onPress={leaveSearch}
              style={styles.searchIconBtn}>
              <Icon icon={faChevronLeft} size={16} color={theme.fg} />
            </PressableScale>
            <TextInput
              ref={inputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tasks, channels, people…"
              placeholderTextColor={theme.muted}
              cursorColor={theme.accent}
              selectionColor={theme.accentMuted}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              style={[styles.searchInput, { color: theme.fg, fontFamily: Fonts.sans.regular }]}
            />
            {searchQuery ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                scaleTo={0.9}
                hitSlop={6}
                onPress={() => setSearchQuery('')}
                style={styles.searchIconBtn}>
                <Icon icon={faCircleXmark} size={16} color={theme.muted} />
              </PressableScale>
            ) : null}
          </Animated.View>
        </Animated.View>

        {/* The separate round search button (iOS 26 style); it merges into the bar in search mode. */}
        <Animated.View style={[styles.circle, barShadow, circle]}>
          <BarSurface radius={RADIUS} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Search"
            scaleTo={0.9}
            disabled={searchMode}
            onPress={() => go('search')}
            style={styles.circleBtn}>
            <Animated.View style={circleIcon}>
              <Icon icon={faMagnifyingGlass} size={18} color={theme.fg} />
            </Animated.View>
          </PressableScale>
        </Animated.View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
  bar: { borderRadius: RADIUS, overflow: 'hidden' },
  // Sits directly above the tab row, so while the bar grows it is revealed from the row upward (the bar clips it).
  panel: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 0,
    right: 0,
    height: PANEL_H,
    paddingHorizontal: PAD,
    paddingVertical: PANEL_PAD,
  },
  // One destination per row, left-aligned: icon chip, then the label.
  panelRow: {
    height: PANEL_ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    borderRadius: PANEL_ROW_H / 2,
  },
  panelIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
  },
  highlight: { position: 'absolute', left: 0, top: PAD, bottom: PAD, borderRadius: RADIUS - PAD },
  item: { height: TAB_BAR_HEIGHT - PAD * 2, alignItems: 'center', justifyContent: 'center' },
  expand: {
    width: EXPAND_W - 4,
    height: EXPAND_W - 4,
    marginLeft: 2,
    borderRadius: (EXPAND_W - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    flex: 1,
    height: TAB_BAR_HEIGHT - PAD * 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchRow: { gap: 4, paddingHorizontal: 8 },
  searchIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, height: TAB_BAR_HEIGHT, fontSize: 15, paddingVertical: 0 },
  circle: { height: TAB_BAR_HEIGHT, borderRadius: RADIUS, overflow: 'hidden' },
  circleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
