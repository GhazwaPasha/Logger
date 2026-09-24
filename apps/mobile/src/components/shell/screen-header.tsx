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
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { useNotifications } from '@/components/shell/notifications';
import { useOnlineTeammates } from '@/components/shell/online-presence';
import { BarSurface } from '@/components/shell/tab-bar/bar-surface';
import { Text } from '@/components/text';
import { Avatar, IconButton } from '@/components/ui';
import { Pulse } from '@/components/motion/pulse';
import { chipEnter, Duration, POP_EASE } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { signOut } from '@/lib/sign-out';
import { useWorkspace } from '@/lib/workspace';

const HEADER_HEIGHT = 56;
/** Height of the header's floating controls (workspace switcher, bell + avatar pill). */
const CONTROL_H = 44;
/**
 * The round items inside those controls — workspace mark, bell and profile avatar — are all this size, and sit
 * the same inset from every edge of their pill, so everything lines up across the header.
 */
const ITEM = 32;
const INSET = (CONTROL_H - ITEM) / 2;

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

        {/* The pill's width follows the online stack: `layout` springs it wider / narrower as people come and go. */}
        <Animated.View entering={chipEnter(1)} layout={PILL_LAYOUT} style={styles.controlPill}>
          <BarSurface radius={CONTROL_H / 2} />
          <OnlineStack />
          <View style={styles.bell}>
            {/* Its own glass capsule, like the pill it sits in. */}
            <BarSurface radius={ITEM / 2} nested />
            <IconButton
              icon={faBell}
              label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
              onPress={openPanel}
              size={ITEM}
              iconSize={15}
              tone="fg"
              style={styles.bellButton}
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
        </Animated.View>
      </View>
    </View>
  );
}

/** Teammates shown as avatars before the rest fold into a "+N" chip. */
const MAX_ONLINE_SHOWN = 3;
const STACK_AVATAR = 26;
const STACK_OVERLAP = 9;
const PILL_LAYOUT = LinearTransition.springify().damping(20).stiffness(220);

/**
 * Who else is online right now: up to three overlapping avatars, then "+N". Each avatar pops in / out as people
 * come and go, and the pill around it resizes with them. Hidden entirely when nobody else is online.
 */
