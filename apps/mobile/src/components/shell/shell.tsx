import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppHeader } from '@/components/shell/app-header';
import { LiveIsland } from '@/components/shell/live-island';
import { ShellContext } from '@/components/shell/shell-context';
import { Sidebar } from '@/components/shell/sidebar';
import { useTheme } from '@/hooks/use-theme';

const DRAWER_WIDTH = 288; // `w-72` on the web

/** Header + slide-in sidebar around the routed screen — the web's `WorkspaceShell` at phone width. */
export function Shell({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [open, progress]);

  // Android back closes the drawer first.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openDrawer, closeDrawer, drawerOpen: open }), [openDrawer, closeDrawer, open]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  const drawer = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * DRAWER_WIDTH }] }));

  return (
    <ShellContext.Provider value={value}>
      <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>
        <AppHeader />
        <View style={styles.fill}>{children}</View>

        <LiveIsland />

        <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, scrim]}>
          <Pressable
            accessibilityLabel="Close navigation"
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
            onPress={closeDrawer}
          />
        </Animated.View>
        <Animated.View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            styles.drawer,
            { backgroundColor: theme.surfaceNav, borderRightColor: theme.borderSubtle },
            drawer,
          ]}>
          <Sidebar />
        </Animated.View>
      </View>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
  },
});
