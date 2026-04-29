"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

function WorkItemsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const levelPref = searchParams.get("level");
  const { token } = useApiSession();
  const { tasks, members, depts, error, setError, reload } = useWorkspaceData();
  const [title, setTitle] = useState("");
  const [deptId, setDeptId] = useState("");
  const [due, setDue] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (levelPref && depts.some((d) => d.id === levelPref)) {
      setDeptId(levelPref);
      return;
    }
    if (depts.length === 0) return;
    if (!deptId || !depts.some((d) => d.id === deptId)) {
      setDeptId(depts[0]!.id);
    }
  }, [depts, levelPref, deptId]);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createTask() {
    if (!token || !workspaceId || !title.trim() || !deptId) return;
    setError(null);
    try {
      const dueIso = due.trim() ? new Date(due).toISOString() : undefined;
      await apiJson(`/organizations/${workspaceId}/tasks`, {
        method: "POST",
        token,
        body: JSON.stringify({
          title: title.trim(),
          departmentId: deptId,
          assigneeUserIds: assigneeIds,
          ...(dueIso ? { dueAt: dueIso } : {}),
        }),
      });
      setTitle("");
      setDue("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create work item");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-10">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{NODE_LABELS.workItem}s</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Node 3 — tasks today; checklists and sub-items can attach here later without changing the hierarchy.
        </p>
      </div>
      <section className="surface-elevated space-y-4 rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">New work item</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-[var(--muted)]">Title</label>
            <input className="input rounded-xl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">{NODE_LABELS.level}</label>
            <select className="input rounded-xl" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">Due (optional)</label>
            <input className="input rounded-xl" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        {members.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-[var(--muted)]">Assignees</p>
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={assigneeIds.includes(m.userId)} onChange={() => toggleAssignee(m.userId)} />
                  <span>{m.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="button" className="btn-primary rounded-xl" onClick={() => void createTask()}>
          Create
        </button>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">All work items</h2>
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            None yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/w/${workspaceId}/work/${t.id}`}
                  className="surface-elevated flex flex-col rounded-xl border border-[var(--border-subtle)] px-4 py-3 shadow-sm transition-colors hover:border-[var(--accent)]/35 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="mt-1 text-xs text-[var(--muted)] sm:mt-0">
                    {t.status}
                    {t.dueAt ? ` · due ${new Date(t.dueAt).toISOString().slice(0, 10)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[var(--muted)]">Loading work items…</div>
      }
    >
      <WorkItemsInner />
    </Suspense>
  );
}
