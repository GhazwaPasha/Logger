"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { liveIsland } from "@/components/app/live-island";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrgActivityFeed } from "@/hooks/useOrgActivityFeed";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { LedgerLineDescription } from "@/components/tasks/LedgerLineDescription";
import type { OrgActivityLedgerRow } from "@/lib/ledger-types";
import { isLedgerEntryNotifiableToUser } from "@/lib/notification-eligibility";
import { isTaskCreatedNote, formatLogTimestamp } from "@/lib/task-activity-log";
import { subscribeWebPush } from "@/lib/web-push-client";

const NOTIF_PANEL_HEADER_ROW =
  "-mx-6 flex flex-col gap-2 border-b border-[var(--border-subtle)] px-6 pb-3 pt-0 sm:min-h-10 sm:flex-row sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-0";

const NOTIF_PANEL_HEADER_TITLE =
  "min-w-0 truncate text-sm font-semibold leading-tight tracking-tight text-[var(--fg)] sm:min-w-[6rem] sm:flex-1";

const NOTIF_PANEL_HEADER_RIGHT =
  "flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:shrink-0 sm:flex-nowrap sm:gap-2";

const NOTIF_PANEL_CLOSE_BTN =
  "btn-secondary shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium leading-none";

const LAST_SEEN_PREFIX = "wl:notif:lastSeen:";
const CLEARED_BEFORE_PREFIX = "wl:notif:clearedBefore:";
const PUSH_PERMISSION_KEY = "wl:push:permission";

function lastSeenStorageKey(workspaceId: string) {
  return `${LAST_SEEN_PREFIX}${workspaceId}`;
}

function clearedBeforeStorageKey(workspaceId: string) {
  return `${CLEARED_BEFORE_PREFIX}${workspaceId}`;
}

