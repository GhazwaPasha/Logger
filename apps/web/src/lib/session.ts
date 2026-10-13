import { ApiClient, TokenManager, jwtExpiryMs, type SessionLostReason } from "@work-ledger/client-core";
import { authClient } from "@/lib/auth-client";
import { clearJwtCapture, getJwtCapturedFromGetSession } from "@/lib/auth-session-jwt-capture";

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:4000";
}

/** Fired after every API attempt with `{ reachable }`; `NetworkStatusBanner` listens to this. */
export const NETWORK_STATUS_EVENT = "wl:network-status";

function reportReachable(reachable: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NETWORK_STATUS_EVENT, { detail: { reachable } }));
}

/**
 * Mints an API JWT. `get-session` responses already carry one (`set-auth-jwt`); use it once while it
 * is still fresh, otherwise ask `/api/auth/token`. `null` means Better Auth has no session.
 */
async function mint(): Promise<string | null> {
  const captured = getJwtCapturedFromGetSession();
  clearJwtCapture();
  if (captured && jwtExpiryMs(captured) - Date.now() > 120_000) return captured;
  const { data, error } = await authClient.token();
  if (error) {
    if (error.status === 401) return null;
    throw new Error(error.message ?? "Could not mint an API token");
  }
  return data?.token ?? null;
}

type SessionLostListener = (reason: SessionLostReason) => void;
const sessionLostListeners = new Set<SessionLostListener>();

/** Subscribe to "this session can no longer talk to the API" — the UI asks the user to sign in again. */
export function onSessionLost(listener: SessionLostListener): () => void {
  sessionLostListeners.add(listener);
  return () => sessionLostListeners.delete(listener);
}

/** The browser's one credential owner. Never pass tokens around; ask this (or {@link apiClient}). */
export const tokenManager = new TokenManager({
  mint,
  onSessionLost: (reason) => {
    reportClientEvent("session_lost", reason);
    for (const l of sessionLostListeners) l(reason);
  },
});

/** Best-effort beacon so the API's alerting sees clients that deliberately went quiet. */
function reportClientEvent(type: "session_lost" | "realtime_stopped", reason: string) {
  if (typeof window === "undefined") return;
  void fetch(`${getApiBaseUrl()}/telemetry/client-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, reason, platform: "web" }),
    keepalive: true,
  }).catch(() => undefined);
}

export const apiClient = new ApiClient({
  baseUrl: getApiBaseUrl,
  tokens: tokenManager,
  fetchInit: { cache: "no-store" },
  onReachability: reportReachable,
});
