"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { Query } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { makeQueryClient } from "@/lib/query-client";
import { QUERY_CACHE_VERSION, QUERY_STORAGE_KEY_PREFIX } from "@/lib/query-cache-version";

/**
 * When the API returns 401, refresh the JWT and then invalidate (not remove)
 * org/workspace queries. Using invalidateQueries keeps cached data visible
 * during the refresh so there's no loading flash, and avoids the infinite loop
 * that removeQueries causes (wiping the cache resets React Query's retry counter,
 * so each retry with the same expired token spawns a fresh attempt forever).
 */
function QueryAuthListeners() {
  const qc = useQueryClient();
  const { refreshToken } = useApiSession();
  const isRefreshing = useRef(false);

  useEffect(() => {
    async function onAuthExpired() {
      if (isRefreshing.current) return;
      isRefreshing.current = true;
      try {
        await refreshToken();
        void qc.invalidateQueries({ queryKey: ["organizations"] });
        void qc.invalidateQueries({ queryKey: ["workspace"] });
      } finally {
        isRefreshing.current = false;
      }
    }
    window.addEventListener("wl:auth-expired", onAuthExpired);
    return () => window.removeEventListener("wl:auth-expired", onAuthExpired);
  }, [qc, refreshToken]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const { session } = useApiSession();
  const userId = session?.user?.id ?? "";

  const queryClient = useMemo(() => makeQueryClient(), [userId]);

  const persister = useMemo(
    () =>
      createSyncStoragePersister({
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        key: `${QUERY_STORAGE_KEY_PREFIX}_${QUERY_CACHE_VERSION}_${userId || "guest"}`,
        throttleTime: 800,
      }),
    [userId],
  );

  const persistOptions = useMemo(
    () => ({
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      buster: QUERY_CACHE_VERSION,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: Query) => {
          if (!userId) return false;
          // Never persist errors (e.g. "Failed to fetch") — they stick across reloads for maxAge and mask fixes.
          if (query.state.status !== "success") return false;
          const root = query.queryKey[0];
          return root === "organizations" || root === "workspace";
        },
      },
    }),
    [persister, userId],
  );

  return (
    <Fragment key={userId || "guest"}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <QueryAuthListeners />
        {children}
      </PersistQueryClientProvider>
    </Fragment>
  );
}
