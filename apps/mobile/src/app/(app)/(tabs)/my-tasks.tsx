import { View } from 'react-native';

import { TabHeader } from '@/components/shell/screen-header';
import { Board } from '@/components/tasks/board';
import { useWorkspace } from '@/lib/workspace';

export default function MyTasksScreen() {
  const { userId } = useWorkspace();
  return (
    <View style={{ flex: 1 }}>
      <TabHeader title="My tasks" />
      <Board assigneeUserId={userId} emptyTitle="Nothing assigned to you" />
    </View>
  );
}
