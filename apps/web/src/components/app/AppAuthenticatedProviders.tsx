"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useThemePreference } from "@/hooks/useThemePreference";
import { safeReturnPath } from "@/lib/safe-return-path";
import { AppBootScreen } from "@/components/ui/LoadingFrame";
import { AppPreferencesProvider } from "./AppPreferencesContext";
import { OrganizationsProvider } from "./OrganizationsProvider";
import { QueryProvider } from "./QueryProvider";

/** Session redirect + app preferences + organizations context for `/app` and `/<workspaceSlug|uuid>/…`. */
export function AppAuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { session, isSessionPending } = useApiSession();
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

  return (
    <QueryProvider>
      <AppPreferencesProvider theme={theme} setTheme={setTheme}>
        <OrganizationsProvider>{children}</OrganizationsProvider>
      </AppPreferencesProvider>
    </QueryProvider>
  );
}
