import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { ApiError } from '@/lib/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => {
        if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) return false;
        return count < 2;
      },
    },
  },
});

/** React Native has no window focus / online events; feed React Query's managers from the platform. */
export function wireQueryManagers() {
  const appState = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false));
    return () => sub.remove();
  });
  return () => appState.remove();
}
