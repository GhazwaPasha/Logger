import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { Text } from '@/components/text';
import { fadeOut, islandIn } from '@/constants/motion';
import { Radius, Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { liveIsland } from '@/lib/live-island';

/** The floating toast that drops in from the top when something happens (new activity, errors). */
export function LiveIsland() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const island = useSyncExternalStore(liveIsland.subscribe, liveIsland.getSnapshot);

  if (!island) return null;

  return (
    <Animated.View
      // Merged updates keep the same id, so the toast updates in place instead of re-entering.
      key={island.id}
      entering={islandIn}
      exiting={fadeOut}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 4 }]}>
      <View
        accessibilityRole="alert"
        style={[styles.pill, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <Pulse>
          <View style={styles.dot} />
        </Pulse>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" weight="semibold" numberOfLines={1}>
            {island.title}
          </Text>
          {island.description ? (
            <Text size="11" color="muted" numberOfLines={1}>
              {island.description}
            </Text>
          ) : null}
        </View>
        {island.actionLabel ? (
          <PressableScale
            accessibilityRole="button"
            scaleTo={0.94}
            onPress={() => {
              island.onAction?.();
              liveIsland.dismiss();
            }}
            style={[styles.action, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text size="xs" weight="medium">
              {island.actionLabel}
            </Text>
          </PressableScale>
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          scaleTo={0.9}
          onPress={() => liveIsland.dismiss()}
          style={styles.dismiss}>
          <Icon icon={faXmark} size={12} color="muted" />
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 60, alignItems: 'center' },
  pill: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: Radius.xxxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Tone.green500 },
  action: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1 },
  dismiss: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});
