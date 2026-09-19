"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NETWORK_STATUS_EVENT } from "@/lib/api";

/**
 * Small fixed banner for connectivity problems. Two independent signals:
 * - the browser's `online`/`offline` events (instant, but `onLine === true` doesn't prove the API is reachable);
 * - `apiFetch` reporting whether its last request got a response (catches "server down while wifi is fine").
 */
export function NetworkStatusBanner() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => {
      setOffline(false);
      setUnreachable(false);
    };
    const onOffline = () => setOffline(true);
    const onStatus = (e: Event) => setUnreachable(!(e as CustomEvent<{ reachable: boolean }>).detail.reachable);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(NETWORK_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(NETWORK_STATUS_EVENT, onStatus);
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
        <span>{offline ? "You're offline. Changes can't be saved until you reconnect." : "Can't reach the server."}</span>
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
