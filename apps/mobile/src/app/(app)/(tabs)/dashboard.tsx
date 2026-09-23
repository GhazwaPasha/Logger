import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ActivityTerminal } from '@/components/activity/activity-terminal';
import { Donut } from '@/components/donut';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Page, Panel, SectionLabel, Segmented } from '@/components/page';
import { TabHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { ErrorBanner } from '@/components/ui';
import { sequenceEnter } from '@/constants/motion';
import { alpha, Radius, Tone } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { NODE_LABELS } from '@/lib/labels';
import { useActiveTasks, useBoardCounts, useOrgActivity } from '@/lib/queries';
import { FLOW_COLUMN_LABELS, PRIORITY_LABELS, taskIsOverdue, taskPriority, TASK_FLOW_ORDER, type TaskPriority } from '@/lib/task-board';
import { useWorkspace } from '@/lib/workspace';

type View_ = 'overview' | 'activity';

/** KPI card pastel tones (light theme only — dark keeps the plain elevated surface, like the web). */
const KPI_TONES = [
  { bg: '#e9eefc', border: 'rgba(95, 115, 175, 0.14)', back: '#c4d4ef', front: '#aabfe6' },
  { bg: '#f3ebfa', border: 'rgba(140, 110, 175, 0.14)', back: '#e3d0f2', front: '#cfbae8' },
  { bg: '#e4f7ee', border: 'rgba(55, 135, 105, 0.14)', back: '#bae8d4', front: '#9fdabe' },
  { bg: '#fff1e6', border: 'rgba(195, 125, 65, 0.16)', back: '#ffd8b8', front: '#ffc49a' },
] as const;

const STATUS_COLOR = {
  pending: alpha(Tone.slate500, 0.55),
  in_progress: alpha(Tone.violet500, 0.55),
  done: alpha(Tone.emerald500, 0.55),
  cancelled: alpha(Tone.neutral500, 0.45),
} as const;
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: alpha('#f43f5e', 0.55),
  medium: alpha(Tone.amber500, 0.5),
  low: alpha('#94a3b8', 0.45),
};
const PRIORITY_ORDER: TaskPriority[] = ['high', 'medium', 'low'];

