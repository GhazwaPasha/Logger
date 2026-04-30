"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { NODE_LABELS } from "@/lib/nodes";
import { authClient } from "@/lib/auth-client";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import type { ListRow, TaskRow } from "@/lib/ledger-types";
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

function rowBase(active: boolean) {
  return [
    "flex min-w-0 items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm transition-colors",
    active ? "bg-[var(--accent-muted)] font-medium text-[var(--fg)]" : "text-[var(--fg)] hover:bg-[var(--surface-hover)]",
  ].join(" ");
}

export function WorkspaceSidebar({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useApiSession();
  const { data: session } = authClient.useSession();
  const { orgs } = useOrganizationsState();
  const { depts, lists, tasks, setError, reload } = useWorkspaceData();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [orgTreeOpen, setOrgTreeOpen] = useState(true);
  const [newLevelName, setNewLevelName] = useState("");
  const [addingLevel, setAddingLevel] = useState(false);
  const [showAddLevelInput, setShowAddLevelInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showAddListForLevel, setShowAddListForLevel] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);

  const base = `/app/w/${workspaceId}`;

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
  const activeAddOrganization = pathname.startsWith(`${base}/add-organization`);
  const selectedOrg = orgs.find((o) => o.id === workspaceId) ?? null;
  /** Work page with full board scope (no level/list filters in URL). */
  const activeAllWorkspaceTasks =
    pathname === `${base}/work` &&
    !searchParams.get("level") &&
    !searchParams.get("list");

  const userLabel = session?.user?.name?.trim() || session?.user?.email || "Account";
  const userSubLabel = session?.user?.email && session.user.name ? session.user.email : null;

  function switchWorkspace(nextId: string) {
    if (nextId === workspaceId) {
      setWorkspacePickerOpen(false);
      return;
    }
    const tail = pathname.replace(/^\/app\/w\/[^/]+/, "");
    const allowedTails = new Set(["/dashboard", "/my-tasks", "/people", "/work", "/add-organization", "/organization-settings"]);
    const nextTail = allowedTails.has(tail) ? tail : "/dashboard";
    setLastWorkspaceId(nextId);
    setWorkspacePickerOpen(false);
    router.push(`/app/w/${nextId}${nextTail}`);
  }

  async function addLevel() {
    if (!token || !newLevelName.trim() || addingLevel) return;
    setError(null);
    setAddingLevel(true);
    try {
      await apiJson(`/organizations/${workspaceId}/departments`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: newLevelName.trim() }),
      });
      setNewLevelName("");
      setShowAddLevelInput(false);
      await reload();
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
      await apiJson(`/organizations/${workspaceId}/lists`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: newListName.trim(), departmentId }),
      });
      setNewListName("");
      setShowAddListForLevel(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add list");
    } finally {
      setAddingList(false);
    }
  }

  return (
    <aside className="flex max-h-[70vh] min-h-0 w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-nav)] md:max-h-none md:h-[calc(100vh-3.5rem)] md:w-72 md:border-b-0 md:border-r">
      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Workspace tree">
        <div className="shrink-0 border-b border-[var(--border-subtle)] p-2">
          <button
            type="button"
            onClick={() => setWorkspacePickerOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
            aria-expanded={workspacePickerOpen}
            aria-label="Toggle workspace switcher"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--fg)]">{userLabel}</p>
              {userSubLabel && <p className="truncate text-xs text-[var(--muted)]">{userSubLabel}</p>}
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
                href={`${base}/add-organization`}
                className={`${rowBase(activeAddOrganization)} mt-1 block border-t border-[var(--border-subtle)] pl-2 pt-2`}
                onClick={() => setWorkspacePickerOpen(false)}
              >
                + Add organization
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

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <div className="mb-1 flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]">
            <Link
              href={`${base}/work`}
              className={`${rowBase(activeAllWorkspaceTasks)} flex min-w-0 flex-1 items-center pl-2`}
              title={`All ${NODE_LABELS.workItem.toLowerCase()}s in this workspace`}
              aria-current={activeAllWorkspaceTasks ? "page" : undefined}
            >
              <span className="truncate text-sm font-semibold text-[var(--fg)]">
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
                {depts.length === 0 ? (
                  <p className="px-2 text-xs leading-relaxed text-[var(--muted)]">No levels yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                {depts.map((d) => {
                  const open = expanded.has(d.id);
                  const levelLists = listsByLevel.get(d.id) ?? [];
                  return (
                    <li key={d.id} className="select-none">
                      <div className="flex w-full items-center gap-0.5 rounded-md hover:bg-[var(--surface-hover)]">
                        <Link
                          href={`${base}/work?level=${encodeURIComponent(d.id)}`}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                          title={`Open ${d.name}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--fg)]">{d.name}</p>
                          </div>
                          <span className="shrink-0 text-xs font-normal text-[var(--muted)] tabular-nums">
                            {levelLists.length}
                          </span>
                        </Link>
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
                            <li className="py-1 pl-1 text-xs text-[var(--muted)]">Empty</li>
                          ) : (
                            levelLists.map((l) => {
                              const listTaskCount = (tasksByList.get(l.id) ?? []).length;
                              return (
                                <li key={l.id}>
                                  <Link
                                    href={`${base}/work?level=${encodeURIComponent(d.id)}&list=${encodeURIComponent(l.id)}`}
                                    className={`${rowBase(false)} flex w-full items-center truncate pl-2`}
                                    title={l.name}
                                  >
                                    <span className="mr-1.5 text-[var(--muted)]">#</span>
                                    <span className="truncate">{l.name}</span>
                                    <span className="ml-auto shrink-0 pl-2 text-xs font-normal text-[var(--muted)] tabular-nums">
                                      {listTaskCount}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })
                          )}
                          <li className="py-1 pl-1">
                            {showAddListForLevel !== d.id ? (
                              <button
                                type="button"
                                className="text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
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
                                className="input h-8 w-full rounded-lg px-2 text-xs"
                                placeholder="Name your list"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                onBlur={() => {
                                  if (!addingList) {
                                    setShowAddListForLevel(null);
                                    setNewListName("");
                                  }
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
                      className="text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
                      onClick={() => setShowAddLevelInput(true)}
                    >
                      + Add {NODE_LABELS.level}
                    </button>
                  ) : (
                    <input
                      autoFocus
                      className="input h-8 w-full rounded-lg px-2 text-xs"
                      placeholder={`Name your ${NODE_LABELS.level.toLowerCase()}`}
                      value={newLevelName}
                      onChange={(e) => setNewLevelName(e.target.value)}
                      onBlur={() => {
                        if (!addingLevel) {
                          setShowAddLevelInput(false);
                          setNewLevelName("");
                        }
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
