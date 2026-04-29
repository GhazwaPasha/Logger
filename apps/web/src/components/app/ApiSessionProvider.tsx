"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

type ApiSessionContextValue = {
  session: ReturnType<typeof authClient.useSession>["data"];
  isPending: boolean;
  token: string | null;
  refreshToken: () => Promise<void>;
};

const ApiSessionContext = createContext<ApiSessionContextValue | null>(null);

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionUserId = session?.user?.id ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [tokenResolved, setTokenResolved] = useState(false);

  const refreshToken = useCallback(async () => {
    const { data, error } = await authClient.token();
    if (error) {
      setToken(null);
      return;
    }
    setToken(data?.token ?? null);
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setToken(null);
      setTokenResolved(true);
      return;
    }
    setTokenResolved(false);
    let cancelled = false;
    void (async () => {
      const { data, error } = await authClient.token();
      if (cancelled) return;
      if (error) setToken(null);
      else setToken(data?.token ?? null);
      setTokenResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const isPending = sessionPending || (Boolean(sessionUserId) && !tokenResolved);

  const value = useMemo<ApiSessionContextValue>(
    () => ({
      session,
      isPending,
      token,
      refreshToken,
    }),
    [session, isPending, token, refreshToken],
  );

  return <ApiSessionContext.Provider value={value}>{children}</ApiSessionContext.Provider>;
}

export function useApiSession(): ApiSessionContextValue {
  const ctx = useContext(ApiSessionContext);
  if (!ctx) {
    throw new Error("useApiSession must be used within ApiSessionProvider");
  }
  return ctx;
}
