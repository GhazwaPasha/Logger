import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Text } from '@/components/text';
import { stateTransition } from '@/constants/motion';
import { alpha, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MenuOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconDefinition;
  iconColor?: string;
};

/** Longer lists than this get a search field at the top. */
const SEARCH_FROM = 9;
/** The sheet never grows past this share of the screen; longer lists scroll inside it. */
const MAX_HEIGHT_SHARE = 0.6;

/**
 * Bottom sheet menu — the touch counterpart of the web's `SelectPopover` / `StatusPillSelect` dropdowns. Springs
 * up over a fading backdrop; the list is capped at ~60% of the screen and scrolls, with a search field for long
 * lists (e.g. Discord channels). The current choice is ticked.
 */
export function MenuSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: MenuOption<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mounted, progress } = usePresence(visible, { spring: true });
  const [query, setQuery] = useState('');

  // A fresh search every time the sheet opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) setQuery('');
  }, [visible]);

  const searchable = options.length >= SEARCH_FROM;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { opacity: p, transform: [{ translateY: (1 - p) * height * 0.4 }] };
  });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[styles.anchor, sheet]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderSubtle,
              paddingBottom: Math.max(insets.bottom, 12),
              maxHeight: height * MAX_HEIGHT_SHARE,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: alpha(theme.fg, 0.18) }]} />
          {title ? (
            <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={styles.title}>
              {title}
            </Text>
          ) : null}
          {searchable ? (
            <View style={[styles.search, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSubtle }]}>
              <Icon icon={faMagnifyingGlass} size={12} color="muted" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search…"
                placeholderTextColor={theme.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.searchInput, { color: theme.fg }]}
              />
            </View>
          ) : null}
          <ScrollView
            style={styles.list}
            contentContainerStyle={{ gap: 2 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}>
            {shown.map((o) => {
              const selected = o.value === value;
              return (
                <PressableScale
                  key={o.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  scaleTo={0.985}
                  haptic="select"
                  onPress={() => {
                    onSelect(o.value);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: selected ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
                    stateTransition,
                  ]}>
                  {o.icon ? <Icon icon={o.icon} size={16} color={o.iconColor ?? 'muted'} /> : null}
                  <Text size="sm" weight="semibold" tracking={-0.1} numberOfLines={1} style={{ flex: 1 }}>
                    {o.label}
                  </Text>
                  {selected ? <Icon icon={faCheck} size={13} color="fg" /> : null}
                </PressableScale>
              );
            })}
            {shown.length === 0 ? (
              <Text size="sm" color="muted" style={styles.empty}>
                No matches.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopLeftRadius: Radius.xxxl,
    borderTopRightRadius: Radius.xxxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 6,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 2 },
  title: { paddingHorizontal: 8, paddingTop: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    marginHorizontal: 4,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  // Shrinks to fit a short menu; scrolls once the sheet hits its height cap.
  list: { flexGrow: 0, flexShrink: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.lg },
  empty: { paddingHorizontal: 12, paddingVertical: 12 },
});