function KpiCard({ tone, children, onPress }: { tone: 0 | 1 | 2 | 3; children: ReactNode; onPress?: () => void }) {
  const theme = useTheme();
  const dark = useIsDark();
  const t = KPI_TONES[tone];
  return (
    // The entrance keyframe and the press-scale transform can't share one node (Reanimated warns about
    // "transform" being fought over), so the flex sizing + entrance live on this outer wrapper and the
    // press animation stays on the inner Pressable.
    <Animated.View entering={sequenceEnter(tone)} style={styles.kpiOuter}>
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
const KpiValue = ({ children, color }: { children: ReactNode; color?: string }) => (
  <Text size="3xl" lh={36} weight="semibold" tabular tracking={-0.6} color={color ?? 'fg'} style={{ fontSize: 36, marginTop: 2 }}>
    {children}
  </Text>
);

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const theme = useTheme();
  return (
    <View style={styles.barRow}>
      <Text size="sm" weight="medium" numberOfLines={1} style={{ width: 96 }}>
        {label}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: theme.surfaceMuted }]}>
        <View style={{ width: `${max ? Math.max(4, (value / max) * 100) : 0}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text size="sm" weight="medium" tabular style={{ width: 28, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  const { org, depts, lists, members, userId, scope } = useWorkspace();
  const active = useActiveTasks(org?.id);
  /** The work links open the last channel's board (or the channel list when there is none yet). */
  const openBoard = () =>
    scope.listId
      ? router.navigate({ pathname: '/channels/[listId]', params: { listId: scope.listId } })
      : router.navigate('/channels');
  const counts = useBoardCounts(org?.id, {});
  const [view, setView] = useState<View_>('overview');
  const activity = useOrgActivity(org?.id, view === 'activity');

  const firstName = session?.user.name?.trim().split(' ')[0] || session?.user.email || 'there';
  const loading = active.isLoading || counts.isLoading;
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
    done: counts.data?.done ?? 0,
    cancelled: counts.data?.cancelled ?? 0,
  };
  const names = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);
  const value = (n: number) => (loading ? '…' : String(n));
  const deptMax = Math.max(0, ...depts.map((d) => stats.byDept.get(d.id) ?? 0));
  const topAssignees = [...stats.byAssignee.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const assigneeMax = topAssignees[0]?.[1] ?? 0;

  return (
    <Page
      header={<TabHeader title={`Hey, ${firstName}!`} />}
      onRefresh={() => {
        void active.refetch();
        void counts.refetch();
        void activity.refetch();
      }}
      refreshing={active.isRefetching || counts.isRefetching}
      gap={10}>
      <View style={styles.titleRow}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity log' },
          ]}
        />
      </View>

      {active.error || counts.error ? (
        <ErrorBanner message={((active.error ?? counts.error) as Error).message} />
      ) : null}

      {view === 'overview' ? (
        <>
          <View style={styles.kpiGrid}>
            <KpiCard tone={0} onPress={() => openBoard()}>
              <KpiLabel>Pending work</KpiLabel>
              <KpiValue>{value(workflow.pending)}</KpiValue>
              <Text size="11" color="muted" style={{ marginTop: 4 }}>
                {FLOW_COLUMN_LABELS.pending} queue
              </Text>
            </KpiCard>
            <KpiCard tone={1} onPress={() => openBoard()}>
              <KpiLabel>Active work</KpiLabel>
              <KpiValue>{value(workflow.in_progress)}</KpiValue>
              <Text size="11" color="muted" style={{ marginTop: 4 }}>
                {FLOW_COLUMN_LABELS.in_progress}
              </Text>
            </KpiCard>
            <KpiCard tone={2}>
              <KpiLabel>Completed</KpiLabel>
              <KpiValue color={theme.fg === '#fafafa' ? Tone.emerald500 : '#059669'}>{value(workflow.done)}</KpiValue>
              <Text size="11" color="muted" style={{ marginTop: 4 }}>
                Tasks marked done
              </Text>
            </KpiCard>
            <KpiCard tone={3}>
              <KpiLabel>Workspace</KpiLabel>
              <View style={styles.workspaceRow}>
                {[
                  { label: 'Members', n: members.length },
                  { label: NODE_LABELS.levelPlural, n: depts.length },
                  { label: NODE_LABELS.listPlural, n: lists.length },
                ].map((x) => (
                  <View key={x.label} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xl" lh={22} weight="semibold" tabular>
                      {loading ? '…' : x.n}
                    </Text>
                    <Text size="10" color="muted" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                      {x.label}
                    </Text>
                  </View>
                ))}
              </View>
            </KpiCard>
          </View>

          <Panel enterIndex={4}>
            <View style={styles.panelHead}>
              <View style={{ flex: 1 }}>
                <SectionLabel>Status mix</SectionLabel>
                <Text size="sm" color="muted">
                  All active tasks (not deleted)
                </Text>
              </View>
              <Text size="xs" weight="medium" color="accent" onPress={() => openBoard()}>
                Open Work
              </Text>
            </View>
            <View style={styles.chartRow}>
              <Donut
                label="Tasks"
                emptyLabel="No tasks yet"
                segments={TASK_FLOW_ORDER.map((s) => ({ value: workflow[s], color: STATUS_COLOR[s] }))}
              />
              <View style={{ flex: 1, gap: 6 }}>
                {TASK_FLOW_ORDER.map((s) => (
                  <View key={s} style={styles.legendRow}>
                    <View style={styles.legendLabel}>
                      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s] }]} />
                      <Text size="sm" color="muted" numberOfLines={1}>
                        {FLOW_COLUMN_LABELS[s]}
                      </Text>
                    </View>
                    <Text size="sm" weight="medium" tabular>
                      {value(workflow[s])}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Panel>

          <Panel enterIndex={5}>
            <SectionLabel>Priority</SectionLabel>
            <Text size="sm" color="muted">
              Where urgency is set on tasks
            </Text>
            <View style={styles.chartRow}>
              <Donut
                label="Tasks"
                emptyLabel="No tasks yet"
                segments={PRIORITY_ORDER.map((p) => ({ value: stats.priority[p], color: PRIORITY_COLOR[p] }))}
              />
              <View style={{ flex: 1, gap: 6 }}>
                {PRIORITY_ORDER.map((p) => (
                  <View key={p} style={styles.legendRow}>
                    <View style={styles.legendLabel}>
                      <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[p] }]} />
                      <Text size="sm" color="muted">
                        {PRIORITY_LABELS[p]}
                      </Text>
                    </View>
                    <Text size="sm" weight="medium" tabular>
                      {value(stats.priority[p])}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Panel>

          <Panel enterIndex={6}>
            <SectionLabel>Needs attention</SectionLabel>
            <Text size="sm" color="muted">
              Jump to your work with filters applied.
            </Text>
            <View style={styles.tiles}>
              {[
                { label: 'Overdue', n: stats.overdue, tone: Tone.red500, go: () => openBoard() },
                { label: 'Unassigned', n: stats.unassigned, tone: Tone.amber500, go: () => openBoard() },
                { label: 'Assigned to me', n: stats.mine, tone: Tone.blue500, go: () => router.navigate('/my-tasks') },
              ].map((x) => (
                <PressableScale
                  key={x.label}
                  onPress={x.go}
                  scaleTo={0.96}
                  style={[styles.tile, { backgroundColor: alpha(x.tone, 0.08), borderColor: alpha(x.tone, 0.25) }]}>
                  <Text size="2xl" lh={28} weight="semibold" tabular>
                    {loading ? '…' : x.n}
                  </Text>
                  <Text size="xs" color="muted">
                    {x.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </Panel>

          <Panel enterIndex={7}>
            <SectionLabel>{`By ${NODE_LABELS.level.toLowerCase()}`}</SectionLabel>
            <Text size="sm" color="muted">
              {`Pipeline tasks grouped by ${NODE_LABELS.list.toLowerCase()}'s ${NODE_LABELS.level.toLowerCase()}`}
            </Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {depts.length === 0 ? (
                <Text size="sm" color="muted">{`No ${NODE_LABELS.levelPlural.toLowerCase()} yet.`}</Text>
              ) : (
                depts.map((d) => <Bar key={d.id} label={d.name} value={stats.byDept.get(d.id) ?? 0} max={deptMax} color={alpha(Tone.violet500, 0.6)} />)
              )}
            </View>
          </Panel>

          <Panel enterIndex={8}>
            <SectionLabel>Assignee load</SectionLabel>
            <Text size="sm" color="muted">
              Pipeline tasks with someone assigned
            </Text>
            <View style={{ gap: 8, marginTop: 10 }}>
              {topAssignees.length === 0 ? (
                <Text size="sm" color="muted">
                  Nobody is assigned yet.
                </Text>
              ) : (
                topAssignees.map(([id, n]) => (
                  <Bar key={id} label={names.get(id) ?? 'Someone'} value={n} max={assigneeMax} color={alpha(Tone.sky500, 0.6)} />
                ))
              )}
            </View>
          </Panel>
        </>
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
  titleRow: { gap: 8 },
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
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  legendLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tile: { flexGrow: 1, flexBasis: '30%', borderRadius: Radius.xl, borderWidth: 1, padding: 10, gap: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
});
