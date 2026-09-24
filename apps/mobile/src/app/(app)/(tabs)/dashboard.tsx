import { faChartPie, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ActivityTerminal } from '@/components/activity/activity-terminal';
import { HBarChart } from '@/components/dashboard/hbar-chart';
import { StatusPriorityRing } from '@/components/dashboard/status-priority-ring';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Pulse } from '@/components/motion/pulse';
import { Page, SectionLabel } from '@/components/page';
import { BarSurface } from '@/components/shell/tab-bar/bar-surface';
import { Icon } from '@/components/icon';
import { TabHeader, WorkspaceSwitcher } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { ErrorBanner } from '@/components/ui';
import { sequenceEnter, stateTransition } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { NODE_LABELS } from '@/lib/labels';
import { useActiveTasks, useBoardCounts, useOrgActivity, useSeriesSummaries, type BoardFilter, type SeriesSummaryRow } from '@/lib/queries';
import { FLOW_COLUMN_LABELS, PRIORITY_LABELS, taskIsOverdue, taskPriority, TASK_FLOW_ORDER, type TaskPriority } from '@/lib/task-board';
import { authClient } from '@/lib/auth-client';
import { useWorkspace } from '@/lib/workspace';

type View_ = 'overview' | 'activity';

/** KPI card pastel tones (light theme only — dark keeps the plain elevated surface, like the web). */
const KPI_TONES = {
  blue: { bg: '#e9eefc', border: 'rgba(95, 115, 175, 0.14)', back: '#c4d4ef', front: '#aabfe6' },
  peach: { bg: '#fff1e6', border: 'rgba(195, 125, 65, 0.16)', back: '#ffd8b8', front: '#ffc49a' },
  rose: { bg: '#fdecef', border: 'rgba(190, 70, 95, 0.16)', back: '#f8cdd6', front: '#f3b3c0' },
  amber: { bg: '#fdf5e1', border: 'rgba(180, 130, 30, 0.16)', back: '#f6e3b0', front: '#efd28c' },
} as const;
type KpiTone = keyof typeof KPI_TONES;

/** Ring chunk colours: the web chart's hues at full strength, so the meter reads at a glance. */
const STATUS_COLOR = {
  pending: Tone.slate400,
  in_progress: Tone.violet500,
  done: Tone.emerald500,
  cancelled: Tone.neutral500,
} as const;
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: '#f43f5e',
  medium: Tone.amber500,
  low: '#94a3b8',
};
const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low'];

// Stable query inputs (they are part of the query keys).
const WHOLE_WORKSPACE: BoardFilter = {};
const DONE_ONLY = ['done'] as const;
const CANCELLED_ONLY = ['cancelled'] as const;

/**
 * Every repeat of a recurring task is its own task row, so the raw done / cancelled totals count a daily task
 * once per day. Count each recurring chain once instead — the same way the board collapses a chain into a
 * single card: drop the chain's occurrences and add one per chain.
 */
const countChainsOnce = (total: number, chains: SeriesSummaryRow[]) =>
  Math.max(0, total - chains.reduce((n, c) => n + c.count, 0) + chains.length);

