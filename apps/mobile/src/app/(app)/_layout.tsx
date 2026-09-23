import { Stack } from 'expo-router';
import { View } from 'react-native';

import { LiveIsland } from '@/components/shell/live-island';
import { NotificationsProvider } from '@/components/shell/notifications';
import { OnlinePresenceProvider } from '@/components/shell/online-presence';
import { useTheme } from '@/hooks/use-theme';
import { WorkspaceProvider } from '@/lib/workspace';

/**
 * Authenticated area: workspace data, notifications and live presence around a stack. The tabs (with the
 * floating bar) are its root; task detail, new task and the account-menu screens push above them, so they get
 * the full screen.
 */
export default function AppLayout() {
  const theme = useTheme();
  return (
    <WorkspaceProvider>
      <NotificationsProvider>
        <OnlinePresenceProvider>
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
        </OnlinePresenceProvider>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
