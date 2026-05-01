"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { clearJwtCapture, getJwtCapturedFromGetSession } from "@/lib/auth-session-jwt-capture";

type ApiSessionContextValue = {
  session: ReturnType<typeof authClient.useSession>["data"];
  /** True while Better Auth session is loading (block routes that need login state). */
  isSessionPending: boolean;
  /** True while session is loading or JWT is still resolving for a logged-in user (safe for API calls). */
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
      clearJwtCapture();
      return;
    }
    setTokenResolved(false);
    let cancelled = false;
    void (async () => {
      const captured = getJwtCapturedFromGetSession();
      if (captured) {
        if (cancelled) return;
        setToken(captured);
        setTokenResolved(true);
        return;
      }
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

  const isSessionPending = sessionPending;
  const isPending = sessionPending || (Boolean(sessionUserId) && !tokenResolved);

  const value = useMemo<ApiSessionContextValue>(
    () => ({
      session,
      isSessionPending,
      isPending,
      token,
      refreshToken,
    }),
    [session, isSessionPending, isPending, token, refreshToken],
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
