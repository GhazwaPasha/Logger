"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { faLayerGroup, faListUl } from "@fortawesome/free-solid-svg-icons";
import {
  readWorkBoardScope,
  writeWorkBoardScope,
  WORK_BOARD_SCOPE_EVENT,
} from "@/lib/work-board-scope";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { apiJson, apiVoid } from "@/lib/api";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { SimpleContextMenu, type SimpleContextMenuItem } from "@/components/ui/SimpleContextMenu";
import { useApiSession } from "@/hooks/useApiSession";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import type { Dept, ListRow, TaskRow } from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import { workspaceKeys } from "@/lib/query-keys";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import { EmptyState } from "@/components/ui/EmptyState";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function rowBase(active: boolean, compact = false) {
  return [
    `flex min-w-0 items-center gap-1 rounded-md ${compact ? "py-0.5" : "py-1.5"} pr-2 text-left text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-out motion-safe:active:scale-[0.99]`,
    active ? "bg-[var(--accent-muted)] text-[var(--fg)]" : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
  ].join(" ");
}

const LIST_LAST_SEEN_PREFIX = "wl:list:lastSeen:";

function listLastSeenStorageKey(workspaceId: string, listId: string) {
  return `${LIST_LAST_SEEN_PREFIX}${workspaceId}:${listId}`;
}

