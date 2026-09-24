import { Stack } from 'expo-router';
import { View } from 'react-native';

import { LiveIsland } from '@/components/shell/live-island';
import { NotificationsProvider } from '@/components/shell/notifications';
import { OnlinePresenceProvider } from '@/components/shell/online-presence';
import { useTheme } from '@/hooks/use-theme';
import { authClient } from '@/lib/auth-client';
import { usePushNotifications } from '@/lib/push';
import { WorkspaceProvider } from '@/lib/workspace';

/** The tabs sit at the bottom of this stack, so anything pushed on top (a task, settings…) backs out to them. */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Authenticated area: workspace data, notifications and live presence around a stack. The tabs (with the
 * floating bar) are its root; task detail, new task and the account-menu screens push above them, so they get
 * the full screen.
 */
export default function AppLayout() {
  const theme = useTheme();
  const { data: session } = authClient.useSession();
  // Register this device for push, and open the task when a notification is tapped.
  usePushNotifications(session?.user.id ?? null);
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
            </Stack>
            <LiveIsland />
          </View>
        </OnlinePresenceProvider>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
