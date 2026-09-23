import { faClockRotateLeft, faHashtag, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PageEnter } from '@/components/page';
import { useCollapseOnScroll, useTabBar, useTabBarInset } from '@/components/shell/tab-bar/tab-bar-context';
import { Text } from '@/components/text';
import { Avatar, EmptyState, ErrorBanner } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDueForListPill } from '@/lib/format';
import { statusLabelOf } from '@/lib/labels';
import { useSearchTasks } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

const RECENT_KEY = 'logbase.recentSearches';
const RECENT_MAX = 8;
const DEBOUNCE_MS = 300;

function useDebounced(value: string, ms: number) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

/**
 * Search results. The query is typed in the bottom bar (which turns into a search field on this tab); tasks
 * come from the API's title search, channels and people are matched on the device.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const onScroll = useCollapseOnScroll();
  const { searchQuery, setSearchQuery } = useTabBar();
  const { org, lists, depts, members } = useWorkspace();
  const timeZone = org?.timeZone ?? 'UTC';

  const query = useDebounced(searchQuery, DEBOUNCE_MS).trim();
  const needle = query.toLowerCase();
  const tasks = useSearchTasks(org?.id, query);

  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    SecureStore.getItemAsync(RECENT_KEY)
      .then((raw) => setRecent(raw ? (JSON.parse(raw) as string[]) : []))
      .catch(() => {});
  }, []);
  const remember = () => {
    if (query.length < 2) return;
    const next = [query, ...recent.filter((r) => r.toLowerCase() !== needle)].slice(0, RECENT_MAX);
    setRecent(next);
    SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const channelHits = needle
    ? lists.filter((l) => l.name.toLowerCase().includes(needle)).slice(0, 6)
    : [];
  const peopleHits = needle
    ? members
        .filter((m) => (m.name ?? '').toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle))
        .slice(0, 6)
    : [];
  const taskHits = query.length >= 2 ? (tasks.data ?? []) : [];
  const searching = query.length >= 2 && tasks.isFetching;
  const nothing = needle && !searching && taskHits.length === 0 && channelHits.length === 0 && peopleHits.length === 0;

  const channelLabel = (listId: string) => {
    const l = listById.get(listId);
    return l ? `# ${l.name}${deptName.get(l.departmentId) ? ` · ${deptName.get(l.departmentId)}` : ''}` : '';
  };

  return (
    <View style={[styles.fill, { backgroundColor: theme.surfaceBase, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text font="outfit" size="xl" weight="bold" tracking={-0.4}>
          Search
        </Text>
        {searching ? <ActivityIndicator size="small" color={theme.muted} /> : null}
      </View>

      <PageEnter>
        <Animated.ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + bottomInset }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onScroll}
          scrollEventThrottle={16}>
          {!needle ? (
            recent.length > 0 ? (
              <Section title="Recent">
                {recent.map((r, i) => (
                  <Row key={r} first={i === 0} onPress={() => setSearchQuery(r)} icon={<Icon icon={faClockRotateLeft} size={14} color="muted" />}>
                    <Text size="sm" numberOfLines={1}>
                      {r}
                    </Text>
                  </Row>
                ))}
              </Section>
            ) : (
              <EmptyState icon={faMagnifyingGlass} title="Search your workspace" description="Find tasks, channels and people." />
            )
          ) : null}

          {tasks.error ? <ErrorBanner message={tasks.error.message} onRetry={() => void tasks.refetch()} /> : null}

          {taskHits.length > 0 ? (
            <Section title="Tasks">
              {taskHits.map((t, i) => (
                <Row
                  key={t.id}
                  first={i === 0}
                  onPress={() => {
                    remember();
                    router.push({ pathname: '/task/[id]', params: { id: t.id } });
                  }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" weight="medium" numberOfLines={2}>
                      {t.title}
                    </Text>
                    <Text size="xs" color="muted" numberOfLines={1}>
                      {[statusLabelOf(t.status), t.dueAt ? formatDueForListPill(t.dueAt, timeZone) : null, channelLabel(t.listId)]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                  </View>
                </Row>
              ))}
            </Section>
          ) : null}

          {channelHits.length > 0 ? (
            <Section title="Channels">
              {channelHits.map((l, i) => (
                <Row
                  key={l.id}
                  first={i === 0}
                  icon={<Icon icon={faHashtag} size={14} color="muted" />}
                  onPress={() => {
                    remember();
                    router.navigate({ pathname: '/channels/[listId]', params: { listId: l.id } });
                  }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {l.name}
                    </Text>
                    {deptName.get(l.departmentId) ? (
                      <Text size="xs" color="muted" numberOfLines={1}>
                        {deptName.get(l.departmentId)}
                      </Text>
                    ) : null}
                  </View>
                </Row>
              ))}
            </Section>
          ) : null}

          {peopleHits.length > 0 ? (
            <Section title="People">
              {peopleHits.map((m, i) => (
                <Row
                  key={m.userId}
                  first={i === 0}
                  icon={<Avatar name={m.name} email={m.email} image={m.image} size={28} />}
                  onPress={() => {
                    remember();
                    router.push({ pathname: '/person/[userId]', params: { userId: m.userId } });
                  }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" weight="medium" numberOfLines={1}>
                      {m.name || m.email}
                    </Text>
                    <Text size="xs" color="muted" numberOfLines={1}>
                      {m.email}
                    </Text>
                  </View>
                </Row>
              ))}
            </Section>
          ) : null}

          {nothing ? <EmptyState icon={faMagnifyingGlass} title={`No results for “${query}”`} /> : null}
          {needle && query.length < 2 && channelHits.length === 0 && peopleHits.length === 0 ? (
            <Text size="xs" color="muted" style={{ textAlign: 'center' }}>
              Type at least 2 characters to search tasks.
            </Text>
          ) : null}
        </Animated.ScrollView>
      </PageEnter>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="xs" weight="semibold" color="muted" uppercase tracking={0.6} style={{ paddingHorizontal: 4 }}>
        {title}
      </Text>
      <View style={[styles.group, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>{children}</View>
    </View>
  );
}

function Row({
  children,
  icon,
  first,
  onPress,
}: {
  children: ReactNode;
  icon?: ReactNode;
  first?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: theme.borderSubtle },
        pressed && { backgroundColor: theme.surfaceHover },
      ]}>
      {icon}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 18 },
  group: { borderRadius: Radius.xxxl + 4, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, paddingVertical: 10 },
});
