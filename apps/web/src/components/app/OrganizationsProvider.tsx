"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizations } from "@/hooks/useOrganizations";

type OrganizationsState = ReturnType<typeof useOrganizations>;

const OrganizationsContext = createContext<OrganizationsState | null>(null);

export function OrganizationsProvider({ children }: { children: ReactNode }) {
  const { token } = useApiSession();
  const value = useOrganizations(token);
  return <OrganizationsContext.Provider value={value}>{children}</OrganizationsContext.Provider>;
}

export function useOrganizationsState(): OrganizationsState {
  const ctx = useContext(OrganizationsContext);
  if (!ctx) {
    throw new Error("useOrganizationsState must be used within OrganizationsProvider");
  }
  return ctx;
}
