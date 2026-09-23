import { faBoxArchive } from '@fortawesome/free-solid-svg-icons';
import { router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { PageEnter } from '@/components/page';
import { StackHeader } from '@/components/shell/screen-header';
import { Text } from '@/components/text';
import { Button, CenteredSpinner, EmptyState, ErrorBanner } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateOnly } from '@/lib/format';
import { flattenPages, useArchivedTasks, useRestoreTask } from '@/lib/queries';
import { useWorkspace } from '@/lib/workspace';

/** Archived tasks (soft-deleted) with restore. */
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
  const { org } = useWorkspace();
  const q = useArchivedTasks(org?.id);
  const restore = useRestoreTask();
  const rows = flattenPages(q.data);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.surfaceBase }}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {q.error ? <ErrorBanner message={q.error.message} onRetry={() => void q.refetch()} /> : null}
          {restore.error ? <ErrorBanner message={restore.error.message} /> : null}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      renderItem={({ item }) => (
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
          <Button
            title="Restore"
            variant="secondary"
            compact
            loading={restore.isPending && restore.variables === item.id}
            onPress={() => restore.mutate(item.id)}
          />
        </View>
      )}
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
  content: { padding: 12, paddingTop: 4, paddingBottom: 32, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.xl, borderWidth: 1 },
});