function KpiCard({
  tone,
  index,
  children,
  onPress,
}: {
  tone: KpiTone;
  /** Position in the grid, for the staggered entrance. */
  index: number;
  children: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const dark = useIsDark();
  const t = KPI_TONES[tone];
  return (
    // The entrance keyframe and the press-scale transform can't share one node (Reanimated warns about
    // "transform" being fought over), so the flex sizing + entrance live on this outer wrapper and the
    // press animation stays on the inner Pressable.
    <Animated.View entering={sequenceEnter(index)} style={styles.kpiOuter}>
      <PressableScale
        disabled={!onPress}
        onPress={onPress}
        scaleTo={0.98}
        style={[
          styles.kpi,
          dark
            ? { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }
            : { backgroundColor: t.bg, borderColor: t.border },
        ]}>
        {!dark ? (
          <View style={styles.wave} pointerEvents="none">
            <Svg width="112%" height={76} viewBox="0 0 400 72" preserveAspectRatio="none" style={{ marginLeft: '-6%' }}>
              <Path fill={t.back} d="M0 40 C48 24 96 48 152 34 C208 20 256 44 304 32 C336 24 368 36 400 38 L400 72 L0 72 Z" />
              <Path fill={t.front} d="M0 52 C60 42 110 62 170 50 C230 38 290 58 350 47 C375 42 390 46 400 48 L400 72 L0 72 Z" />
            </Svg>
          </View>
        ) : null}
        <View style={{ zIndex: 1 }}>{children}</View>
      </PressableScale>
    </Animated.View>
  );
}

function KpiLabel({ children }: { children: ReactNode }) {
  return (
    <Text size="11" weight="medium" color="muted" uppercase tracking={0.5}>
      {children}
    </Text>
  );
}
const KpiValue = ({ children, color, loading }: { children: ReactNode; color?: string; loading?: boolean }) =>
  loading ? (
    <Pulse style={{ width: 44, height: 32, borderRadius: 8, marginTop: 6, marginBottom: 2, backgroundColor: 'rgba(120,120,120,0.18)' }} />
  ) : (
  <Text size="3xl" lh={36} weight="semibold" tabular tracking={-0.6} color={color ?? 'fg'} style={{ fontSize: 36, marginTop: 2 }}>
    {children}
  </Text>
  );

/** How often the greeting's fact line rotates. */
const FACT_MS = 9000;

function partOfDay(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Home greeting: "Good afternoon, Ghazwa", with a line underneath that
 * rotates through what's worth knowing right now — overdue, in progress, unassigned… — sliding each fact up.
 */
function Greeting({ facts, loading }: { facts: (string | null)[]; loading: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const theme = useTheme();
  const first = session?.user.name?.trim().split(/\s+/)[0] || 'there';
  const lines = facts.filter((f): f is string => !!f);
  const shown = loading ? ['Catching up on your workspace…'] : lines.length ? lines : ['All caught up — nice work'];
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (shown.length < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), FACT_MS);
    return () => clearInterval(t);
  }, [shown.length]);

  const fact = shown[tick % shown.length];
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      {isPending && !session ? (
        <Pulse style={{ width: 150, height: 16, borderRadius: 5, marginVertical: 4, backgroundColor: alpha(theme.fg, 0.1) }} />
      ) : (
        <Animated.View entering={FadeIn.duration(220)}>
          <Text font="outfit" size="lg" weight="bold" tracking={-0.3} lh={24} numberOfLines={1}>
            {`${partOfDay()}, ${first}`}
          </Text>
        </Animated.View>
      )}
      <View style={styles.greetFact}>
        {/* Absolutely placed: the outgoing and incoming facts overlap while they swap instead of stacking. */}
        <Animated.View key={fact} entering={FadeInUp.duration(320)} exiting={FadeOutUp.duration(220)} style={styles.greetFactLine}>
          <Text size="13" color="muted" numberOfLines={1}>
            {fact}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const VIEWS: { value: View_; label: string; icon: typeof faChartPie }[] = [
  { value: 'overview', label: 'Overview', icon: faChartPie },
  // A terminal, because that's where it takes you: the workspace's activity log.
  { value: 'activity', label: 'Activity log', icon: faTerminal },
];

/**
 * Overview / Activity log switch: an icon-only pill under the workspace switcher, built like it (same surface,
 * 44dp tall, 32dp items inset 6dp) so the two read as a set.
 */
function ViewChip({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.viewChip} accessibilityRole="tablist">
      <BarSurface radius={22} />
      {VIEWS.map((v) => {
        const active = v.value === value;
        return (
          <PressableScale
            key={v.value}
            accessibilityRole="tab"
            accessibilityLabel={v.label}
            accessibilityState={{ selected: active }}
            scaleTo={0.92}
            haptic="select"
            onPress={() => onChange(v.value)}
            style={[styles.viewItem, { backgroundColor: active ? theme.accent : 'transparent' }, stateTransition]}>
            <Icon icon={v.icon} size={15} color={active ? theme.onAccent : theme.muted} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const KpiNote = ({ children }: { children: ReactNode }) => (
  <Text size="11" color="muted" numberOfLines={1} style={{ marginTop: 4 }}>
    {children}
  </Text>
);

export default function DashboardScreen() {
  const dark = useIsDark();
  const { org, depts, lists, members, userId, scope, isLoading: workspaceLoading } = useWorkspace();
  const active = useActiveTasks(org?.id);
  /** The work links open the last channel's board (or the channel list when there is none yet). */
  const openBoard = () =>
    scope.listId
      ? router.navigate({ pathname: '/channels/[listId]', params: { listId: scope.listId } })
      : router.navigate('/channels');
  const counts = useBoardCounts(org?.id, WHOLE_WORKSPACE);
  const doneChains = useSeriesSummaries(org?.id, WHOLE_WORKSPACE, DONE_ONLY);
  const cancelledChains = useSeriesSummaries(org?.id, WHOLE_WORKSPACE, CANCELLED_ONLY);
  const [view, setView] = useState<View_>('overview');
  const activity = useOrgActivity(org?.id, view === 'activity');

  // Until the workspace resolves, the task queries sit disabled (not "loading"), so count that wait too —
  // otherwise the overview flashes zeros, then refills and re-animates once the real numbers land.
  const loading =
    workspaceLoading || active.isLoading || counts.isLoading || doneChains.isLoading || cancelledChains.isLoading;
  const tasks = useMemo(() => active.data ?? [], [active.data]);

  const stats = useMemo(() => {
    const priority: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
    const byDept = new Map<string, number>();
    const byAssignee = new Map<string, number>();
    const deptOfList = new Map(lists.map((l) => [l.id, l.departmentId]));
    let unassigned = 0;
    let mine = 0;
    let overdue = 0;
    for (const t of tasks) {
      priority[taskPriority(t)]++;
      const deptId = deptOfList.get(t.listId);
      if (deptId) byDept.set(deptId, (byDept.get(deptId) ?? 0) + 1);
      const ids = t.assigneeUserIds ?? [];
      if (ids.length === 0) unassigned++;
      if (userId && ids.includes(userId)) mine++;
      for (const id of ids) byAssignee.set(id, (byAssignee.get(id) ?? 0) + 1);
      if (taskIsOverdue(t)) overdue++;
    }
    return { priority, byDept, byAssignee, unassigned, mine, overdue };
  }, [tasks, lists, userId]);

  const workflow = {
    pending: counts.data?.pending ?? 0,
    in_progress: counts.data?.in_progress ?? 0,
    done: countChainsOnce(counts.data?.done ?? 0, doneChains.summaries),
    cancelled: countChainsOnce(counts.data?.cancelled ?? 0, cancelledChains.summaries),
  };
  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);
  const topAssignees = [...stats.byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const memberById = new Map(members.map((m) => [m.userId, m]));

  return (
    <Page
      header={
        <TabHeader>
          <WorkspaceSwitcher />
        </TabHeader>
      }
      onRefresh={() => {
        void active.refetch();
        void counts.refetch();
        void activity.refetch();
      }}
      refreshing={active.isRefetching || counts.isRefetching}
      enter={false}
      gap={10}>
      {/* The page plays one sequence, top to bottom: this row, the four cards, the ring (then its fill), the two
          charts (then their bars). The overview waits for its data, so nothing lands on placeholder numbers. */}
      <Animated.View entering={sequenceEnter(0)} style={styles.greetRow}>
        <Greeting
          loading={loading}
          facts={[
            stats.overdue > 0 ? `${stats.overdue} ${stats.overdue === 1 ? 'task is' : 'tasks are'} overdue` : null,
            workflow.in_progress > 0 ? `${workflow.in_progress} in progress right now` : null,
            stats.unassigned > 0 ? `${stats.unassigned} waiting for an owner` : null,
            stats.mine > 0 ? `${stats.mine} assigned to you` : null,
            workflow.pending > 0 ? `${workflow.pending} pending in the queue` : null,
          ]}
        />
        <ViewChip value={view} onChange={setView} />
      </Animated.View>

      {active.error || counts.error ? (
        <ErrorBanner message={((active.error ?? counts.error) as Error).message} />
      ) : null}

      {view === 'overview' ? (
        (
          <>
            <View style={styles.kpiGrid}>
              <KpiCard tone="rose" index={1} onPress={() => openBoard()}>
                <KpiLabel>Overdue</KpiLabel>
                <KpiValue loading={loading} color={stats.overdue > 0 ? (dark ? Tone.red400 : Tone.red600) : undefined}>
                  {stats.overdue}
                </KpiValue>
                <KpiNote>Past their due date</KpiNote>
              </KpiCard>
              <KpiCard tone="amber" index={2} onPress={() => openBoard()}>
                <KpiLabel>Unassigned</KpiLabel>
                <KpiValue loading={loading}>{stats.unassigned}</KpiValue>
                <KpiNote>Waiting for an owner</KpiNote>
              </KpiCard>
              <KpiCard tone="blue" index={3} onPress={() => router.navigate('/my-tasks')}>
                <KpiLabel>Assigned to me</KpiLabel>
                <KpiValue loading={loading}>{stats.mine}</KpiValue>
                <KpiNote>On your plate</KpiNote>
              </KpiCard>
              <KpiCard tone="peach" index={4}>
                <KpiLabel>Workspace</KpiLabel>
                <View style={styles.workspaceRow}>
                  {[
                    { label: 'Members', n: members.length },
                    { label: NODE_LABELS.levelPlural, n: depts.length },
                    { label: NODE_LABELS.listPlural, n: lists.length },
                  ].map((x) => (
                    <View key={x.label} style={{ flex: 1, minWidth: 0 }}>
                      {loading ? (
                        <Pulse style={{ width: 24, height: 18, borderRadius: 5, marginVertical: 2, backgroundColor: 'rgba(120,120,120,0.18)' }} />
                      ) : (
                        <Text size="xl" lh={22} weight="semibold" tabular>
                          {x.n}
                        </Text>
                      )}
                      <Text size="10" color="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                        {x.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </KpiCard>
            </View>
  
            <StatusPriorityRing
              topTitle="Status"
              bottomTitle="Priority"
              topLabel="tasks"
              bottomLabel="open"
              enterIndex={5}
              loading={loading}
              top={TASK_FLOW_ORDER.map((st) => ({
                key: st,
                label: FLOW_COLUMN_LABELS[st],
                value: workflow[st],
                color: STATUS_COLOR[st],
              }))}
              bottom={PRIORITY_ORDER.map((p) => ({
                key: p,
                label: PRIORITY_LABELS[p],
                value: stats.priority[p],
                color: PRIORITY_COLOR[p],
              }))}
            />
  
            <HBarChart
              title={`By ${NODE_LABELS.level.toLowerCase()}`}
              total={`${tasks.length} open`}
              color={Tone.violet500}
              emptyLabel={`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`}
              enterIndex={6}
              loading={loading}
              rows={depts.map((d) => ({ key: d.id, label: d.name, value: stats.byDept.get(d.id) ?? 0 }))}
            />
  
            <HBarChart
              title="Assignee load"
              total="open tasks"
              color={Tone.sky500}
              emptyLabel="Nobody is assigned yet."
              enterIndex={7}
              loading={loading}
              rows={topAssignees.map(([id, n]) => {
                const m = memberById.get(id);
                return {
                  key: id,
                  label: names.get(id) ?? 'Someone',
                  value: n,
                  avatar: { name: m?.name, email: m?.email, image: m?.image },
                };
              })}
            />
          </>
        )
      ) : (
        <View style={{ gap: 6 }}>
          <SectionLabel>Workspace activity</SectionLabel>
          <Text size="sm" color="muted">
            Ledger from tasks you can access, newest first.
          </Text>
          <View style={{ marginTop: 6 }}>
            <ActivityTerminal
              entries={activity.data?.entries ?? []}
              tasksById={activity.data?.tasksById ?? {}}
              names={names}
              timeZone={org?.timeZone ?? 'UTC'}
              isLoading={activity.isLoading}
              errorMessage={activity.error ? (activity.error as Error).message : null}
              onOpenTask={(taskId) => router.push({ pathname: '/task/[id]', params: { id: taskId } })}
            />
          </View>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  viewChip: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: 22,
  },
  // The header and the page share the 12dp gutter, so this row needs no inset to line up with the pills and cards.
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  greetFact: { height: 20, overflow: 'hidden' },
  greetFactLine: { position: 'absolute', left: 0, right: 0, top: 0 },
  viewItem: { width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiOuter: { flexGrow: 1, flexBasis: '46%' },
  kpi: {
    flex: 1,
    minHeight: 104,
    borderRadius: Radius.xxxl - 3,
    borderWidth: 1,
    padding: 10,
    overflow: 'hidden',
  },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, overflow: 'hidden' },
  workspaceRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
