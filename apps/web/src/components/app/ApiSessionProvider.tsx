"use client";

import type { SessionLostReason } from "@work-ledger/client-core";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { onSessionLost, tokenManager } from "@/lib/session";

type ApiSessionContextValue = {
  session: ReturnType<typeof authClient.useSession>["data"];
  /** True while Better Auth session is loading (block routes that need login state). */
  isSessionPending: boolean;
  /** True while session is loading or the first API token is still being minted. */
  isPending: boolean;
  /**
   * Readiness marker: non-null once this signed-in user can call the API. It changes only on
   * sign-in / sign-out — never on token renewal — so nothing re-renders or reconnects when the
   * credential rotates. API helpers ignore it; credentials live in `lib/session.ts`.
   */
  token: string | null;
  /** Set when the API will no longer accept this session; the app stops all traffic and asks to sign in. */
  sessionLost: SessionLostReason | null;
};

const ApiSessionContext = createContext<ApiSessionContextValue | null>(null);

export function ApiSessionProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionUserId = session?.user?.id ?? null;
  const [token, setToken] = useState<string | null>(null);
  const [tokenResolved, setTokenResolved] = useState(false);
  const [sessionLost, setSessionLost] = useState<SessionLostReason | null>(null);

  useEffect(() => onSessionLost(setSessionLost), []);

  useEffect(() => {
    tokenManager.reset();
    setSessionLost(null);
    setToken(null);
    if (!sessionUserId) {
      setTokenResolved(true);
      return;
    }
    setTokenResolved(false);
    let cancelled = false;
    tokenManager.getToken().then(
      (t) => {
        if (cancelled) return;
        setToken(t);
        setTokenResolved(true);
      },
      () => {
        if (cancelled) return;
        // Signed out server-side, or unreachable: re-check the Better Auth session so a dead one
        // redirects to login; a live one shows the session-lost screen via onSessionLost.
        void authClient.getSession();
        setTokenResolved(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const isPending = sessionPending || (Boolean(sessionUserId) && !tokenResolved);

  const value = useMemo<ApiSessionContextValue>(
    () => ({ session, isSessionPending: sessionPending, isPending, token, sessionLost }),
    [session, sessionPending, isPending, token, sessionLost],
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
