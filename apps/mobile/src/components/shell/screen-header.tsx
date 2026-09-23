import {
  faBell,
  faBoxArchive,
  faBuilding,
  faChevronDown,
  faChevronLeft,
  faGear,
  faRightFromBracket,
  faUsers,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { router, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { useNotifications } from '@/components/shell/notifications';
import { BarSurface } from '@/components/shell/tab-bar/bar-surface';
import { Text } from '@/components/text';
import { Avatar, IconButton } from '@/components/ui';
import { Duration, POP_EASE } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearTokenCache } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';
import { useWorkspace } from '@/lib/workspace';

const HEADER_HEIGHT = 56;
/** Height of the header's floating controls (workspace switcher, bell + avatar pill). */
const CONTROL_H = 44;

/**
 * Header of a tab's root screen: the screen title (or, on Home, the workspace switcher) and a floating pill
 * holding the notifications bell and the account menu. The pills use the bottom bar's surface — Liquid Glass
 * on iOS 26, an opaque elevated surface elsewhere — so the top and bottom chrome read as one set.
 */
export function TabHeader({ title, children }: { title?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { openPanel, unreadCount } = useNotifications();

  return (
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.row}>
        <View style={styles.titleWrap}>
          {title ? (
            <Text font="outfit" size="xl" weight="bold" tracking={-0.4} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {children}
        </View>

        <View style={styles.controlPill}>
          <BarSurface radius={CONTROL_H / 2} />
          <View>
            <IconButton
              icon={faBell}
              label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              onPress={openPanel}
              size={36}
              iconSize={17}
              tone="fg"
              style={styles.round}
            />
            {unreadCount > 0 ? (
              <Animated.View
                entering={ZoomIn.duration(Duration.pop).easing(POP_EASE)}
                pointerEvents="none"
                style={styles.unread}
              />
            ) : null}
          </View>
          <AccountButton />
        </View>
      </View>
    </View>
  );
}

/** Header of a screen pushed on top of the tabs: back chevron, title and an optional subtitle. */
export function StackHeader({
  title,
  subtitle,
  right,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/dashboard')));

  return (
    <View style={{ paddingTop: insets.top }}>
      <View style={[styles.row, styles.stackRow]}>
        <IconButton icon={faChevronLeft} label="Back" onPress={back} size={40} iconSize={18} tone="fg" style={styles.back} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text font="outfit" size="base" weight="semibold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" color="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/**
 * Workspace switcher for the Home header's far left: a floating pill (same surface and height as the bell +
 * avatar pill) with the workspace's initial, name and a chevron; tapping it opens a sheet of your workspaces.
 */
export function WorkspaceSwitcher() {
  const theme = useTheme();
  const { orgs, org, setOrgId } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!org) return null;
  const initial = org.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <View style={styles.switcher}>
        <BarSurface radius={CONTROL_H / 2} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Workspace: ${org.name}. Switch workspace`}
          scaleTo={0.97}
          haptic="select"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.switcherInner, pressed && { backgroundColor: alpha(theme.fg, 0.06) }]}>
          <View style={[styles.switcherMark, { backgroundColor: theme.accent }]}>
            <Text size="xs" weight="bold" color={theme.onAccent}>
              {initial}
            </Text>
          </View>
          <Text font="outfit" size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {org.name}
          </Text>
          <Icon icon={faChevronDown} size={11} color="muted" />
        </PressableScale>
      </View>

      <MenuSheet<string>
        visible={open}
        title="Workspace"
        value={org.id}
        options={orgs.map((o) => ({ value: o.id, label: o.name }))}
        onSelect={(id) => id !== org.id && setOrgId(id)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

type MenuLink = { href: Href; label: string; icon: IconDefinition };

const LINKS: MenuLink[] = [
  { href: '/archived', label: 'Archived', icon: faBoxArchive },
  { href: '/people', label: 'Team', icon: faUsers },
  { href: '/settings', label: 'Your settings', icon: faGear },
  { href: '/organization-settings', label: 'Organization settings', icon: faBuilding },
];

/** Avatar + account menu: the secondary destinations and sign out. */
function AccountButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const { mounted, progress } = usePresence(open, { openMs: Duration.pop, closeMs: Duration.micro });
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const pop = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + 0.04 * progress.value }, { translateY: -4 * (1 - progress.value) }],
  }));

  if (!user) return null;

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  async function signOut() {
    setOpen(false);
    clearTokenCache();
    queryClient.clear();
    await authClient.signOut();
  }

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Account (${user.email})`}
        onPress={() => setOpen(true)}
        scaleTo={0.94}
        style={styles.avatarButton}
        hitSlop={8}>
        <View style={[styles.avatarRing, { borderColor: theme.borderSubtle }]}>
          <Avatar name={user.name} email={user.email} image={user.image} size={26} />
        </View>
        <View style={styles.presence} />
      </PressableScale>

      <Modal visible={mounted} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />
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
              pop,
            ]}>
            <ScrollView bounces={false} style={{ maxHeight: 520 }}>
              <View style={styles.menuHead}>
                <Text size="sm" weight="semibold" numberOfLines={1}>
                  {user.name || user.email}
                </Text>
                <Text font="mono" size="xs" color="muted" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>

              <View style={[styles.section, { borderTopColor: theme.borderSubtle }]}>
                {LINKS.map((l) => (
                  <MenuRow key={l.label} label={l.label} icon={l.icon} onPress={() => go(l.href)} />
                ))}
              </View>

              <View style={[styles.section, { borderTopColor: theme.borderSubtle }]}>
                <MenuRow label="Sign out" icon={faRightFromBracket} onPress={signOut} />
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function MenuRow({
  label,
  icon,
  selected,
  right,
  onPress,
}: {
  label: string;
  icon?: IconDefinition;
  selected?: boolean;
  right?: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: selected ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
      ]}>
      {icon ? <Icon icon={icon} size={14} color="muted" /> : null}
      <Text size="sm" weight={selected ? 'semibold' : undefined} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  stackRow: { paddingHorizontal: 8, gap: 4 },
  back: { marginRight: 2 },
  titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  controlPill: {
    height: CONTROL_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    borderRadius: CONTROL_H / 2,
  },
  round: { borderRadius: 18 },
  avatarButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  switcher: { height: CONTROL_H, maxWidth: 240, borderRadius: CONTROL_H / 2 },
  switcherInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: CONTROL_H / 2,
  },
  switcherMark: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderRadius: 13, borderWidth: 1, overflow: 'hidden' },
  unread: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Tone.red600,
  },
  presence: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Tone.green500,
  },
  menu: {
    position: 'absolute',
    right: 12,
    width: 260,
    borderRadius: Radius.xxxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuHead: { paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  section: { paddingVertical: 4, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
  },
});
