import { Stack } from 'expo-router';

import { NotificationsProvider } from '@/components/shell/notifications';
import { Shell } from '@/components/shell/shell';
import { useTheme } from '@/hooks/use-theme';
import { WorkspaceProvider } from '@/lib/workspace';

/** Authenticated area: workspace data, notifications, and the header/sidebar shell around every screen. */
export default function AppLayout() {
  const theme = useTheme();
  return (
    <WorkspaceProvider>
      <NotificationsProvider>
        <Shell>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: theme.surfaceBase },
            }}
          />
        </Shell>
      </NotificationsProvider>
    </WorkspaceProvider>
  );
}
