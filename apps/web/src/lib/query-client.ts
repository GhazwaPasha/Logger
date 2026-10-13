import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError, isTerminalError } from "@/lib/api";

/** Retries only what retrying can fix: network blips and server errors, never auth/permission/validation. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isTerminalError(error)) return false;
  if (error instanceof NetworkError) return failureCount < 3;
  if (error instanceof ApiError && error.code === "RATE_LIMITED") return failureCount < 2;
  return failureCount < 1;
}

/** Exponential backoff with jitter, or exactly what the server asked for on RATE_LIMITED. */
function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs) return error.retryAfterMs;
  const ceiling = Math.min(30_000, 1_000 * 2 ** attempt);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
        retryDelay,
      },
      mutations: {
        // Default "online" mode silently pauses a mutation while the browser is offline, so a save looks hung.
        // "always" runs it and fails fast with a NetworkError the caller can show.
        networkMode: "always",
      },
    },
  });
}
