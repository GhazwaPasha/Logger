import { Suspense } from "react";
import { ApiSessionProvider } from "@/components/app/ApiSessionProvider";
import { AppWorkspaceGate } from "@/components/app/AppWorkspaceGate";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApiSessionProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--surface-base)]">
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          </div>
        }
      >
        <AppWorkspaceGate>{children}</AppWorkspaceGate>
      </Suspense>
    </ApiSessionProvider>
  );
}
