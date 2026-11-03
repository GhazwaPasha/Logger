"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NETWORK_STATUS_EVENT, getApiBaseUrl } from "@/lib/api";

/** Requests can still fail for a moment after the app returns, while the network wakes up. */
const RETURN_GRACE_MS = 5_000;

function isBackgrounded(): boolean {
  return document.hidden || !document.hasFocus();
}

/**
 * Small fixed banner for connectivity problems. Two independent signals:
 * - the browser's `online`/`offline` events (instant, but `onLine === true` doesn't prove the API is reachable);
 * - `apiFetch` reporting whether its last request got a response (catches "server down while wifi is fine").
 *
 * Failed requests don't count while the app is in the background or just back from it: browsers suspend
 * network activity there, so they say nothing about the server. A real outage keeps failing after the grace period.
 */
export function NetworkStatusBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const returnedAt = useRef(0);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => {
      setOffline(false);
      setUnreachable(false);
    };
    const onOffline = () => setOffline(true);
    const onStatus = (e: Event) => {
      const { reachable } = (e as CustomEvent<{ reachable: boolean }>).detail;
      if (!reachable && (isBackgrounded() || Date.now() - returnedAt.current < RETURN_GRACE_MS)) return;
      setUnreachable(!reachable);
    };
    const onForegroundChange = () => {
      if (isBackgrounded()) setUnreachable(false);
      else returnedAt.current = Date.now();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(NETWORK_STATUS_EVENT, onStatus);
    window.addEventListener("focus", onForegroundChange);
    window.addEventListener("blur", onForegroundChange);
    document.addEventListener("visibilitychange", onForegroundChange);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(NETWORK_STATUS_EVENT, onStatus);
      window.removeEventListener("focus", onForegroundChange);
      window.removeEventListener("blur", onForegroundChange);
      document.removeEventListener("visibilitychange", onForegroundChange);
    };
  }, []);

  if (!offline && !unreachable) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className="surface-elevated pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 shadow-lg dark:text-amber-100"
      >
        <span>
          {offline ? (
            "You're offline. Changes can't be saved until you reconnect."
          ) : process.env.NODE_ENV === "development" ? (
            // Locally this almost always means the API process isn't running (the web dev server alone can't serve data).
            <>
              Can&apos;t reach the API at <code className="font-mono text-xs">{getApiBaseUrl()}</code>. Start it with{" "}
              <code className="font-mono text-xs">npm run dev</code> (API + web), or wait if it&apos;s still starting.
            </>
          ) : (
            "Waiting for connection…"
          )}
        </span>
        {!offline && (
          <button
            type="button"
            className="btn-ghost shrink-0 text-xs"
            onClick={() => {
              setUnreachable(false);
              void qc.refetchQueries({ predicate: (q) => q.state.status === "error" });
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