export function WorkspaceSidebar({
  workspaceId,
  workspaceSlug,
  mobileOpen = false,
  onMobileClose,
}: {
  workspaceId: string;
  workspaceSlug: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, session } = useApiSession();
  const { orgs } = useOrganizationsState();
  const { depts, lists, tasks, members, setError, isLoading: workspaceLoading } = useWorkspaceData();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [orgTreeOpen, setOrgTreeOpen] = useState(true);
  const [newLevelName, setNewLevelName] = useState("");
  const [addingLevel, setAddingLevel] = useState(false);
  const [showAddLevelInput, setShowAddLevelInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showAddListForLevel, setShowAddListForLevel] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [renamingLevelId, setRenamingLevelId] = useState<string | null>(null);
  const [renameLevelDraft, setRenameLevelDraft] = useState("");
  const [renamingLevelBusy, setRenamingLevelBusy] = useState(false);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameListDraft, setRenameListDraft] = useState("");
  const [renamingListBusy, setRenamingListBusy] = useState(false);
  const [structureMenu, setStructureMenu] = useState<
    | null
    | { x: number; y: number; kind: "level"; deptId: string; name: string }
    | { x: number; y: number; kind: "list"; listId: string; deptId: string; name: string }
  >(null);
  const [structureActionConfirm, setStructureActionConfirm] = useState<ConfirmDialogOptions | null>(null);

  const base = `/${workspaceSlug}`;

  /** Matches API: only workspace owners may PATCH departments / lists (rename, create). */
  const canRenameOrgStructure = useMemo(() => {
    const uid = session?.user?.id;
    if (!uid) return false;
    return members.some((m) => m.userId === uid && m.role === "owner");
  }, [session?.user?.id, members]);

  const listsByLevel = useMemo(() => {
    const m = new Map<string, ListRow[]>();
    for (const d of depts) m.set(d.id, []);
    for (const l of lists) {
      const list = m.get(l.departmentId);
      if (list) list.push(l);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [lists, depts]);

  const tasksByList = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const l of lists) m.set(l.id, []);
    for (const t of tasks) {
      if (t.deletedAt) continue;
      const list = m.get(t.listId);
      if (list) list.push(t);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return m;
  }, [tasks, lists]);

  useEffect(() => {
    setExpanded((prev) => {
      const n = new Set(prev);
      for (const d of depts) n.add(d.id);
      return n;
    });
  }, [depts]);

  /** Newest task activity per list — drives the Discord-style unread highlight. */
  const latestActivityByListId = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      if (t.deletedAt) continue;
      const iso = t.lastLedger?.createdAt ?? t.updatedAt ?? t.createdAt;
      if (!iso) continue;
      const ts = new Date(iso).getTime();
      if (Number.isNaN(ts)) continue;
      if (ts > (m.get(t.listId) ?? 0)) m.set(t.listId, ts);
    }
    return m;
  }, [tasks]);

  const [listLastSeen, setListLastSeen] = useState<Record<string, number>>({});

  /** Hydrate per-list last-seen timestamps from localStorage as lists appear. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    setListLastSeen((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const l of lists) {
        if (next[l.id] != null) continue;
        const raw = localStorage.getItem(listLastSeenStorageKey(workspaceId, l.id));
        next[l.id] = raw && !Number.isNaN(Number(raw)) ? Number(raw) : 0;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [lists, workspaceId]);

  const markListSeen = useCallback(
    (listId: string) => {
      const ts = Date.now();
      if (typeof window !== "undefined") {
        localStorage.setItem(listLastSeenStorageKey(workspaceId, listId), String(ts));
      }
      setListLastSeen((prev) => ({ ...prev, [listId]: ts }));
    },
    [workspaceId],
  );

  const [boardScopeRev, setBoardScopeRev] = useState(0);
  useEffect(() => {
    const fn = () => setBoardScopeRev((x) => x + 1);
    window.addEventListener(WORK_BOARD_SCOPE_EVENT, fn);
    return () => window.removeEventListener(WORK_BOARD_SCOPE_EVENT, fn);
  }, []);
  const boardScope = useMemo(
    () => readWorkBoardScope(workspaceId),
    [workspaceId, boardScopeRev],
  );

  /** Keep the currently open list marked as seen while new activity arrives on it. */
  useEffect(() => {
    const activeListId = boardScope?.listId;
    if (!activeListId) return;
    const latest = latestActivityByListId.get(activeListId) ?? 0;
    if (latest > (listLastSeen[activeListId] ?? 0)) {
      markListSeen(activeListId);
    }
  }, [boardScope?.listId, latestActivityByListId, listLastSeen, markListSeen]);

  useEffect(() => {
    onMobileClose?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleLevel = useCallback((id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const activeDashboard = pathname === `${base}/dashboard`;
  const activeRoadmap = pathname.startsWith(`${base}/roadmap`);
  const activeCalendar = pathname.startsWith(`${base}/calendar`);
  const activeMyTasks = pathname.startsWith(`${base}/my-tasks`);
  const activePeople = pathname.startsWith(`${base}/people`);
  const activeOrganizationSettings = pathname.startsWith(`${base}/organization-settings`);
  const activeUserSettings = pathname.startsWith(`${base}/settings`);
  const activeWebhooks = pathname.startsWith(`${base}/webhooks`);
  const activeAddWorkspace = pathname.startsWith(`${base}/add-workspace`);
  const selectedOrg = orgs.find((o) => o.id === workspaceId) ?? null;
  /** Work page scoped to whole workspace (level/list live in sessionStorage, not the URL). */
  const activeAllWorkspaceTasks =
    pathname === `${base}/work` && boardScope?.levelId == null && boardScope?.listId == null;

  const userLabel = session?.user?.name?.trim() || session?.user?.email || "Account";
  const orgLabel = selectedOrg?.name ?? "Workspace";

  function switchWorkspace(nextId: string) {
    if (nextId === workspaceId) {
      setWorkspacePickerOpen(false);
      return;
    }
    const tail = pathname.replace(/^\/[^/]+/, "");
    const allowedTails = new Set([
      "/dashboard",
      "/roadmap",
      "/my-tasks",
      "/people",
      "/work",
      "/add-workspace",
      "/organization-settings",
      "/settings",
      "/webhooks",
    ]);
    const nextTail = allowedTails.has(tail) ? tail : "/dashboard";
    const nextOrg = orgs.find((o) => o.id === nextId);
    if (!nextOrg) return;
    setLastWorkspaceId(nextId);
    setWorkspacePickerOpen(false);
    router.push(`/${workspaceUrlSegment(nextOrg)}${nextTail}`);
  }

  async function addLevel() {
    if (!token || !newLevelName.trim() || addingLevel) return;
    setError(null);
    setAddingLevel(true);
    try {
      const created = await apiJson<Dept>(`/organizations/${workspaceId}/departments`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: newLevelName.trim() }),
      });
      setNewLevelName("");
      setShowAddLevelInput(false);
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        if (old.depts.some((d) => d.id === created.id)) return old;
        return {
          ...old,
          depts: [...old.depts, created].sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add level");
    } finally {
      setAddingLevel(false);
    }
  }

  async function addList(departmentId: string) {
    if (!token || !newListName.trim() || addingList) return;
    setError(null);
    setAddingList(true);
    try {
      const created = await apiJson<ListRow>(`/organizations/${workspaceId}/lists`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: newListName.trim(), departmentId }),
      });
      setNewListName("");
      setShowAddListForLevel(null);
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        if (old.lists.some((l) => l.id === created.id)) return old;
        return {
          ...old,
          lists: [...old.lists, created].sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add list");
    } finally {
      setAddingList(false);
    }
  }

  function cancelRenameLevel() {
    setRenamingLevelId(null);
    setRenameLevelDraft("");
  }

  function cancelRenameList() {
    setRenamingListId(null);
    setRenameListDraft("");
  }

  async function commitRenameLevel(deptId: string) {
    if (!token || renamingLevelBusy) return;
    const trimmed = renameLevelDraft.trim();
    const original = depts.find((x) => x.id === deptId)?.name ?? "";
    if (!trimmed || trimmed === original) {
      cancelRenameLevel();
      return;
    }
    setError(null);
    setRenamingLevelBusy(true);
    try {
      const updated = await apiJson<Dept>(`/organizations/${workspaceId}/departments/${deptId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: trimmed }),
      });
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          depts: old.depts
            .map((x) => (x.id === deptId ? updated : x))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      cancelRenameLevel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename level");
    } finally {
      setRenamingLevelBusy(false);
    }
  }

  async function deleteLevelById(deptId: string) {
    if (!token) return;
    setStructureMenu(null);
    setError(null);
    try {
      await apiVoid(`/organizations/${workspaceId}/departments/${deptId}`, { method: "DELETE", token });
      const scope = readWorkBoardScope(workspaceId);
      if (scope?.levelId === deptId) {
        writeWorkBoardScope(workspaceId, { levelId: null, listId: null });
        window.dispatchEvent(new Event(WORK_BOARD_SCOPE_EVENT));
      } else if (scope?.listId) {
        const scopedList = lists.find((l) => l.id === scope.listId);
        if (scopedList?.departmentId === deptId) {
          writeWorkBoardScope(workspaceId, { levelId: null, listId: null });
          window.dispatchEvent(new Event(WORK_BOARD_SCOPE_EVENT));
        }
      }
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete level");
    }
  }

  async function deleteListById(listId: string, deptId: string) {
    if (!token) return;
    setStructureMenu(null);
    setError(null);
    try {
      await apiVoid(`/organizations/${workspaceId}/lists/${listId}`, { method: "DELETE", token });
      const scope = readWorkBoardScope(workspaceId);
      if (scope?.listId === listId) {
        writeWorkBoardScope(workspaceId, { levelId: deptId, listId: null });
        window.dispatchEvent(new Event(WORK_BOARD_SCOPE_EVENT));
      }
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete list");
    }
  }

  async function commitRenameList(listId: string) {
    if (!token || renamingListBusy) return;
    const trimmed = renameListDraft.trim();
    const original = lists.find((x) => x.id === listId)?.name ?? "";
    if (!trimmed || trimmed === original) {
      cancelRenameList();
      return;
    }
    setError(null);
    setRenamingListBusy(true);
    try {
      const updated = await apiJson<ListRow>(`/organizations/${workspaceId}/lists/${listId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: trimmed }),
      });
      queryClient.setQueryData<WorkspaceBundle>(workspaceKeys.workspace(workspaceId), (old) => {
        if (!old) return old;
        return {
          ...old,
          lists: old.lists
            .map((x) => (x.id === listId ? updated : x))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      cancelRenameList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename list");
    } finally {
      setRenamingListBusy(false);
    }
  }

  const structureMenuItems: SimpleContextMenuItem[] =
    !structureMenu || !canRenameOrgStructure
      ? []
      : structureMenu.kind === "level"
        ? [
            {
              id: "delete-level",
              label: `Delete ${NODE_LABELS.level}`,
              destructive: true,
              onSelect: () => {
                const deptId = structureMenu.deptId;
                const name = structureMenu.name;
                setStructureActionConfirm({
                  title: `Delete this ${NODE_LABELS.level.toLowerCase()}?`,
                  description: `“${name}” and every list and task under it will be permanently removed.`,
                  confirmLabel: `Delete ${NODE_LABELS.level}`,
                  variant: "danger",
                  onConfirm: () => void deleteLevelById(deptId),
                });
              },
            },
          ]
        : [
            {
              id: "delete-list",
              label: "Delete list",
              destructive: true,
              onSelect: () => {
                const listId = structureMenu.listId;
                const deptId = structureMenu.deptId;
                const name = structureMenu.name;
                setStructureActionConfirm({
                  title: "Delete this list?",
                  description: `“${name}” and every task in it will be permanently removed.`,
                  confirmLabel: "Delete list",
                  variant: "danger",
                  onConfirm: () => void deleteListById(listId, deptId),
                });
              },
            },
          ];

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden
          onClick={onMobileClose}
        />
      )}
    <aside
      className={[
        "ui-sidebar-chrome font-outfit flex min-h-0 shrink-0 flex-col bg-[var(--surface-nav)]",
        "fixed inset-y-0 left-0 z-50 w-72 border-r border-[var(--border-subtle)] transition-transform duration-300 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:h-full md:w-72 md:translate-x-0 md:border-r md:border-[var(--border-subtle)] md:transition-none",
      ].join(" ")}
    >
      <ConfirmDialog
        open={structureActionConfirm != null}
        options={structureActionConfirm}
        onClose={() => setStructureActionConfirm(null)}
      />
      <SimpleContextMenu
        open={structureMenu != null && structureMenuItems.length > 0}
        x={structureMenu?.x ?? 0}
        y={structureMenu?.y ?? 0}
        items={structureMenuItems}
        onClose={() => setStructureMenu(null)}
      />
      <nav className="flex min-h-0 flex-1 flex-col" aria-label="Workspace tree">
        <div className="shrink-0 border-b border-[var(--border-subtle)] p-2">
          <button
            type="button"
            onClick={() => setWorkspacePickerOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-[background-color,transform] duration-200 ease-out hover:bg-[var(--surface-hover)] motion-safe:active:scale-[0.99]"
            aria-expanded={workspacePickerOpen}
            aria-label="Toggle workspace switcher"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--fg)]">{orgLabel}</p>
              <p className="truncate text-sm text-[var(--muted)]">{userLabel}</p>
            </div>
            <Chevron open={workspacePickerOpen} />
          </button>
          {workspacePickerOpen && (
            <div className="ui-dropdown-pop origin-top-left mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1 shadow-lg shadow-black/10 dark:shadow-black/40">
              <ul className="space-y-0.5">
                {orgs.map((o) => {
                  const active = o.id === workspaceId;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        className={`${rowBase(active)} w-full pl-2`}
                        onClick={() => switchWorkspace(o.id)}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="truncate">{o.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Link
                href={`${base}/add-workspace`}
                className={`${rowBase(activeAddWorkspace)} mt-1 block border-t border-[var(--border-subtle)] pl-2 pt-2`}
                onClick={() => setWorkspacePickerOpen(false)}
              >
                + Add workspace
              </Link>
            </div>
          )}
          <div className="mt-2 space-y-0.5 px-1">
            <Link href={`${base}/dashboard`} className={`${rowBase(activeDashboard)} pl-2`}>
              Dashboard
            </Link>
            <Link href={`${base}/roadmap`} className={`${rowBase(activeRoadmap)} pl-2`}>
              Roadmap
            </Link>
            <Link href={`${base}/calendar`} className={`${rowBase(activeCalendar)} pl-2`}>
              Calendar
            </Link>
            <Link href={`${base}/my-tasks`} className={`${rowBase(activeMyTasks)} pl-2`}>
              My tasks
            </Link>
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          <div className="mb-1 flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]">
            <Link
              href={`${base}/work`}
              className={`${rowBase(activeAllWorkspaceTasks)} flex min-w-0 flex-1 items-center pl-2`}
              title={`All ${NODE_LABELS.workItem.toLowerCase()}s in this workspace`}
              aria-current={activeAllWorkspaceTasks ? "page" : undefined}
              onClick={() => writeWorkBoardScope(workspaceId, { levelId: null, listId: null })}
            >
              <span className="truncate text-sm font-bold text-[var(--fg)]">All Tasks</span>
            </Link>
            <button
              type="button"
              className="shrink-0 rounded-md p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--accent-muted)] hover:text-[var(--fg)]"
              aria-expanded={orgTreeOpen}
              aria-label={orgTreeOpen ? "Collapse levels and lists" : "Expand levels and lists"}
              onClick={() => setOrgTreeOpen((v) => !v)}
            >
              <Chevron open={orgTreeOpen} />
            </button>
          </div>
          {orgTreeOpen &&
            (
              <div className="space-y-2">
                {workspaceLoading ? (
                  <LoadingFrame show className="rounded-lg px-2 py-1" aria-label="Loading levels">
                    <div className="space-y-2" aria-hidden>
                      <div className="h-8 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
                      <div className="h-8 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
                      <div className="h-8 w-4/5 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
                    </div>
                  </LoadingFrame>
                ) : depts.length === 0 ? (
                  <EmptyState icon={faLayerGroup} title="No levels yet." size="compact" />
                ) : (
                  <ul className="space-y-0.5">
                {depts.map((d) => {
                  const open = expanded.has(d.id);
                  const levelLists = listsByLevel.get(d.id) ?? [];
                  return (
                    <li key={d.id} className="select-none">
                      <div
                        className="group/level flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]"
                        onContextMenu={(e) => {
                          if (!canRenameOrgStructure || renamingLevelId === d.id) return;
                          e.preventDefault();
                          setStructureMenu({
                            x: e.clientX,
                            y: e.clientY,
                            kind: "level",
                            deptId: d.id,
                            name: d.name,
                          });
                        }}
                      >
                        {renamingLevelId === d.id ? (
                          <div
                            className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 ${
                              pathname === `${base}/work` &&
                              boardScope?.levelId === d.id &&
                              boardScope?.listId == null
                                ? "rounded-md bg-[var(--accent-muted)]"
                                : ""
                            }`}
                          >
                            <input
                              autoFocus
                              disabled={renamingLevelBusy}
                              className="input h-8 min-w-0 flex-1 rounded-lg px-2 text-sm font-semibold"
                              aria-label={`Rename ${NODE_LABELS.level}`}
                              value={renameLevelDraft}
                              onChange={(e) => setRenameLevelDraft(e.target.value)}
                              onBlur={() => {
                                if (renamingLevelBusy) return;
                                void commitRenameLevel(d.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void commitRenameLevel(d.id);
                                }
                                if (e.key === "Escape" && !renamingLevelBusy) {
                                  cancelRenameLevel();
                                }
                              }}
                            />
                            <span className="shrink-0 text-sm font-semibold text-[var(--muted)] tabular-nums">
                              {levelLists.length}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`flex min-w-0 flex-1 items-center rounded-md text-left ${
                              pathname === `${base}/work` &&
                              boardScope?.levelId === d.id &&
                              boardScope?.listId == null
                                ? "bg-[var(--accent-muted)] font-semibold text-[var(--fg)]"
                                : ""
                            }`}
                          >
                            <Link
                              href={`${base}/work`}
                              className="flex min-w-0 flex-1 items-center px-2 py-1.5 pr-1"
                              title={`Open ${d.name}`}
                              onClick={() => writeWorkBoardScope(workspaceId, { levelId: d.id, listId: null })}
                            >
                              <span className="truncate text-sm font-semibold text-[var(--fg)]">{d.name}</span>
                            </Link>
                            {canRenameOrgStructure && (
                              <button
                                type="button"
                                className="pointer-events-none shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover/level:pointer-events-auto group-hover/level:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-[var(--accent-muted)] hover:text-[var(--fg)]"
                                aria-label={`Rename ${NODE_LABELS.level} ${d.name}`}
                                title={`Rename ${NODE_LABELS.level}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRenamingListId(null);
                                  setRenameListDraft("");
                                  setRenamingLevelId(d.id);
                                  setRenameLevelDraft(d.name);
                                }}
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <Link
                              href={`${base}/work`}
                              tabIndex={-1}
                              aria-hidden
                              className="shrink-0 px-2 py-1.5 text-sm font-semibold text-[var(--muted)] tabular-nums hover:text-[var(--fg)]"
                              title={`Open ${d.name}`}
                              onClick={() => writeWorkBoardScope(workspaceId, { levelId: d.id, listId: null })}
                            >
                              {levelLists.length}
                            </Link>
                          </div>
                        )}
                        <button
                          type="button"
                          className="shrink-0 rounded-md p-2 text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--accent-muted)] hover:text-[var(--fg)]"
                          aria-expanded={open}
                          aria-label={open ? `Collapse ${d.name}` : `Expand ${d.name}`}
                          onClick={() => toggleLevel(d.id)}
                        >
                          <Chevron open={open} />
                        </button>
                      </div>
                      {open && (
                        <ul>
                          {levelLists.length === 0 ? (
                            <li className="py-1 pl-1">
                              <EmptyState icon={faListUl} title="No lists yet" size="compact" />
                            </li>
                          ) : (
                            levelLists.map((l) => {
                              const listTaskCount = (tasksByList.get(l.id) ?? []).length;
                              const isActiveList = boardScope?.listId === l.id;
                              const hasUnread =
                                !isActiveList &&
                                (latestActivityByListId.get(l.id) ?? 0) > (listLastSeen[l.id] ?? 0);
                              return (
                                <li key={l.id} className="relative">
                                  {hasUnread && (
                                    <span
                                      aria-hidden
                                      className="absolute -left-2 top-1/2 h-2 w-1 -translate-y-1/2 rounded-r-full bg-[var(--fg)]"
                                    />
                                  )}
                                  <div
                                    className="group/list flex w-full items-center gap-0.5"
                                    onContextMenu={(e) => {
                                      if (!canRenameOrgStructure || renamingListId === l.id) return;
                                      e.preventDefault();
                                      setStructureMenu({
                                        x: e.clientX,
                                        y: e.clientY,
                                        kind: "list",
                                        listId: l.id,
                                        deptId: d.id,
                                        name: l.name,
                                      });
                                    }}
                                  >
                                    {renamingListId === l.id ? (
                                      <div
                                        className={`${rowBase(boardScope?.listId === l.id, true)} flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1`}
                                      >
                                        <span className="shrink-0 text-[var(--muted)]">#</span>
                                        <input
                                          autoFocus
                                          disabled={renamingListBusy}
                                          className="input h-8 min-w-0 flex-1 rounded-lg px-2 text-sm font-semibold"
                                          aria-label="Rename list"
                                          value={renameListDraft}
                                          onChange={(e) => setRenameListDraft(e.target.value)}
                                          onBlur={() => {
                                            if (renamingListBusy) return;
                                            void commitRenameList(l.id);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                              void commitRenameList(l.id);
                                            }
                                            if (e.key === "Escape" && !renamingListBusy) {
                                              cancelRenameList();
                                            }
                                          }}
                                        />
                                        <span className="shrink-0 text-sm font-semibold text-[var(--muted)] tabular-nums">
                                          {listTaskCount}
                                        </span>
                                      </div>
                                    ) : (
                                      <div
                                        className={`${rowBase(boardScope?.listId === l.id, true)} flex min-w-0 flex-1 items-center pl-2`}
                                      >
                                        <Link
                                          href={`${base}/work`}
                                          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden py-1.5 pr-1"
                                          title={l.name}
                                          onClick={() => {
                                            writeWorkBoardScope(workspaceId, { levelId: d.id, listId: l.id });
                                            markListSeen(l.id);
                                          }}
                                        >
                                          <span className="shrink-0 text-[var(--muted)]">#</span>
                                          <span
                                            className={`min-w-0 truncate ${
                                              hasUnread
                                                ? "font-bold text-[var(--fg)]"
                                                : isActiveList
                                                  ? "font-semibold text-[var(--fg)]"
                                                  : "font-medium text-[var(--muted)]"
                                            }`}
                                          >
                                            {l.name}
                                          </span>
                                        </Link>
                                        {canRenameOrgStructure && (
                                          <button
                                            type="button"
                                            className="pointer-events-none shrink-0 rounded p-1 text-[var(--muted)] opacity-0 transition-opacity duration-150 group-hover/list:pointer-events-auto group-hover/list:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 hover:bg-[var(--accent-muted)] hover:text-[var(--fg)]"
                                            aria-label={`Rename list ${l.name}`}
                                            title="Rename list"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setRenamingLevelId(null);
                                              setRenameLevelDraft("");
                                              setRenamingListId(l.id);
                                              setRenameListDraft(l.name);
                                            }}
                                          >
                                            <PencilIcon className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                        <Link
                                          href={`${base}/work`}
                                          tabIndex={-1}
                                          aria-hidden
                                          className="shrink-0 py-1.5 pr-2 pl-1 text-sm font-semibold text-[var(--muted)] tabular-nums hover:text-[var(--fg)]"
                                          title={l.name}
                                          onClick={() => {
                                            writeWorkBoardScope(workspaceId, { levelId: d.id, listId: l.id });
                                            markListSeen(l.id);
                                          }}
                                        >
                                          {listTaskCount}
                                        </Link>
                                      </div>
                                    )}
                                  </div>
                                </li>
                              );
                            })
                          )}
                          <li className="py-1 pl-1">
                            {showAddListForLevel !== d.id ? (
                              <button
                                type="button"
                                disabled={addingList || addingLevel}
                                className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-45"
                                onClick={() => {
                                  setShowAddListForLevel(d.id);
                                  setNewListName("");
                                }}
                              >
                                + Add list
                              </button>
                            ) : (
                              <div
                                className="relative"
                                aria-busy={addingList && showAddListForLevel === d.id ? true : undefined}
                              >
                                <input
                                  autoFocus
                                  disabled={addingList && showAddListForLevel === d.id}
                                  className="input h-8 w-full rounded-lg px-2 py-1 pr-9 text-sm disabled:opacity-70"
                                  placeholder="Name your list"
                                  value={newListName}
                                  onChange={(e) => setNewListName(e.target.value)}
                                  onBlur={() => {
                                    if (addingList) return;
                                    const trimmed = newListName.trim();
                                    if (trimmed) {
                                      void addList(d.id);
                                      return;
                                    }
                                    setShowAddListForLevel(null);
                                    setNewListName("");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void addList(d.id);
                                    }
                                    if (e.key === "Escape" && !addingList) {
                                      setShowAddListForLevel(null);
                                      setNewListName("");
                                    }
                                  }}
                                />
                                {addingList && showAddListForLevel === d.id ? (
                                  <span
                                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                                    aria-hidden
                                  >
                                    <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </li>
                        </ul>
                      )}
                    </li>
                  );
                })}
                  </ul>
                )}
                <div className="px-2">
                  {!showAddLevelInput ? (
                    <button
                      type="button"
                      disabled={addingList || addingLevel}
                      className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => setShowAddLevelInput(true)}
                    >
                      + Add {NODE_LABELS.level}
                    </button>
                  ) : (
                    <div className="relative" aria-busy={addingLevel ? true : undefined}>
                      <input
                        autoFocus
                        disabled={addingLevel}
                        className="input h-8 w-full rounded-lg px-2 py-1 pr-9 text-sm disabled:opacity-70"
                        placeholder={`Name your ${NODE_LABELS.level.toLowerCase()}`}
                        value={newLevelName}
                        onChange={(e) => setNewLevelName(e.target.value)}
                        onBlur={() => {
                          if (addingLevel) return;
                          const trimmed = newLevelName.trim();
                          if (trimmed) {
                            void addLevel();
                            return;
                          }
                          setShowAddLevelInput(false);
                          setNewLevelName("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addLevel();
                          }
                          if (e.key === "Escape" && !addingLevel) {
                            setShowAddLevelInput(false);
                            setNewLevelName("");
                          }
                        }}
                      />
                      {addingLevel ? (
                        <span
                          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                          aria-hidden
                        >
                          <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="space-y-0.5 border-t border-[var(--border-subtle)] pt-1">
                  <Link href={`${base}/people`} className={`${rowBase(activePeople)} pl-2`}>
                    Team
                  </Link>
                  <Link href={`${base}/settings`} className={`${rowBase(activeUserSettings)} pl-2`}>
                    Your settings
                  </Link>
                  <Link href={`${base}/organization-settings`} className={`${rowBase(activeOrganizationSettings)} pl-2`}>
                    Organization settings
                  </Link>
                  <Link href={`${base}/webhooks`} className={`${rowBase(activeWebhooks)} pl-2`}>
                    Webhooks
                  </Link>
                </div>
              </div>
            )}
        </div>
      </nav>
    </aside>
    </>
  );
}
