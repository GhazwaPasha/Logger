"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { authClient } from "@/lib/auth-client";
import { useThemePreference } from "@/hooks/useThemePreference";
import { safeReturnPath } from "@/lib/safe-return-path";
import { AppBootScreen } from "@/components/ui/LoadingFrame";
import { AppPreferencesProvider } from "./AppPreferencesContext";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { OrganizationsProvider } from "./OrganizationsProvider";
import { QueryProvider } from "./QueryProvider";

/** Session redirect + app preferences + organizations context for `/app` and `/<workspaceSlug|uuid>/…`. */
export function AppAuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { session, isSessionPending, sessionLost } = useApiSession();
  const { theme, setTheme } = useThemePreference();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (isSessionPending || session?.user) return;
    const candidate = pathname + (searchParams.toString() ? `?${searchParams}` : "");
    const next = safeReturnPath(candidate);
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [isSessionPending, session, router, pathname, searchParams]);

  if (isSessionPending) {
    return <AppBootScreen />;
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
        <p className="text-sm text-[var(--muted)]">Redirecting to sign in…</p>
      </div>
    );
  }

  // The API refused this session repeatedly. All traffic has stopped; only a fresh sign-in recovers.
  if (sessionLost) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--surface-base)] px-4 text-center">
        <p className="text-sm text-[var(--fg)]">Your session could not be verified.</p>
        <button
          type="button"
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-hover)]"
          onClick={() => {
            void authClient.signOut().finally(() => router.replace("/login"));
          }}
        >
          Sign in again
        </button>
      </div>
    );
  }

  return (
    <QueryProvider>
      <NetworkStatusBanner />
      <AppPreferencesProvider theme={theme} setTheme={setTheme}>
        <OrganizationsProvider>{children}</OrganizationsProvider>
      </AppPreferencesProvider>
    </QueryProvider>
  );
}
