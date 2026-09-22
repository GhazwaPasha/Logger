import { faBell } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuGlyph } from '@/components/menu-glyph';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { useNotifications } from '@/components/shell/notifications';
import { useShell } from '@/components/shell/shell-context';
import { Text } from '@/components/text';
import { Avatar, IconButton } from '@/components/ui';
import { Duration, POP_EASE } from '@/constants/motion';
import { Radius, Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearTokenCache } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';

/**
 * Top chrome: menu, notifications bell and the account menu. The bar itself has no fill or
 * border — only its controls are drawn, directly on the page background.
 */
const HEADER_HEIGHT = 44;

export function AppHeader() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { openDrawer } = useShell();
  const { openPanel, unreadCount } = useNotifications();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [menuOpen, setMenuOpen] = useState(false);
  const { mounted: menuMounted, progress: menuProgress } = usePresence(menuOpen, { openMs: Duration.pop, closeMs: Duration.micro });
  const menuBackdrop = useAnimatedStyle(() => ({ opacity: menuProgress.value }));
  const menuPop = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: [{ scale: 0.96 + 0.04 * menuProgress.value }, { translateY: -4 * (1 - menuProgress.value) }],
  }));

  async function signOut() {
    setMenuOpen(false);
    clearTokenCache();
    queryClient.clear();
    await authClient.signOut();
  }

  return (
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.row}>
        <View style={styles.side}>
          {/* The 36px touch target is pulled into the gutter so the glyph's left edge lines up with the page content. */}
          <IconButton label="Open navigation" onPress={openDrawer} size={36} style={styles.menuButton}>
            <MenuGlyph color={theme.muted} />
          </IconButton>
        </View>

        <View style={[styles.side, { justifyContent: 'flex-end', gap: 2 }]}>
          <View>
            <IconButton
              icon={faBell}
              label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              onPress={openPanel}
              size={36}
              iconSize={18}
            />
            {unreadCount > 0 ? (
              <Animated.View
                entering={ZoomIn.duration(Duration.pop).easing(POP_EASE)}
                pointerEvents="none"
                style={[styles.unread, { borderColor: theme.surfaceBase }]}
              />
            ) : null}
          </View>
          {user ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Account (${user.email})`}
              onPress={() => setMenuOpen(true)}
              scaleTo={0.94}
              style={styles.avatarButton}
              hitSlop={8}>
              <View style={[styles.avatarRing, { borderColor: theme.borderSubtle }]}>
                <Avatar name={user.name} email={user.email} image={user.image} size={20} />
              </View>
              <View style={[styles.presence, { borderColor: theme.surfaceBase }]} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <Modal visible={menuMounted} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, menuBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
        </Animated.View>
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.menu,
              {
                top: insets.top + HEADER_HEIGHT - 4,
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.borderSubtle,
                transformOrigin: 'right top',
              },
              menuPop,
            ]}>
            {user?.email ? (
              <Text font="mono" size="xs" color="muted" numberOfLines={1} style={styles.menuEmail}>
                {user.email}
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.surfaceHover }]}
              onPress={() => {
                setMenuOpen(false);
                router.navigate('/settings');
              }}>
              <Text size="sm">Your settings</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.surfaceHover }]}
              onPress={signOut}>
              <Text size="sm">Sign out</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // The glyph is 18px wide, centred in a 36px target: (36 - 18) / 2 = 9px of inset to cancel.
  menuButton: { marginLeft: -9 },
  avatarButton: { marginLeft: 6 },
  avatarRing: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  unread: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: Tone.red600,
  },
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: Tone.green500,
  },
  menu: {
    position: 'absolute',
    right: 12,
    minWidth: 192,
    maxWidth: 260,
    paddingVertical: 4,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuEmail: { paddingHorizontal: 12, paddingVertical: 8 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10 },
});
