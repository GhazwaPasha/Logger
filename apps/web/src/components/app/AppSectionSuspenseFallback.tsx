"use client";

import { LoadingScreen } from "@/components/ui/LoadingFrame";

export function AppSectionSuspenseFallback() {
  return <LoadingScreen label="Loading…" />;
}
