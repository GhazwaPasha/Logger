import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Icon, type IconType } from '@/components/icon';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useCollapseOnScroll, useTabBarInset } from '@/components/shell/tab-bar/tab-bar-context';
import { Text } from '@/components/text';
import { pageEnter, sequenceEnter } from '@/constants/motion';
import { cardSurface, elevation, Radius } from '@/constants/theme';
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
  onNearEnd,
}: {
  children: ReactNode;
  header?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  gap?: number;
  /** Off for pages that sequence their own sections in; a whole-page rise on top would move them twice. */
  enter?: boolean;
  /** Pagination trigger: fires once each time the scroll nears the bottom (see `useCollapseOnScroll`). */
  onNearEnd?: () => void;
}) {
  const theme = useTheme();
  const bottomInset = useTabBarInset();
  const onScroll = useCollapseOnScroll(onNearEnd);
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

/** A card on the sheet (the web's `rounded-[18px] bg-card p-5 shadow-card`): no border, a hairline + soft shadow. */
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
      style={[cardSurface(theme, Radius.card), { padding: 16 }, style]}>
      {children}
    </Animated.View>
  );
}

/** Section heading inside a card (the web's `font-outfit text-base font-semibold`). */
export function SectionLabel({ children, size = 'xs' }: { children: ReactNode; size?: 'xs' | '10' }) {
  return (
    <Text font="outfit" size={size === '10' ? 'sm' : 'base'} weight="semibold" tracking={-0.2}>
      {children}
    </Text>
  );
}

/** Page title (the web's `page-title`: Outfit, tight tracking). */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <Text font="outfit" size="2xl" weight="semibold" tracking={-0.6}>
      {children}
    </Text>
  );
}

/**
 * THE filter / view switch (web `ui/Segmented`): a soft fill track with a card-coloured thumb that slides to
 * the selected option on a spring. No accent colour, no outline. `sm` is the in-card size.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  stretch,
}: {
  value: T;
  /** An icon-only option passes `label: ''` and names itself with `a11y`. */
  options: { value: T; label: string; icon?: IconType; a11y?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  /** Fill the row, splitting it evenly between options. */
  stretch?: boolean;
}) {
  const theme = useTheme();
  const sm = size === 'sm';
  const [frames, setFrames] = useState<Record<string, { x: number; w: number }>>({});
  const f = frames[value];
  const h = sm ? 26 : 36;
  const r = sm ? 8 : 10;

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.segmented,
        { backgroundColor: theme.fill, padding: sm ? 2 : 3, borderRadius: sm ? 10 : 13 },
        stretch ? { alignSelf: 'stretch' } : null,
      ]}>
      {/* Plain left/width from the measured segment; the layout transition springs it from one option to the next. */}
      {f ? (
        <Animated.View
          pointerEvents="none"
          layout={SEG_LAYOUT}
          style={[styles.thumb, { top: sm ? 2 : 3, height: h, left: f.x, width: f.w }]}>
          <View style={{ flex: 1, borderRadius: r, backgroundColor: theme.cardRaised, ...elevation(theme, 'card') }} />
        </Animated.View>
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y ?? o.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            haptic="select"
            scaleTo={0.96}
            onLayout={(e) => {
              const { x: fx, width } = e.nativeEvent.layout;
              setFrames((prev) =>
                prev[o.value]?.x === fx && prev[o.value]?.w === width ? prev : { ...prev, [o.value]: { x: fx, w: width } },
              );
            }}
            style={[
              styles.segment,
              { height: h, borderRadius: r, paddingHorizontal: o.icon && !o.label ? 0 : sm ? 10 : 14 },
              o.icon && !o.label ? { width: sm ? 28 : 44 } : null,
              stretch ? { flex: 1 } : null,
            ]}>
            {o.icon ? <Icon icon={o.icon} size={sm ? 13 : 15} color={active ? 'fg' : 'muted'} /> : null}
            {o.label ? (
              <Text size={sm ? 'xs' : '13'} weight="semibold" color={active ? 'fg' : 'muted'} numberOfLines={1}>
                {o.label}
              </Text>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const SEG_LAYOUT = LinearTransition.springify().damping(30).stiffness(380).mass(0.8);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', gap: 2 },
  thumb: { position: 'absolute' },
  segment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
