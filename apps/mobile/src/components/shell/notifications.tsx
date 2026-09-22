import { faCircleCheck } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { usePresence } from '@/components/motion/use-presence';
import { Text } from '@/components/text';
import { Duration } from '@/constants/motion';
import { Button, EmptyState, ErrorBanner, Spinner } from '@/components/ui';
import { alpha, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeLedger, formatLogTimestamp } from '@/lib/format';
import { isLedgerEntryNotifiableToUser, isTaskCreatedNote } from '@/lib/notification-eligibility';
import { liveIsland } from '@/lib/live-island';
import { useOrgActivity, type ActivityFeed } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

type NotificationsValue = {
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  /** Notifications newer than the last time the panel was opened. */
  unreadCount: number;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}

const lastSeenKey = (orgId: string) => `logbase.notif.lastSeen.${orgId}`;
const clearedKey = (orgId: string) => `logbase.notif.clearedBefore.${orgId}`;

type ReadState = { orgId: string; lastSeen: number; clearedBefore: number };

const toNumber = (raw: string | null) => (raw && !Number.isNaN(Number(raw)) ? Number(raw) : 0);

/**
 * In-app notifications, derived like the web's `WorkspaceNotificationsProvider`: the workspace activity feed
 * filtered to events on tasks you're assigned to (or assigned), excluding your own actions. Read / cleared
 * state is a pair of timestamps kept per workspace.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { org, userId, members } = useWorkspace();
  const orgId = org?.id;
  const timeZone = org?.timeZone ?? 'UTC';

  // The activity feed refreshes every minute while the app is open (the web relies on a socket for this).
  const feed = useOrgActivity(orgId, !!userId, 60_000);
  const [panelOpen, setPanelOpen] = useState(false);
  const [read, setRead] = useState<ReadState | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    Promise.all([SecureStore.getItemAsync(lastSeenKey(orgId)), SecureStore.getItemAsync(clearedKey(orgId))])
      .then(([seen, cleared]) => live && setRead({ orgId, lastSeen: toNumber(seen), clearedBefore: toNumber(cleared) }))
      .catch(() => live && setRead({ orgId, lastSeen: 0, clearedBefore: 0 }));
    return () => {
      live = false;
    };
  }, [orgId]);

  const loaded = !!read && read.orgId === orgId;
  const lastSeen = loaded ? read.lastSeen : 0;
  const clearedBefore = loaded ? read.clearedBefore : 0;

  const entries = useMemo(() => {
    const data = feed.data;
    if (!data || !userId) return [];
    return data.entries.filter((e) => {
      if (isTaskCreatedNote(e)) return false;
      const assignees = data.assigneesByTaskId?.[e.taskId] ?? [];
      const assignerId = data.tasksById[e.taskId]?.assignerId ?? null;
      return isLedgerEntryNotifiableToUser(e, userId, assignees, assignerId);
    });
  }, [feed.data, userId]);

  const panelEntries = useMemo(
    () => entries.filter((e) => new Date(e.createdAt).getTime() > clearedBefore),
    [entries, clearedBefore],
  );
  // Hold the badge back until the stored timestamps are known, so it doesn't flash a wrong count.
  const unreadCount = loaded ? panelEntries.filter((e) => new Date(e.createdAt).getTime() > lastSeen).length : 0;

  const persist = useCallback(
    (patch: { lastSeen?: number; clearedBefore?: number }) => {
      if (!orgId) return;
      setRead((prev) => ({
        orgId,
        lastSeen: patch.lastSeen ?? (prev?.orgId === orgId ? prev.lastSeen : 0),
        clearedBefore: patch.clearedBefore ?? (prev?.orgId === orgId ? prev.clearedBefore : 0),
      }));
      if (patch.lastSeen !== undefined) SecureStore.setItemAsync(lastSeenKey(orgId), String(patch.lastSeen)).catch(() => {});
      if (patch.clearedBefore !== undefined) {
        SecureStore.setItemAsync(clearedKey(orgId), String(patch.clearedBefore)).catch(() => {});
      }
    },
    [orgId],
  );

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    persist({ lastSeen: Date.now() });
  }, [persist]);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  // Raise a toast for activity that arrives while the app is open (the web's live-island). The first load only
  // records what's already there, so opening the app never toasts old events.
  const knownIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    knownIds.current = null;
  }, [orgId]);
  useEffect(() => {
    if (!feed.isFetched || !userId) return;
    if (knownIds.current === null) {
      knownIds.current = new Set(entries.map((e) => e.id));
      return;
    }
    const seen = knownIds.current;
    const fresh = entries.filter((e) => !seen.has(e.id));
    if (fresh.length === 0) return;
    fresh.forEach((e) => seen.add(e.id));
    if (panelOpen || AppState.currentState !== 'active') return;
    const title = feed.data?.tasksById[fresh[0].taskId]?.title ?? 'Task';
    liveIsland.show({
      title,
      description: "Tap to see what's new.",
      groupKey: 'activity',
      by: fresh.length,
      titleForCount: (count) => (count <= 1 ? title : `New activity on ${count} tasks you follow`),
      actionLabel: 'Open',
      onAction: openPanel,
    });
  }, [entries, feed.isFetched, feed.data, userId, panelOpen, openPanel]);

  const clearAll = () => {
    const newest = panelEntries.reduce((max, e) => Math.max(max, new Date(e.createdAt).getTime()), 0);
    const ts = Math.max(newest, Date.now());
    persist({ lastSeen: ts, clearedBefore: ts });
  };

  const value = useMemo<NotificationsValue>(
    () => ({ panelOpen, openPanel, closePanel, unreadCount }),
    [panelOpen, openPanel, closePanel, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationsPanel
        open={panelOpen}
        onClose={closePanel}
        onClear={clearAll}
        entries={panelEntries}
        feed={feed.data}
        loading={feed.isPending}
        error={feed.error}
        onRetry={() => void feed.refetch()}
        names={new Map(members.map((m) => [m.userId, m.name || m.email]))}
        timeZone={timeZone}
      />
    </NotificationsContext.Provider>
  );
}

function NotificationsPanel({
  open,
  onClose,
  onClear,
  entries,
  feed,
  loading,
  error,
  onRetry,
  names,
  timeZone,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  entries: NonNullable<ActivityFeed>['entries'];
  feed: ActivityFeed | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  names: Map<string, string>;
  timeZone: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { mounted, progress } = usePresence(open, { openMs: Duration.panel, closeMs: Duration.slide });
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - progress.value) * width }] }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdrop]} />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: theme.surfaceElevated, paddingTop: insets.top + 12, paddingBottom: insets.bottom },
          slide,
        ]}>
        <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
          <Text size="sm" weight="semibold" style={{ flex: 1 }}>
            Notifications
          </Text>
          <Button title="Clear all" variant="secondary" compact disabled={entries.length === 0} onPress={onClear} />
          <Button title="Close" variant="secondary" compact onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {loading ? (
            <View style={styles.center}>
              <Spinner />
            </View>
          ) : error ? (
            <ErrorBanner message={error.message || 'Could not load notifications'} onRetry={onRetry} />
          ) : entries.length === 0 ? (
            <EmptyState icon={faCircleCheck} title="You are all caught up" />
          ) : (
            entries.map((e) => (
              <PressableScale
                key={e.id}
                accessibilityRole="button"
                scaleTo={0.985}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/task/[id]', params: { id: e.taskId } });
                }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    borderColor: theme.borderSubtle,
                    backgroundColor: pressed ? theme.surfaceHover : alpha(theme.surfaceMuted, 0.3),
                  },
                ]}>
                <Text size="xs" weight="medium">
                  {feed?.tasksById[e.taskId]?.title ?? 'Task'}
                </Text>
                <Text font="mono" size="xs" color="muted" style={{ marginTop: 4 }}>
                  {formatLogTimestamp(e.createdAt, timeZone)}
                  {' · '}
                  <Text font="mono" size="xs">
                    {names.get(e.actorId) ?? 'Someone'} {describeLedger(e, names, timeZone)}
                  </Text>
                </Text>
              </PressableScale>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  center: { paddingVertical: 32, alignItems: 'center' },
  card: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1 },
});
