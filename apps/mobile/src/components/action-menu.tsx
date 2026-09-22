import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Text } from '@/components/text';
import { stateTransition } from '@/constants/motion';
import { Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';

export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: IconDefinition;
  /** Styled in red, for a destructive action like delete. */
  destructive?: boolean;
  onSelect: () => void;
};

/**
 * A bottom-sheet action menu — the touch counterpart of the web's right-click `SimpleContextMenu`.
 * Open it from a long-press instead of a click. Same `MenuSheet` shell (spring-up sheet over a
 * fading backdrop), but each item fires its own independent action instead of picking one value
 * from a set.
 */
export function ActionMenu({
  visible,
  title,
  items,
  onClose,
}: {
  visible: boolean;
  title?: string;
  items: ActionMenuItem[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
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
      <Animated.View pointerEvents="box-none" style={[styles.anchor, sheet]}>
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
          {items.map((item) => {
            const tint = item.destructive ? (dark ? Tone.red400 : Tone.red600) : undefined;
            return (
              <PressableScale
                key={item.id}
                accessibilityRole="menuitem"
                scaleTo={0.985}
                haptic="select"
                onPress={() => {
                  onClose();
                  // Let the sheet's own close/dismiss state settle before the action runs — mirrors
                  // the web's SimpleContextMenu, which queues onSelect the same way.
                  queueMicrotask(() => item.onSelect());
                }}
                style={({ pressed }) => [
                  styles.option,
                  { backgroundColor: pressed ? theme.surfaceHover : 'transparent' },
                  stateTransition,
                ]}>
                {item.icon ? <Icon icon={item.icon} size={16} color={tint ?? 'muted'} /> : null}
                <Text size="sm" weight="semibold" tracking={-0.1} color={tint ?? 'fg'}>
                  {item.label}
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
