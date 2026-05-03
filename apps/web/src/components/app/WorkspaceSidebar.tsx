"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readWorkBoardScope,
  writeWorkBoardScope,
  WORK_BOARD_SCOPE_EVENT,
} from "@/lib/work-board-scope";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import type { Dept, ListRow, TaskRow } from "@/lib/ledger-types";
import type { WorkspaceBundle } from "@/hooks/useOrgWorkspace";
import { workspaceKeys } from "@/lib/query-keys";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";

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

function rowBase(active: boolean) {
  return [
    "flex min-w-0 items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm font-semibold transition-colors",
    active ? "bg-[var(--accent-muted)] text-[var(--fg)]" : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
  ].join(" ");
}

export function WorkspaceSidebar({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
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

  const toggleLevel = useCallback((id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const activeDashboard = pathname === `${base}/dashboard`;
  const activeMyTasks = pathname.startsWith(`${base}/my-tasks`);
  const activePeople = pathname.startsWith(`${base}/people`);
  const activeOrganizationSettings = pathname.startsWith(`${base}/organization-settings`);
  const activeUserSettings = pathname.startsWith(`${base}/settings`);
  const activeAddWorkspace = pathname.startsWith(`${base}/add-workspace`);
  const selectedOrg = orgs.find((o) => o.id === workspaceId) ?? null;
  /** Work page scoped to whole workspace (level/list live in sessionStorage, not the URL). */
  const activeAllWorkspaceTasks =
    pathname === `${base}/work` && boardScope?.levelId == null && boardScope?.listId == null;

  const userLabel = session?.user?.name?.trim() || session?.user?.email || "Account";
  const userSubLabel = session?.user?.email && session.user.name ? session.user.email : null;

  function switchWorkspace(nextId: string) {
    if (nextId === workspaceId) {
      setWorkspacePickerOpen(false);
      return;
    }
    const tail = pathname.replace(/^\/[^/]+/, "");
    const allowedTails = new Set([
      "/dashboard",
      "/my-tasks",
      "/people",
      "/work",
      "/add-workspace",
      "/organization-settings",
      "/settings",
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

  return (
    <aside className="font-outfit flex max-h-[min(70dvh,28rem)] min-h-0 w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-nav)] md:max-h-none md:h-full md:w-72 md:border-b-0 md:border-r">
      <nav className="flex min-h-0 flex-1 flex-col" aria-label="Workspace tree">
        <div className="shrink-0 border-b border-[var(--border-subtle)] p-2">
          <button
            type="button"
            onClick={() => setWorkspacePickerOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
            aria-expanded={workspacePickerOpen}
            aria-label="Toggle workspace switcher"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--fg)]">{userLabel}</p>
              {userSubLabel && <p className="truncate text-sm text-[var(--muted)]">{userSubLabel}</p>}
            </div>
            <Chevron open={workspacePickerOpen} />
          </button>
          {workspacePickerOpen && (
            <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
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
            <Link href={`${base}/my-tasks`} className={`${rowBase(activeMyTasks)} pl-2`}>
              My tasks
            </Link>
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-2">
          <div className="mb-1 flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]">
            <Link
              href={`${base}/work`}
              className={`${rowBase(activeAllWorkspaceTasks)} flex min-w-0 flex-1 items-center pl-2`}
              title={`All ${NODE_LABELS.workItem.toLowerCase()}s in this workspace`}
              aria-current={activeAllWorkspaceTasks ? "page" : undefined}
              onClick={() => writeWorkBoardScope(workspaceId, { levelId: null, listId: null })}
            >
              <span className="truncate text-sm font-bold text-[var(--fg)]">
                {selectedOrg?.name ?? NODE_LABELS.workspace}
              </span>
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
                  <p className="px-2 text-sm leading-relaxed text-[var(--muted)]">Loading levels…</p>
                ) : depts.length === 0 ? (
                  <p className="px-2 text-sm leading-relaxed text-[var(--muted)]">No levels yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                {depts.map((d) => {
                  const open = expanded.has(d.id);
                  const levelLists = listsByLevel.get(d.id) ?? [];
                  return (
                    <li key={d.id} className="select-none">
                      <div className="group/level flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]">
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
                              className="flex min-w-0 flex-1 items-center px-2 py-2 pr-1"
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
                              className="shrink-0 px-2 py-2 text-sm font-semibold text-[var(--muted)] tabular-nums hover:text-[var(--fg)]"
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
                        <ul className="ml-4 border-l border-[var(--border-subtle)] pl-2">
                          {levelLists.length === 0 ? (
                            <li className="py-1 pl-1 text-sm text-[var(--muted)]">Empty</li>
                          ) : (
                            levelLists.map((l) => {
                              const listTaskCount = (tasksByList.get(l.id) ?? []).length;
                              return (
                                <li key={l.id}>
                                  <div className="group/list flex w-full items-center gap-0.5">
                                    {renamingListId === l.id ? (
                                      <div
                                        className={`${rowBase(boardScope?.listId === l.id)} flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1`}
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
                                        className={`${rowBase(boardScope?.listId === l.id)} flex min-w-0 flex-1 items-center pl-2`}
                                      >
                                        <Link
                                          href={`${base}/work`}
                                          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden py-1.5 pr-1"
                                          title={l.name}
                                          onClick={() =>
                                            writeWorkBoardScope(workspaceId, { levelId: d.id, listId: l.id })
                                          }
                                        >
                                          <span className="shrink-0 text-[var(--muted)]">#</span>
                                          <span className="min-w-0 truncate">{l.name}</span>
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
                                          onClick={() =>
                                            writeWorkBoardScope(workspaceId, { levelId: d.id, listId: l.id })
                                          }
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
                                className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                                onClick={() => {
                                  setShowAddListForLevel(d.id);
                                  setNewListName("");
                                }}
                              >
                                + Add list
                              </button>
                            ) : (
                              <input
                                autoFocus
                                className="input h-8 w-full rounded-lg px-2 text-sm"
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
                      className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
                      onClick={() => setShowAddLevelInput(true)}
                    >
                      + Add {NODE_LABELS.level}
                    </button>
                  ) : (
                    <input
                      autoFocus
                      className="input h-8 w-full rounded-lg px-2 text-sm"
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
                </div>
              </div>
            )}
        </div>
      </nav>
    </aside>
  );
}
