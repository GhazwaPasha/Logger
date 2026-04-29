"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NODE_LABELS } from "@/lib/nodes";
import type { Org, TaskRow } from "@/lib/ledger-types";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";

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
  workspaces,
}: {
  workspaceId: string;
  workspaces: Org[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { depts, tasks } = useWorkspaceData();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const base = `/app/w/${workspaceId}`;

  const tasksByLevel = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const d of depts) m.set(d.id, []);
    for (const t of tasks) {
      if (t.deletedAt) continue;
      const list = m.get(t.departmentId);
      if (list) list.push(t);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return m;
  }, [tasks, depts]);

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

  function switchWorkspace(nextId: string) {
    const tail = pathname.replace(/^\/app\/w\/[^/]+/, "") || "/overview";
    router.push(`/app/w/${nextId}${tail}`);
  }

  const activeOverview = pathname === `${base}/overview`;
  const activePeople = pathname.startsWith(`${base}/people`);
  const activeLevels = pathname.startsWith(`${base}/levels`);
  const activeWorkList = pathname === `${base}/work`;

  return (
    <aside className="flex max-h-[70vh] min-h-0 w-full shrink-0 flex-col border-b border-[var(--border-subtle)] bg-[var(--surface-nav)] md:max-h-none md:h-[calc(100vh-3.5rem)] md:w-72 md:border-b-0 md:border-r">
      <div className="shrink-0 border-b border-[var(--border-subtle)] p-3">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {NODE_LABELS.workspace}
        </label>
        <select
          className="input w-full rounded-lg py-2 text-sm"
          value={workspaceId}
          onChange={(e) => switchWorkspace(e.target.value)}
        >
          {workspaces.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Link
          href="/app/workspaces"
          className="mt-2 block text-center text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
        >
          All workspaces →
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Workspace tree">
        <div className="shrink-0 space-y-0.5 border-b border-[var(--border-subtle)] px-2 py-2">
          <Link href={`${base}/overview`} className={`${rowBase(activeOverview)} pl-2`}>
            Overview
          </Link>
          <Link href={`${base}/people`} className={`${rowBase(activePeople)} pl-2`}>
            People
          </Link>
          <Link href={`${base}/work`} className={`${rowBase(activeWorkList)} pl-2`}>
            All {NODE_LABELS.workItem}s
          </Link>
          <Link href={`${base}/levels`} className={`${rowBase(activeLevels)} pl-2 text-[var(--muted)] hover:text-[var(--fg)]`}>
            + Manage {NODE_LABELS.level}s
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {NODE_LABELS.level}s &amp; {NODE_LABELS.workItem}s
          </p>
          {depts.length === 0 ? (
            <p className="px-2 text-xs leading-relaxed text-[var(--muted)]">
              No levels yet.{" "}
              <Link href={`${base}/levels`} className="text-[var(--accent)] underline-offset-2 hover:underline">
                Add one
              </Link>
            </p>
          ) : (
            <ul className="space-y-0.5">
              {depts.map((d) => {
                const open = expanded.has(d.id);
                const levelTasks = tasksByLevel.get(d.id) ?? [];
                return (
                  <li key={d.id} className="select-none">
                    <div className={`flex items-stretch gap-0 ${rowBase(false)} p-0`}>
                      <button
                        type="button"
                        className="flex w-7 shrink-0 items-center justify-center rounded-l-md text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                        aria-expanded={open}
                        aria-label={open ? "Collapse" : "Expand"}
                        onClick={() => toggleLevel(d.id)}
                      >
                        <Chevron open={open} />
                      </button>
                      <Link
                        href={`${base}/work?level=${encodeURIComponent(d.id)}`}
                        className="flex min-w-0 flex-1 items-center rounded-r-md py-1.5 pl-1 pr-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-hover)]"
                        title={`Open ${NODE_LABELS.workItem}s for ${d.name}`}
                      >
                        <span className="truncate">{d.name}</span>
                        <span className="ml-auto shrink-0 pl-2 text-xs font-normal text-[var(--muted)] tabular-nums">
                          {levelTasks.length}
                        </span>
                      </Link>
                    </div>
                    {open && (
                      <ul className="ml-4 border-l border-[var(--border-subtle)] pl-2">
                        {levelTasks.length === 0 ? (
                          <li className="py-1 pl-1 text-xs text-[var(--muted)]">Empty</li>
                        ) : (
                          levelTasks.map((t) => {
                            const active = pathname === `${base}/work/${t.id}`;
                            return (
                              <li key={t.id}>
                                <Link
                                  href={`${base}/work/${t.id}`}
                                  className={`${rowBase(active)} block w-full truncate pl-2`}
                                  title={t.title}
                                >
                                  <span className="mr-1.5 text-[var(--muted)]">·</span>
                                  {t.title}
                                </Link>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
    </aside>
  );
}
