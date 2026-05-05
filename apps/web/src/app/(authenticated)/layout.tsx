import { Suspense } from "react";
import { ApiSessionProvider } from "@/components/app/ApiSessionProvider";
import { AppAuthenticatedProviders } from "@/components/app/AppAuthenticatedProviders";
import { AppSectionSuspenseFallback } from "@/components/app/AppSectionSuspenseFallback";
import { QueryProvider } from "@/components/app/QueryProvider";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApiSessionProvider>
      <QueryProvider>
      <Suspense fallback={<AppSectionSuspenseFallback />}>
        <AppAuthenticatedProviders>{children}</AppAuthenticatedProviders>
      </Suspense>
      </QueryProvider>
    </ApiSessionProvider>
  );
}
