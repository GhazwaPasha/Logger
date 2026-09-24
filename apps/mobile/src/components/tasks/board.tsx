import {
  faArrowsUpDown,
  faCalendarDays,
  faListUl,
  faPlus,
  faTableColumns,
  faTableList,
} from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { PressableScale } from '@/components/motion/pressable-scale';
import { PageEnter } from '@/components/page';
import { useCollapseOnScroll, useTabBarInset } from '@/components/shell/tab-bar/tab-bar-context';
import { BoardActionsContext, type BoardActions } from '@/components/tasks/board-context';
import { RecurringSeriesCard } from '@/components/tasks/recurring-series-card';
import { ColumnHeader } from '@/components/tasks/status-pill';
import { TaskCard, TaskCardSkeleton } from '@/components/tasks/task-card';
import { Text } from '@/components/text';
import { EmptyState, ErrorBanner, IconButton } from '@/components/ui';
import { listLayout } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  flattenPages,
  usePatchTask,
  usePendingTaskIds,
  useBoardColumn,
  useBoardCounts,
  useSeriesSummaries,
  useSetSubtaskDone,
  type BoardFilter,
  type SeriesSummaryRow,
} from '@/lib/queries';
import {
  DONE_CANCELLED_STATUSES,
  DUE_WINDOW_OPTIONS,
  SERIES_GROUPED_COLUMNS,
  SORT_OPTIONS,
  sortTasks,
  TASK_FLOW_ORDER,
  taskMatchesDueWindow,
  type DueWindow,
  type ManualTaskStatus,
  type SortMode,
} from '@/lib/task-board';
import type { TaskRow } from '@/lib/types';
import { useOpenNewTask } from '@/lib/draft-task';
import { useWorkspace } from '@/lib/workspace';

/** A list-view row: either a plain task card, or a recurring chain collapsed into one series card. */
type ListRow = { kind: 'task'; task: TaskRow } | { kind: 'series'; summary: SeriesSummaryRow };

type ViewMode = 'list' | 'kanban';

/**
 * The work board — list and kanban views of one channel, or of everyone's tasks assigned to one person,
 * matching `work/page.tsx` on the web: toolbar, per-status paginated columns, same cards. The screen's
 * header names what the board shows.
 */
