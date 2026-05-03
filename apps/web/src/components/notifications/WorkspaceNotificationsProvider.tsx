"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrgActivityFeed } from "@/hooks/useOrgActivityFeed";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { LedgerLineDescription } from "@/components/tasks/LedgerLineDescription";
import type { OrgActivityLedgerRow } from "@/lib/ledger-types";
import { isLedgerEntryNotifiableToUser } from "@/lib/notification-eligibility";
import { isTaskCreatedNote, formatLogTimestamp } from "@/lib/task-activity-log";
import { subscribeWebPush, unsubscribeWebPush } from "@/lib/web-push-client";

const NOTIF_PANEL_HEADER_ROW =
  "-mx-6 flex flex-col gap-2 border-b border-[var(--border-subtle)] px-6 pb-3 pt-0 sm:min-h-10 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-0";

const NOTIF_PANEL_HEADER_TITLE =
  "min-w-0 truncate text-sm font-semibold leading-tight tracking-tight text-[var(--fg)] sm:min-w-[6rem] sm:flex-1";

const NOTIF_PANEL_HEADER_RIGHT =
  "flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0 sm:flex-nowrap sm:gap-2";

const NOTIF_PANEL_CLOSE_BTN =
  "btn-secondary shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium leading-none";

const LAST_SEEN_PREFIX = "wl:notif:lastSeen:";

function lastSeenStorageKey(workspaceId: string) {
  return `${LAST_SEEN_PREFIX}${workspaceId}`;
}

export type WorkspaceNotificationsContextValue = {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  unreadCount: number;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
};

const WorkspaceNotificationsContext = createContext<WorkspaceNotificationsContextValue | null>(null);

export function useOptionalWorkspaceNotifications(): WorkspaceNotificationsContextValue | null {
  return useContext(WorkspaceNotificationsContext);
}

