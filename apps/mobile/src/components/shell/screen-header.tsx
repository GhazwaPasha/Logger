import {
  faBell,
  faBoxArchive,
  faBuilding,
  faCheck,
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
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { useNotifications } from '@/components/shell/notifications';
import { Text } from '@/components/text';
import { Avatar, IconButton } from '@/components/ui';
import { Duration, POP_EASE } from '@/constants/motion';
import { Radius, Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearTokenCache } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { queryClient } from '@/lib/query-client';
import { useWorkspace } from '@/lib/workspace';

const HEADER_HEIGHT = 52;

/**
 * Header of a tab's root screen: the screen title, the notifications bell and the account menu. The bar has
 * no fill or border — only its controls are drawn, directly on the page background.
 */
export function TabHeader({ title, children }: { title?: string; children?: ReactNode }) {
  const theme = useTheme();
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

        <View style={styles.actions}>
          <View>
            <IconButton
              icon={faBell}
              label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              onPress={openPanel}
              size={40}
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

type MenuLink = { href: Href; label: string; icon: IconDefinition };

const LINKS: MenuLink[] = [
  { href: '/archived', label: 'Archived', icon: faBoxArchive },
  { href: '/people', label: 'Team', icon: faUsers },
  { href: '/settings', label: 'Your settings', icon: faGear },
  { href: '/organization-settings', label: 'Organization settings', icon: faBuilding },
];

/** Avatar + account menu: workspace switcher, the secondary destinations, and sign out. */
function AccountButton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();
  const { orgs, org, setOrgId } = useWorkspace();
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
          <Avatar name={user.name} email={user.email} image={user.image} size={24} />
        </View>
        <View style={[styles.presence, { borderColor: theme.surfaceBase }]} />
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

              {orgs.length > 0 ? (
                <View style={[styles.section, { borderTopColor: theme.borderSubtle }]}>
                  <Text size="10" weight="semibold" color="muted" uppercase tracking={0.6} style={styles.sectionLabel}>
                    Workspace
                  </Text>
                  {orgs.map((o) => {
                    const active = o.id === org?.id;
                    return (
                      <MenuRow
                        key={o.id}
                        label={o.name}
                        selected={active}
                        right={active ? <Icon icon={faCheck} size={13} color="fg" /> : null}
                        onPress={() => {
                          setOpen(false);
                          if (!active) setOrgId(o.id);
                        }}
                      />
                    );
                  })}
                </View>
              ) : null}

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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -6 },
  avatarButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderRadius: 13, borderWidth: 1, overflow: 'hidden' },
  unread: {
    position: 'absolute',
    right: 7,
    top: 7,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: Tone.red600,
  },
  presence: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
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
  sectionLabel: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
  },
});
