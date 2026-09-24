import type { ReactNode } from 'react';
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useCollapseOnScroll, useTabBarInset } from '@/components/shell/tab-bar/tab-bar-context';
import { Text } from '@/components/text';
import { pageEnter, sequenceEnter, stateTransition } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Scrollable page body: the web's `<main>` padding (`px-3 pt-3 pb-6`) on the base surface. `header` stays
 * fixed above the scroll area. Under the tabs, the body clears the floating bar and collapses it on scroll.
 */
export function Page({
  children,
  header,
  onRefresh,
  refreshing,
  gap = 12,
  enter = true,
}: {
  children: ReactNode;
  header?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  gap?: number;
  /** Off for pages that sequence their own sections in; a whole-page rise on top would move them twice. */
  enter?: boolean;
}) {
  const theme = useTheme();
  const bottomInset = useTabBarInset();
  const onScroll = useCollapseOnScroll();
  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
      {header}
      <PageEnter enabled={enter}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={styles.fill}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 32 + bottomInset, gap }}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.muted} /> : undefined
          }>
          {children}
        </Animated.ScrollView>
      </PageEnter>
    </View>
  );
}

/** A screen's root: fades in with a 6px rise when it mounts (the web's route template). */
export function PageEnter({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  return (
    <Animated.View entering={enabled ? pageEnter : undefined} style={styles.fill}>
      {children}
    </Animated.View>
  );
}

/** Elevated panel (`surface-elevated ui-elevated-panel rounded-2xl border border-subtle p-2.5`). */
export function Panel({
  children,
  style,
  enterIndex,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Position in an entrance sequence; omit for no entrance animation. */
  enterIndex?: number;
}) {
  const theme = useTheme();
  return (
    <Animated.View
      entering={enterIndex === undefined ? undefined : sequenceEnter(enterIndex, 8)}
      style={[
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.borderSubtle,
          borderWidth: 1,
          borderRadius: Radius.xxl,
          padding: 10,
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

/** Small uppercase label (`text-xs font-semibold uppercase tracking-wide text-muted`). */
export function SectionLabel({ children, size = 'xs' }: { children: ReactNode; size?: 'xs' | '10' }) {
  return (
    <Text size={size} weight="semibold" color="muted" uppercase tracking={0.5}>
      {children}
    </Text>
  );
}

/** Page title (`text-xl font-semibold tracking-tight`). */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <Text size="xl" weight="semibold" tracking={-0.4}>
      {children}
    </Text>
  );
}

/** Pill-group switcher (`rounded-xl bg-surface-elevated p-0.5` with `rounded-lg px-3 py-2 text-xs` buttons). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceElevated }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            haptic="select"
            style={[styles.segment, { backgroundColor: active ? theme.accentMuted : 'transparent' }, stateTransition]}>
            <Text size="xs" weight="medium" color={active ? 'fg' : 'muted'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', padding: 2, borderRadius: Radius.xl },
  segment: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg },
});