export function WorkspaceNotificationsProvider({ children }: { children: ReactNode }) {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const userId = session?.user?.id ?? null;
  const { tasks, members } = useWorkspaceData();

  const [panelOpen, setPanelOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState(0);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const activityQuery = useOrgActivityFeed(
    token,
    workspaceId,
    Boolean(token && workspaceId && userId),
    45_000,
  );

  const assigneesByTaskId = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of tasks) {
      m.set(t.id, t.assigneeUserIds ?? []);
    }
    return m;
  }, [tasks]);

  const notifiableEntries = useMemo(() => {
    const entries = activityQuery.data?.entries;
    if (!userId || !entries) return [];
    const list: OrgActivityLedgerRow[] = [];
    for (const e of entries) {
      if (isTaskCreatedNote(e)) continue;
      const assignees = assigneesByTaskId.get(e.taskId) ?? [];
      if (!isLedgerEntryNotifiableToUser(e, userId, assignees)) continue;
      list.push(e);
    }
    return list;
  }, [activityQuery.data, userId, assigneesByTaskId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = lastSeenStorageKey(workspaceId);
    const raw = localStorage.getItem(key);
    if (raw && !Number.isNaN(Number(raw))) {
      setLastSeenTs(Number(raw));
      return;
    }
    const now = Date.now();
    localStorage.setItem(key, String(now));
    setLastSeenTs(now);
  }, [workspaceId]);

  useEffect(() => {
    if (!panelOpen) return;
    const ts = Date.now();
    localStorage.setItem(lastSeenStorageKey(workspaceId), String(ts));
    setLastSeenTs(ts);
  }, [panelOpen, workspaceId]);

  const unreadCount = useMemo(() => {
    return notifiableEntries.filter((e) => new Date(e.createdAt).getTime() > lastSeenTs).length;
  }, [notifiableEntries, lastSeenTs]);

  const hydratedIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    hydratedIdsRef.current = null;
  }, [workspaceId]);

  useEffect(() => {
    if (!activityQuery.isFetched || !userId) return;

    if (hydratedIdsRef.current === null) {
      hydratedIdsRef.current = new Set(notifiableEntries.map((e) => e.id));
      return;
    }

    const known = hydratedIdsRef.current;
    for (const e of notifiableEntries) {
      if (known.has(e.id)) continue;
      known.add(e.id);
      if (typeof document === "undefined" || document.visibilityState !== "visible") continue;
      if (panelOpen) continue;

      const taskTitle = activityQuery.data?.tasksById[e.taskId]?.title ?? "Task";
      toast.info(taskTitle, {
        description: "New activity on a task you follow.",
        duration: 6500,
        action: {
          label: "Open",
          onClick: () => setPanelOpen(true),
        },
      });
    }
  }, [notifiableEntries, activityQuery.isFetched, activityQuery.data?.tasksById, userId, panelOpen]);

  const pushSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    if (!pushSupported) return;
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setPushSubscribed(Boolean(sub));
      } catch {
        if (!cancelled) setPushSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pushSupported]);

  const enablePush = useCallback(async () => {
    if (!token || !pushSupported) return;
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notifications blocked", {
          description: "Allow notifications in your browser settings to enable push.",
        });
        return;
      }
      const ok = await subscribeWebPush(token);
      setPushSubscribed(ok);
      if (ok) toast.success("Push enabled", { description: "You will get alerts for task activity." });
      else toast.error("Push unavailable", { description: "The server may not be configured for web push yet." });
    } catch (e) {
      toast.error("Could not enable push", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPushBusy(false);
    }
  }, [token, pushSupported]);

  const disablePush = useCallback(async () => {
    if (!token) return;
    setPushBusy(true);
    try {
      await unsubscribeWebPush(token);
      setPushSubscribed(false);
      toast.success("Push disabled");
    } catch (e) {
      toast.error("Could not disable push", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setPushBusy(false);
    }
  }, [token]);

  const ctx = useMemo(
    (): WorkspaceNotificationsContextValue => ({
      panelOpen,
      setPanelOpen,
      unreadCount,
      pushSupported,
      pushSubscribed,
      pushBusy,
      enablePush,
      disablePush,
    }),
    [panelOpen, unreadCount, pushSupported, pushSubscribed, pushBusy, enablePush, disablePush],
  );

  const basePath = `/${workspaceSlug}`;

  return (
    <WorkspaceNotificationsContext.Provider value={ctx}>
      {children}
      {mounted &&
        panelOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60]">
            <div
              className="absolute inset-0 bg-black/40"
              aria-hidden
              onClick={() => setPanelOpen(false)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              className="surface-elevated absolute right-0 top-0 z-10 flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[var(--border-subtle)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto p-6">
                <div className={NOTIF_PANEL_HEADER_ROW}>
                  <h2 className={NOTIF_PANEL_HEADER_TITLE}>Notifications</h2>
                  <div className={NOTIF_PANEL_HEADER_RIGHT}>
                    <button type="button" className={NOTIF_PANEL_CLOSE_BTN} onClick={() => setPanelOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  Updates on tasks where you are an assignee (plus assignment changes that involve you). Matches your
                  workspace activity feed, filtered for you.
                </p>

                {pushSupported ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Mobile web push</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Get system notifications when teammates update tasks you follow (requires permission).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pushSubscribed ? (
                        <button
                          type="button"
                          className="btn-secondary rounded-xl px-3 py-1.5 text-xs font-medium"
                          disabled={pushBusy}
                          onClick={() => void disablePush()}
                        >
                          {pushBusy ? "Working…" : "Turn off push"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary rounded-xl px-3 py-1.5 text-xs font-medium"
                          disabled={pushBusy}
                          onClick={() => void enablePush()}
                        >
                          {pushBusy ? "Working…" : "Enable push"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {activityQuery.isPending ? (
                  <p className="text-sm text-[var(--muted)]">Loading…</p>
                ) : activityQuery.error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {(activityQuery.error as Error).message || "Could not load notifications"}
                  </p>
                ) : notifiableEntries.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">You are all caught up.</p>
                ) : (
                  <ul className="space-y-3">
                    {notifiableEntries.map((e) => {
                      const title = activityQuery.data?.tasksById[e.taskId]?.title ?? "Task";
                      const href = `${basePath}/work?task=${encodeURIComponent(e.taskId)}`;
                      return (
                        <li key={e.id}>
                          <Link
                            href={href}
                            className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/30 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                            onClick={() => setPanelOpen(false)}
                          >
                            <p className="text-xs font-medium text-[var(--fg)]">{title}</p>
                            <p className="mt-1 font-mono-ledger text-[12px] leading-snug text-[var(--fg)]">
                              <span className="text-[var(--muted)]">{formatLogTimestamp(e.createdAt)}</span>
                              <span className="text-[var(--muted)]"> · </span>
                              <LedgerLineDescription entry={e} members={members} />
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </WorkspaceNotificationsContext.Provider>
  );
}
