import { Stack } from 'expo-router';
import { View } from 'react-native';

import { LiveIsland } from '@/components/shell/live-island';
import { NotificationsProvider } from '@/components/shell/notifications';
import { useTheme } from '@/hooks/use-theme';
import { WorkspaceProvider } from '@/lib/workspace';

/**
 * Authenticated area: workspace data and notifications around a stack. The tabs (with the floating bar) are
 * its root; task detail, new task and the account-menu screens push above them, so they get the full screen.
 */
export default function AppLayout() {
  const theme = useTheme();
  return (
    <WorkspaceProvider>
      <NotificationsProvider>
        <View style={{ flex: 1, backgroundColor: theme.surfaceBase }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: theme.surfaceBase },
            }}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="task/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          <LiveIsland />
        </View>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