export function Board({
  listId,
  assigneeUserId,
  emptyTitle = 'No tasks here yet',
}: {
  /** Show one channel… */
  listId?: string;
  /** …or the tasks assigned to one person (My tasks, a person from search). */
  assigneeUserId?: string | null;
  emptyTitle?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const bottomInset = useTabBarInset();
  const onScroll = useCollapseOnScroll();
  const { org } = useWorkspace();
  const openNewTask = useOpenNewTask();
  const orgId = org?.id;
  const byChannel = !!listId;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('priority_desc');
  const [dueWindow, setDueWindow] = useState<DueWindow>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);

  const filter = useMemo<BoardFilter>(
    () => (byChannel ? { listId } : { assigneeUserId: assigneeUserId ?? null }),
    [byChannel, listId, assigneeUserId],
  );
  const ready = !!orgId && (byChannel || !!assigneeUserId);

  const pending = useBoardColumn(orgId, filter, 'pending', ready);
  const inProgress = useBoardColumn(orgId, filter, 'in_progress', ready);
  const doneCol = useBoardColumn(orgId, filter, 'done', ready);
  const cancelledCol = useBoardColumn(orgId, filter, 'cancelled', ready);
  const columns = useMemo(
    () => ({ pending, in_progress: inProgress, done: doneCol, cancelled: cancelledCol }),
    [pending, inProgress, doneCol, cancelledCol],
  );
  const counts = useBoardCounts(orgId, ready ? filter : { listId: '__none__' });

  // Recurring chains in Done/Cancelled collapse into a RecurringSeriesCard (matches the web board):
  // per-column in kanban, combined in list view. Own fetch, own loading state — never derived from
  // how far a column has paginated.
  const doneSeries = useSeriesSummaries(orgId, filter, ['done'], ready && viewMode === 'kanban');
  const cancelledSeries = useSeriesSummaries(orgId, filter, ['cancelled'], ready && viewMode === 'kanban');
  const combinedSeries = useSeriesSummaries(orgId, filter, DONE_CANCELLED_STATUSES, ready && viewMode === 'list');

  const patch = usePatchTask();
  const subtaskDone = useSetSubtaskDone();
  const syncingIds = usePendingTaskIds();

  const actions = useMemo<BoardActions>(
    () => ({
      openTask: (id) => router.push({ pathname: '/task/[id]', params: { id } }),
      patchTask: (taskId, p) => patch.mutate({ taskId, patch: p }),
      setSubtaskDone: (taskId, subtaskId, done) => subtaskDone.mutate({ taskId, subtaskId, done }),
      syncingIds,
      timeZone: org?.timeZone ?? 'UTC',
    }),
    // `mutate` is stable; syncingIds is a new Set each render, which is what drives the card spinners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch.mutate, subtaskDone.mutate, syncingIds, org?.timeZone],
  );

  const rowsFor = useCallback(
    (status: ManualTaskStatus): TaskRow[] =>
      sortTasks(flattenPages(columns[status].data).filter((t) => taskMatchesDueWindow(t, dueWindow)), sortMode),
    [columns, dueWindow, sortMode],
  );

  const listRows = useMemo<ListRow[]>(() => {
    const items: ListRow[] = [];
    for (const status of TASK_FLOW_ORDER) {
      const grouped = SERIES_GROUPED_COLUMNS.has(status);
      for (const task of rowsFor(status)) {
        if (grouped && task.recurringSeriesId) continue; // represented by its series card below
        items.push({ kind: 'task', task });
      }
    }
    const sortedSeries = [...combinedSeries.summaries].sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime(),
    );
    for (const summary of sortedSeries) items.push({ kind: 'series', summary });
    return items;
  }, [rowsFor, combinedSeries.summaries]);
  // Keep the skeletons until there is something to show: the columns resolve independently, and the
  // (often empty) done/cancelled ones usually land first — `every` would flash the empty state.
  const firstLoad = ready && listRows.length === 0 && TASK_FLOW_ORDER.some((s) => columns[s].isLoading);
  const anyError = TASK_FLOW_ORDER.map((s) => columns[s].error).find(Boolean) as Error | undefined;
  const refreshing = TASK_FLOW_ORDER.some((s) => columns[s].isRefetching && !columns[s].isFetchingNextPage);

  const refresh = () => {
    TASK_FLOW_ORDER.forEach((s) => void columns[s].refetch());
    void counts.refetch();
  };
  const loadMoreList = () => {
    const next = TASK_FLOW_ORDER.find((s) => columns[s].hasNextPage && !columns[s].isFetchingNextPage);
    if (next) void columns[next].fetchNextPage();
  };
  const loadingMore = TASK_FLOW_ORDER.some((s) => columns[s].isFetchingNextPage);

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.toolbarRow}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="New task"
          scaleTo={0.94}
          haptic="tap"
          onPress={() => openNewTask(listId)}
          style={({ pressed }) => [
            styles.newTask,
            { backgroundColor: theme.accent, borderColor: theme.accent },
            pressed && { opacity: 0.85 },
          ]}>
          <Icon icon={faPlus} size={16} color={theme.onAccent} />
        </PressableScale>

        <View style={[styles.toolbar, { backgroundColor: theme.bgHeader, borderColor: theme.borderSubtle }]}>
          <IconButton icon={faTableList} label="List view" active={viewMode === 'list'} onPress={() => setViewMode('list')} />
          <IconButton icon={faTableColumns} label="Kanban view" active={viewMode === 'kanban'} onPress={() => setViewMode('kanban')} />
          <View style={[styles.divider, { backgroundColor: theme.borderSubtle }]} />
          <IconButton
            icon={faArrowsUpDown}
            label={`Sort tasks: ${SORT_OPTIONS.find((o) => o.value === sortMode)?.label}`}
            active={sortOpen}
            onPress={() => setSortOpen(true)}
          />
          <View>
            <IconButton
              icon={faCalendarDays}
              label="Due date filter"
              active={dueOpen || dueWindow !== 'all'}
              onPress={() => setDueOpen(true)}
            />
            {dueWindow !== 'all' ? (
              <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.surfaceBase }]}>
                <Text size="10" weight="bold" color={theme.onAccent} lh={10}>
                  {DUE_WINDOW_OPTIONS.find((o) => o.value === dueWindow)?.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {anyError ? <ErrorBanner message={anyError.message} onRetry={refresh} /> : null}
    </View>
  );

  const empty = (
    <EmptyState
      icon={faListUl}
      title={emptyTitle}
      description={dueWindow !== 'all' ? 'Try a wider due-date window.' : 'Tap + to add one.'}
    />
  );

  let body: React.ReactNode;
  if (!ready || firstLoad) {
    body = (
      <View style={styles.skeletons}>
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </View>
    );
  } else if (viewMode === 'list') {
    body = (
      <Animated.FlatList
        data={listRows}
        keyExtractor={(item) => (item.kind === 'task' ? item.task.id : `series-${item.summary.seriesId}`)}
        // Only the first screenful staggers in; appended pages and recycled rows shouldn't re-animate.
        renderItem={({ item, index }) =>
          item.kind === 'task' ? (
            <TaskCard task={item.task} variant="list" enterIndex={index < 10 ? index : undefined} />
          ) : (
            <RecurringSeriesCard
              summary={item.summary}
              occurrenceStatuses={DONE_CANCELLED_STATUSES}
              enterIndex={index < 10 ? index : undefined}
            />
          )
        }
        itemLayoutAnimation={listLayout}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={[styles.listContent, { paddingBottom: 24 + bottomInset }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={theme.muted} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.muted} />}
        onEndReached={loadMoreList}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
      />
    );
  } else {
    const colWidth = Math.min(width - 24, 420);
    body = (
      <View style={{ flex: 1 }}>
        <View style={styles.kanbanHead}>{header}</View>
        <ScrollView
          horizontal
          snapToInterval={colWidth + 10}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kanbanScroll}>
          {TASK_FLOW_ORDER.map((status) => {
            const grouped = SERIES_GROUPED_COLUMNS.has(status);
            const rawRows = rowsFor(status);
            const rows = grouped ? rawRows.filter((t) => !t.recurringSeriesId) : rawRows;
            const seriesForCol = status === 'done' ? doneSeries.summaries : status === 'cancelled' ? cancelledSeries.summaries : [];
            const q = columns[status];
            const total = counts.data?.[status];
            return (
              <View key={status} style={{ width: colWidth, marginRight: 10 }}>
                <ColumnHeader
                  status={status}
                  count={q.hasNextPage ? `${rows.length}/${total ?? '…'}` : (total ?? rows.length)}
                />
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={[styles.columnList, { paddingBottom: 24 + bottomInset }]}
                  onScroll={({ nativeEvent: e }) => {
                    const nearEnd = e.contentOffset.y + e.layoutMeasurement.height > e.contentSize.height - 240;
                    if (nearEnd && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
                  }}
                  scrollEventThrottle={200}>
                  {rows.map((t, i) => (
                    <TaskCard key={t.id} task={t} variant="kanban" enterIndex={i < 8 ? i : undefined} />
                  ))}
                  {seriesForCol.map((s, i) => (
                    <RecurringSeriesCard
                      key={s.seriesId}
                      summary={s}
                      occurrenceStatuses={[status]}
                      enterIndex={rows.length + i < 8 ? rows.length + i : undefined}
                    />
                  ))}
                  {q.isFetchingNextPage ? <ActivityIndicator style={{ padding: 12 }} color={theme.muted} /> : null}
                  {rows.length === 0 && seriesForCol.length === 0 && !q.isFetching ? (
                    <EmptyState compact icon={faListUl} title="No tasks" />
                  ) : null}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <BoardActionsContext.Provider value={actions}>
      <PageEnter>
        <View style={[styles.fill, { backgroundColor: theme.surfaceBase }]}>{body}</View>
      </PageEnter>

      <MenuSheet<SortMode>
        visible={sortOpen}
        title="Sort"
        value={sortMode}
        options={SORT_OPTIONS}
        onSelect={setSortMode}
        onClose={() => setSortOpen(false)}
      />
      <MenuSheet<DueWindow>
        visible={dueOpen}
        title="Due date"
        value={dueWindow}
        options={DUE_WINDOW_OPTIONS}
        onSelect={setDueWindow}
        onClose={() => setDueOpen(false)}
      />
    </BoardActionsContext.Provider>
  );
}

function Gap() {
  return <View style={{ height: 8 }} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  headerWrap: { gap: 12, paddingBottom: 12 },
  kanbanHead: { paddingHorizontal: 12, paddingTop: 4 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  newTask: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 6,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 32, marginHorizontal: 4 },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 18,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletons: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12, gap: 8 },
  kanbanScroll: { paddingHorizontal: 12, paddingBottom: 12, flexGrow: 1 },
  columnList: { paddingTop: 8, gap: 8, paddingBottom: 24 },
});