function OnlineStack() {
  const theme = useTheme();
  const online = useOnlineTeammates();
  if (online.length === 0) return null;
  const shown = online.slice(0, MAX_ONLINE_SHOWN);
  const more = online.length - shown.length;
  const names = online.map((m) => m.name || m.email).join(', ');

  return (
    <Animated.View
      layout={PILL_LAYOUT}
      style={styles.stack}
      accessible
      accessibilityLabel={`${online.length} online: ${names}`}>
      {shown.map((m, i) => (
        <Animated.View
          key={m.userId}
          entering={ZoomIn.duration(Duration.pop).easing(POP_EASE)}
          exiting={ZoomOut.duration(Duration.micro)}
          layout={PILL_LAYOUT}
          style={[styles.stackItem, { marginLeft: i === 0 ? 0 : -STACK_OVERLAP, borderColor: theme.surfaceElevated }]}>
          <Avatar name={m.name} email={m.email} image={m.image} size={STACK_AVATAR} />
        </Animated.View>
      ))}
      {more > 0 ? (
        <Animated.View
          key="more"
          entering={ZoomIn.duration(Duration.pop).easing(POP_EASE)}
          exiting={ZoomOut.duration(Duration.micro)}
          layout={PILL_LAYOUT}
          style={[
            styles.stackItem,
            styles.stackMore,
            { marginLeft: -STACK_OVERLAP, borderColor: theme.surfaceElevated, backgroundColor: theme.accent },
          ]}>
          <Text size="10" weight="bold" color={theme.onAccent} tabular>
            {`+${more}`}
          </Text>
        </Animated.View>
      ) : null}
    </Animated.View>
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

  // The chip is there from the first frame (sliding in like the bell + avatar pill) with a placeholder inside;
  // the workspace fades in and the pill springs to its width once it resolves, so nothing pops in late.
  if (!org) {
    return (
      <Animated.View entering={chipEnter(-1)} layout={PILL_LAYOUT} style={styles.switcher}>
        <BarSurface radius={CONTROL_H / 2} />
        <View style={styles.switcherInner}>
          <Pulse style={[styles.switcherMark, { backgroundColor: alpha(theme.fg, 0.1) }]} />
          <Pulse style={{ width: 84, height: 10, borderRadius: 5, backgroundColor: alpha(theme.fg, 0.1) }} />
        </View>
      </Animated.View>
    );
  }
  const initial = org.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <Animated.View entering={chipEnter(-1)} layout={PILL_LAYOUT} style={styles.switcher}>
        <BarSurface radius={CONTROL_H / 2} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Workspace: ${org.name}. Switch workspace`}
          scaleTo={0.97}
          haptic="select"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.switcherInner, pressed && { backgroundColor: alpha(theme.fg, 0.06) }]}>
          <Animated.View entering={FadeIn.duration(Duration.base)} style={styles.switcherContent}>
            <View style={[styles.switcherMark, { backgroundColor: theme.accent }]}>
              <Text size="xs" weight="bold" color={theme.onAccent}>
                {initial}
              </Text>
            </View>
            <Text font="outfit" size="sm" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {org.name}
            </Text>
            <Icon icon={faChevronDown} size={11} color="muted" />
          </Animated.View>
        </PressableScale>
      </Animated.View>

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
  const dark = useIsDark();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  // Bottom sheet: springs up over a fading scrim, eases back down (same feel as the app's other sheets).
  const { mounted, progress } = usePresence(open, { spring: true });
  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, progress.value)) }));
  const sheet = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { transform: [{ translateY: (1 - p) * height * 0.6 }] };
  });

  if (!user) {
    // Hold the avatar's slot so the pill keeps its width while the session loads.
    return <Pulse style={[styles.avatarButton, { borderRadius: ITEM / 2, backgroundColor: alpha(theme.fg, 0.1) }]} />;
  }

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  async function onSignOut() {
    setOpen(false);
    await signOut();
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
        <Animated.View entering={FadeIn.duration(Duration.base)}>
          <Avatar name={user.name} email={user.email} image={user.image} size={ITEM} />
        </Animated.View>
        <View pointerEvents="none" style={[styles.avatarRing, { borderColor: alpha(theme.fg, 0.12) }]} />
        <View style={styles.presence} />
      </PressableScale>

      <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />
        </Animated.View>
        <View pointerEvents="box-none" style={styles.sheetAnchor}>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle, paddingBottom: insets.bottom + 12 },
              sheet,
            ]}>
            <View style={[styles.handle, { backgroundColor: alpha(theme.fg, 0.18) }]} />

            <View style={styles.sheetProfile}>
              <Avatar name={user.name} email={user.email} image={user.image} size={48} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text font="outfit" size="base" weight="semibold" numberOfLines={1}>
                  {user.name || user.email}
                </Text>
                <Text size="xs" color="muted" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>

            <View style={[styles.sheetGroup, { backgroundColor: alpha(theme.fg, dark ? 0.04 : 0.03) }]}>
              {LINKS.map((l) => (
                <MenuRow key={l.label} label={l.label} icon={l.icon} onPress={() => go(l.href)} />
              ))}
            </View>

            <View style={[styles.sheetGroup, { backgroundColor: alpha(theme.fg, dark ? 0.04 : 0.03) }]}>
              <MenuRow label="Sign out" icon={faRightFromBracket} destructive onPress={onSignOut} />
            </View>
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
  destructive,
  onPress,
}: {
  label: string;
  icon?: IconDefinition;
  selected?: boolean;
  right?: ReactNode;
  /** Red, for sign out. */
  destructive?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const tint = destructive ? (dark ? Tone.red400 : Tone.red600) : undefined;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: selected ? theme.accentMuted : pressed ? theme.surfaceHover : 'transparent' },
      ]}>
      {icon ? <Icon icon={icon} size={15} color={tint ?? 'muted'} /> : null}
      <Text size="15" weight={selected ? 'semibold' : 'medium'} color={tint ?? 'fg'} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same 12dp gutter as the page content, so the header pills and the cards below share one edge.
  row: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  stackRow: { paddingHorizontal: 8, gap: 4 },
  back: { marginRight: 2 },
  titleWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  // A two-item pill in the Apple style: roomier left/right than top/bottom, with the items spaced apart.
  controlPill: {
    height: CONTROL_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: INSET + 6,
    borderRadius: CONTROL_H / 2,
  },
  // Same capsule as the dashboard's Overview / Activity log items (52 × 32), so the header chips match.
  bell: { width: 52, height: ITEM, borderRadius: ITEM / 2 },
  stack: { flexDirection: 'row', alignItems: 'center', marginRight: -4 },
  // A 2dp ring in the pill's colour separates overlapping avatars.
  stackItem: { borderRadius: 999, borderWidth: 2 },
  stackMore: {
    width: STACK_AVATAR + 4,
    height: STACK_AVATAR + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellButton: { width: 52, borderRadius: ITEM / 2, backgroundColor: 'transparent' },
  avatarButton: { width: ITEM, height: ITEM },
  switcher: { height: CONTROL_H, maxWidth: 240, borderRadius: CONTROL_H / 2 },
  switcherContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  switcherInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: INSET,
    paddingRight: 14,
    borderRadius: CONTROL_H / 2,
  },
  // Same size as the profile avatar in the bell + avatar pill.
  switcherMark: { width: ITEM, height: ITEM, borderRadius: ITEM / 2, alignItems: 'center', justifyContent: 'center' },
  avatarRing: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: ITEM / 2, borderWidth: StyleSheet.hairlineWidth * 2 },
  // Sits by the bell glyph's upper-right shoulder.
  unread: {
    position: 'absolute',
    right: 15,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Tone.red600,
  },
  // Sits on the avatar's lower-right edge.
  presence: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Tone.green500,
  },
  sheetAnchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  sheetProfile: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, paddingVertical: 6 },
  sheetGroup: { borderRadius: 20, padding: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.xxxl,
  },
});
