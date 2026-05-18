import { Suspense } from "react";
import { ApiSessionProvider } from "@/components/app/ApiSessionProvider";
import { AppAuthenticatedProviders } from "@/components/app/AppAuthenticatedProviders";
import { AppSectionSuspenseFallback } from "@/components/app/AppSectionSuspenseFallback";

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApiSessionProvider>
      <Suspense fallback={<AppSectionSuspenseFallback />}>
        <AppAuthenticatedProviders>{children}</AppAuthenticatedProviders>
      </Suspense>
    </ApiSessionProvider>
  );
}
