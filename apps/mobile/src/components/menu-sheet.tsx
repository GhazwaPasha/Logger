import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Text } from '@/components/text';
import { stateTransition } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MenuOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: IconDefinition;
  iconColor?: string;
};

/**
 * Bottom sheet menu — the touch counterpart of the web's `SelectPopover` / `StatusPillSelect` dropdowns
 * (same bordered `surface-elevated` panel and row styling). The sheet springs up over a fading backdrop
 * and eases back down when dismissed.
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
      <Animated.View
        pointerEvents="box-none"
        style={[styles.anchor, sheet]}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.borderSubtle,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          {title ? (
            <Text size="11" weight="semibold" color="muted" uppercase tracking={0.8} style={styles.title}>
              {title}
            </Text>
          ) : null}
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <PressableScale
                key={o.value}
                accessibilityRole="menuitem"
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
                <Text size="sm" weight="semibold" tracking={-0.1}>
                  {o.label}
                </Text>
              </PressableScale>
            );
          })}
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    padding: 8,
    borderTopLeftRadius: Radius.xxxl,
    borderTopRightRadius: Radius.xxxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    gap: 2,
  },
  title: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.lg },
});
