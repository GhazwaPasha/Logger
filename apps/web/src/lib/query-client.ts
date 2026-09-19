import { QueryClient } from "@tanstack/react-query";
import { NetworkError } from "@/lib/api";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // A server that's briefly down (e.g. restarting) is worth a few backed-off retries; other errors get one.
        retry: (failureCount, error) => (error instanceof NetworkError ? failureCount < 3 : failureCount < 1),
      },
      mutations: {
        // Default "online" mode silently pauses a mutation while the browser is offline, so a save looks hung.
        // "always" runs it and fails fast with a NetworkError the caller can show.
        networkMode: "always",
      },
    },
  });
}
