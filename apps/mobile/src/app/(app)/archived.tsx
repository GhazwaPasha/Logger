import { faBoxArchive, faTrash } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { PageEnter } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Button, CenteredSpinner, EmptyState, ErrorBanner, IconButton } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateOnly } from '@/lib/format';
import { archivedTaskCaps, isWorkspaceOwner } from '@/lib/permissions';
import { flattenPages, useArchivedTasks, usePurgeArchived, usePurgeTask, useRestoreTask } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** Archived tasks (soft-deleted): restore them, or delete them for good one by one or all at once. */
export default function ArchivedScreenRoute() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceBase }}>
      <StackHeader title="Archived" />
      <PageEnter>
        <ArchivedScreen />
      </PageEnter>
    </View>
  );
}

function ArchivedScreen() {
  const theme = useTheme();
  const { org, lists, members, userId } = useWorkspace();
  const q = useArchivedTasks(org?.id);
  const restore = useRestoreTask();
  const purge = usePurgeTask(org?.id);
  const purgeAll = usePurgeArchived(org?.id);
  const rows = flattenPages(q.data);
  const isOwner = isWorkspaceOwner(members, userId);
  const total = q.data?.pages[0]?.total ?? rows.length;
  const canPurgeAny = rows.some((t) => archivedTaskCaps(t, lists, userId, members).canPurge);

  function confirmPurge(taskId: string, title: string) {
    Alert.alert('Delete this task permanently?', `“${title}” and all its data will be removed for good.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => purge.mutate(taskId) },
    ]);
  }

  function confirmPurgeAll() {
    Alert.alert(
      isOwner ? `Delete all ${total} archived task${total === 1 ? '' : 's'}?` : 'Delete every archived task you created?',
      'They and all their data will be removed for good. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => purgeAll.mutate() },
      ],
    );
  }

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: theme.surfaceBase }}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {q.error ? <ErrorBanner message={q.error.message} onRetry={() => void q.refetch()} /> : null}
          {restore.error ? <ErrorBanner message={restore.error.message} /> : null}
          {purge.error ? <ErrorBanner message={purge.error.message} /> : null}
          {purgeAll.error ? <ErrorBanner message={purgeAll.error.message} /> : null}
          {canPurgeAny ? (
            <View style={styles.toolbar}>
              <Text size="xs" color="muted" tabular>
                {`${total} archived task${total === 1 ? '' : 's'}`}
              </Text>
              <Button title="Delete all" variant="secondary" compact loading={purgeAll.isPending} onPress={confirmPurgeAll} />
            </View>
          ) : null}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => {
        const caps = archivedTaskCaps(item, lists, userId, members);
        return (
        <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.borderSubtle }]}>
          <PressableScale scaleTo={0.985} style={{ flex: 1, minWidth: 0 }} onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}>
            <Text size="sm" weight="medium" numberOfLines={2}>
              {item.title}
            </Text>
            {item.deletedAt ? (
              <Text size="11" color="muted">
                Archived {formatDateOnly(item.deletedAt, org?.timeZone)}
              </Text>
            ) : null}
          </PressableScale>
          {caps.canRestore ? (
            <Button
              title="Restore"
              variant="secondary"
              compact
              loading={restore.isPending && restore.variables === item.id}
              onPress={() => restore.mutate(item.id)}
            />
          ) : null}
          {caps.canPurge ? (
            <IconButton icon={faTrash} label={`Delete permanently: ${item.title}`} iconSize={14} size={36} onPress={() => confirmPurge(item.id, item.title)} />
          ) : null}
        </View>
        );
      }}
      ListEmptyComponent={
        q.isLoading ? <CenteredSpinner /> : <EmptyState icon={faBoxArchive} title="Nothing archived" description="Archived tasks show up here." />
      }
      onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} tintColor={theme.muted} />}
    />
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 4 },
  content: { padding: 12, paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.xl, borderWidth: 1 },
});
