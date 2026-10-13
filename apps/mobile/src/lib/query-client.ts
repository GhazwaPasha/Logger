import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

import { ApiError, NetworkError, isTerminalError } from '@/lib/api';

/** Retries only what retrying can fix: network blips and server errors, never auth/permission/validation. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isTerminalError(error)) return false;
  if (error instanceof NetworkError) return failureCount < 3;
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') return failureCount < 2;
  return failureCount < 2;
}

/** Exponential backoff with jitter, or exactly what the server asked for on RATE_LIMITED. */
function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs) return error.retryAfterMs;
  const ceiling = Math.min(30_000, 1_000 * 2 ** attempt);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: shouldRetry,
      retryDelay,
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
