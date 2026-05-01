import { Suspense } from "react";
import { ApiSessionProvider } from "@/components/app/ApiSessionProvider";
import { AppAuthenticatedProviders } from "@/components/app/AppAuthenticatedProviders";
import { QueryProvider } from "@/components/app/QueryProvider";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApiSessionProvider>
      <QueryProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          </div>
        }
      >
        <AppAuthenticatedProviders>{children}</AppAuthenticatedProviders>
      </Suspense>
      </QueryProvider>
    </ApiSessionProvider>
  );
}
