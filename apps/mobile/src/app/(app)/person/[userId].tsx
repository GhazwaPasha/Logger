import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { StackHeader } from '@/components/shell/screen-header';
import { Board } from '@/components/tasks/board';
import { useTheme } from '@/hooks/use-theme';
import { useWorkspace } from '@/lib/workspace';

/** Everything assigned to one person (opened from search). */
export default function PersonScreen() {
  const theme = useTheme();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { members } = useWorkspace();
  const member = members.find((m) => m.userId === userId);
  const name = member?.name || member?.email || 'Member';

  return (
    <View style={{ flex: 1, backgroundColor: theme.surfaceBase }}>
      <StackHeader title={name} subtitle="Assigned tasks" />
      <Board assigneeUserId={userId} emptyTitle={`Nothing assigned to ${member?.name || 'them'}`} />
    </View>
  );
}
