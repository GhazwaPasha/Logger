import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { StackHeader } from '@/components/shell/screen-header';
import { Board } from '@/components/tasks/board';
import { useChannelUnread } from '@/hooks/use-channel-unread';
import { useWorkspace } from '@/lib/workspace';

/** A channel's board, pushed over the channel list. */
export default function ChannelBoardScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const { lists, depts, scope, setList } = useWorkspace();
  const { latestActivity, lastSeen, markListSeen } = useChannelUnread();
  const list = lists.find((l) => l.id === listId);
  const category = depts.find((d) => d.id === list?.departmentId);

  // Remember the open channel (new-task default, dashboard links) — also when arriving by a deep link.
  useEffect(() => {
    if (listId && scope.listId !== listId && list) setList(listId);
  }, [listId, scope.listId, list, setList]);

  // Keep the open channel marked as seen while new activity arrives on it — otherwise leaving it would
  // immediately show it as unread despite having just watched it happen.
  const latest = listId ? latestActivity(listId) : 0;
  const seen = listId ? lastSeen(listId) : 0;
  useEffect(() => {
    if (listId && latest > seen) markListSeen(listId);
  }, [listId, latest, seen, markListSeen]);

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={list ? `# ${list.name}` : 'Channel'} subtitle={category?.name} />
      <Board listId={listId} />
    </View>
  );
}