export type WorkspaceNotificationsContextValue = {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  unreadCount: number;
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
  const [clearedBeforeTs, setClearedBeforeTs] = useState(0);
  const pushSyncInFlightRef = useRef(false);

  const activityQuery = useOrgActivityFeed(
    token,
    workspaceId,
    Boolean(token && workspaceId && userId),
    45_000,
  );

  const assigneesByTaskId = useMemo(() => {
    const fromFeed = activityQuery.data?.assigneesByTaskId;
    if (fromFeed) return fromFeed;
    const fallback: Record<string, string[]> = {};
    for (const t of tasks) {
      fallback[t.id] = t.assigneeUserIds ?? [];
    }
    return fallback;
  }, [activityQuery.data?.assigneesByTaskId, tasks]);

  const notifiableEntries = useMemo(() => {
    const entries = activityQuery.data?.entries;
    if (!userId || !entries) return [];
    const list: OrgActivityLedgerRow[] = [];
    const tasksById = activityQuery.data?.tasksById;
    for (const e of entries) {
      if (isTaskCreatedNote(e)) continue;
      const assignees = assigneesByTaskId[e.taskId] ?? [];
      const assignerId =
        tasksById?.[e.taskId]?.assignerId ?? tasks.find((t) => t.id === e.taskId)?.assignerId ?? null;
      if (!isLedgerEntryNotifiableToUser(e, userId, assignees, assignerId)) continue;
      list.push(e);
    }
    return list;
  }, [activityQuery.data?.entries, activityQuery.data?.tasksById, userId, assigneesByTaskId, tasks]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lastSeenRaw = localStorage.getItem(lastSeenStorageKey(workspaceId));
    if (lastSeenRaw && !Number.isNaN(Number(lastSeenRaw))) {
      setLastSeenTs(Number(lastSeenRaw));
    } else {
      // Do not seed last-seen to "now" on first visit — that marks the entire existing feed as read
      // before the user opens the panel, so the bell badge stays at 0 while the panel still lists items.
      setLastSeenTs(0);
    }
    const clearedRaw = localStorage.getItem(clearedBeforeStorageKey(workspaceId));
    if (clearedRaw && !Number.isNaN(Number(clearedRaw))) {
      setClearedBeforeTs(Number(clearedRaw));
    } else {
      setClearedBeforeTs(0);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!panelOpen) return;
    const ts = Date.now();
    localStorage.setItem(lastSeenStorageKey(workspaceId), String(ts));
    setLastSeenTs(ts);
  }, [panelOpen, workspaceId]);

  const panelEntries = useMemo(() => {
    return notifiableEntries.filter((e) => new Date(e.createdAt).getTime() > clearedBeforeTs);
  }, [notifiableEntries, clearedBeforeTs]);

  const unreadCount = useMemo(() => {
    return panelEntries.filter((e) => new Date(e.createdAt).getTime() > lastSeenTs).length;
  }, [panelEntries, lastSeenTs]);

  const hydratedIdsRef = useRef<Set<string> | null>(null);

  const clearNotifications = useCallback(() => {
    const newest = panelEntries.reduce(
      (max, e) => Math.max(max, new Date(e.createdAt).getTime()),
      0,
    );
    const ts = Math.max(newest, Date.now());
    localStorage.setItem(clearedBeforeStorageKey(workspaceId), String(ts));
    localStorage.setItem(lastSeenStorageKey(workspaceId), String(ts));
    setClearedBeforeTs(ts);
    setLastSeenTs(ts);
    hydratedIdsRef.current = new Set(notifiableEntries.map((e) => e.id));
  }, [workspaceId, panelEntries, notifiableEntries]);

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
      liveIsland.info(taskTitle, {
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

  const syncWebPush = useCallback(
    async (opts: { requestPermission: boolean; notifyOnBlock?: boolean }) => {
      if (!token || !pushSupported || pushSyncInFlightRef.current) return;
      if (typeof window === "undefined") return;

      let permission = Notification.permission;
      if (permission === "denied") return;

      if (permission === "default" && opts.requestPermission) {
        permission = await Notification.requestPermission();
        if (permission !== "default") {
          localStorage.setItem(PUSH_PERMISSION_KEY, permission);
        }
      }

      if (permission !== "granted") {
        if (opts.notifyOnBlock && permission === "denied") {
          liveIsland.error("Notifications blocked", {
            description: "Allow notifications in your browser settings to get task alerts.",
          });
        }
        return;
      }

      pushSyncInFlightRef.current = true;
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;

        const ok = await subscribeWebPush(token);
        if (!ok) {
          liveIsland.error("Push unavailable", {
            description: "The server may not be configured for web push yet.",
          });
        }
      } catch (e) {
        liveIsland.error("Could not enable notifications", {
          description: e instanceof Error ? e.message : "Unknown error",
        });
      } finally {
        pushSyncInFlightRef.current = false;
      }
    },
    [token, pushSupported],
  );

  /** Ask for browser notification permission when entering a workspace (once while still `default`). */
  useEffect(() => {
    if (!token || !pushSupported) return;
    if (Notification.permission === "denied") return;
    if (Notification.permission === "granted") {
      void syncWebPush({ requestPermission: false });
      return;
    }
    if (localStorage.getItem(PUSH_PERMISSION_KEY)) return;
    void syncWebPush({ requestPermission: true, notifyOnBlock: true });
  }, [workspaceId, token, pushSupported, syncWebPush]);

  /** Fallback: some browsers only show the prompt after a user gesture (e.g. opening the bell). */
  useEffect(() => {
    if (!panelOpen || !token || !pushSupported) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PUSH_PERMISSION_KEY)) return;
    void syncWebPush({ requestPermission: true, notifyOnBlock: true });
  }, [panelOpen, token, pushSupported, syncWebPush]);

  const ctx = useMemo(
    (): WorkspaceNotificationsContextValue => ({
      panelOpen,
      setPanelOpen,
      unreadCount,
    }),
    [panelOpen, unreadCount],
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
                    <button
                      type="button"
                      className={NOTIF_PANEL_CLOSE_BTN}
                      disabled={panelEntries.length === 0}
                      onClick={clearNotifications}
                    >
                      Clear all
                    </button>
                    <button type="button" className={NOTIF_PANEL_CLOSE_BTN} onClick={() => setPanelOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>

                {activityQuery.isPending ? (
                  <p className="text-sm text-[var(--muted)]">Loading…</p>
                ) : activityQuery.error ? (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {(activityQuery.error as Error).message || "Could not load notifications"}
                  </p>
                ) : panelEntries.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">You are all caught up.</p>
                ) : (
                  <ul className="space-y-3">
                    {panelEntries.map((e) => {
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
