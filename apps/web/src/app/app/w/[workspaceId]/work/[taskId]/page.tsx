"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function WorkItemDetailPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const taskId = params.taskId as string;
  const { token } = useApiSession();
  const { depts, reload: reloadOrg } = useWorkspaceData();
  const { detail, error, setError, reload } = useTaskDetail(token, taskId);
  const [logBody, setLogBody] = useState('{"message":"Acknowledged."}');
  const [logType, setLogType] = useState<"ack" | "note" | "status_change">("note");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (detail?.task.dueAt) setRescheduleAt(detail.task.dueAt.slice(0, 16));
  }, [detail?.task.dueAt, detail?.task.id]);

  const deptName =
    detail && depts.length
      ? depts.find((x) => x.id === detail.task.departmentId)?.name ?? detail.task.departmentId
      : "";

  async function appendLog() {
    if (!token) return;
    setError(null);
    try {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(logBody) as Record<string, unknown>;
      } catch {
        throw new Error("Log payload must be valid JSON");
      }
      await apiJson(`/tasks/${taskId}/ledger`, {
        method: "POST",
        token,
        body: JSON.stringify({ type: logType, payload }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to append log");
    }
  }

  async function reschedule() {
    if (!token || !rescheduleReason.trim()) return;
    setError(null);
    try {
      const iso = rescheduleAt ? new Date(rescheduleAt).toISOString() : new Date().toISOString();
      await apiJson(`/tasks/${taskId}/reschedule`, {
        method: "POST",
        token,
        body: JSON.stringify({ newDueAt: iso, reason: rescheduleReason }),
      });
      setRescheduleReason("");
      await reload();
      await reloadOrg();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  async function archive() {
    if (!token) return;
    if (!confirm("Archive this work item? (assigner only — soft delete)")) return;
    setError(null);
    try {
      await apiJson(`/tasks/${taskId}/archive`, { method: "POST", token });
      await reload();
      await reloadOrg();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
    }
  }

  async function downloadPdf() {
    if (!token) return;
    const res = await apiFetch(`/tasks/${taskId}/report.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-${taskId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <p className="text-sm text-[var(--muted)]">{error ? "Could not load this work item." : "Loading…"}</p>
        <Link href={`/app/w/${workspaceId}/work`} className="btn-secondary inline-flex rounded-xl">
          ← Back to work items
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8 pb-12">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <nav className="text-xs text-[var(--muted)]">
        <Link href={`/app/w/${workspaceId}/work`} className="hover:text-[var(--fg)]">
          ← Work items
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{detail.task.title}</h1>
        <p className="font-mono-ledger text-xs text-[var(--muted)]">
          {detail.task.id} · {deptName}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {detail.capabilities.canDeleteTask && (
            <button type="button" className="btn-secondary rounded-xl text-sm" onClick={() => void archive()}>
              Archive
            </button>
          )}
          <button type="button" className="btn-secondary rounded-xl text-sm" onClick={() => void downloadPdf()}>
            Export PDF
          </button>
        </div>
      </header>
      {detail.capabilities.canReschedule && (
        <section className="surface-elevated space-y-3 rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Reschedule</h2>
          <input className="input rounded-xl" type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
          <textarea
            className="input min-h-[5rem] rounded-xl"
            placeholder="Reason for date change"
            value={rescheduleReason}
            onChange={(e) => setRescheduleReason(e.target.value)}
          />
          <button type="button" className="btn-primary rounded-xl" onClick={() => void reschedule()}>
            Save new due date
          </button>
        </section>
      )}
      {detail.capabilities.canAppendLedger && (
        <section className="surface-elevated space-y-3 rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Append ledger entry</h2>
          <select className="input rounded-xl" value={logType} onChange={(e) => setLogType(e.target.value as typeof logType)}>
            <option value="note">note</option>
            <option value="ack">ack</option>
            <option value="status_change">status_change</option>
          </select>
          <textarea className="input min-h-[8rem] rounded-xl font-mono-ledger text-xs" value={logBody} onChange={(e) => setLogBody(e.target.value)} />
          <button type="button" className="btn-primary rounded-xl" onClick={() => void appendLog()}>
            Append
          </button>
        </section>
      )}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-[var(--muted)]">Reason log</h2>
        <ul className="space-y-3">
          {detail.ledger.map((row) => (
            <li key={row.id} className="surface-elevated rounded-xl border border-[var(--border-subtle)] p-4 shadow-sm">
              <div className="font-mono-ledger text-xs text-[var(--muted)]">
                {new Date(row.createdAt).toISOString()} · {row.type} · {row.actorId}
              </div>
              <pre className="mt-2 max-h-48 overflow-auto text-xs font-mono-ledger whitespace-pre-wrap break-all">
                {JSON.stringify(row.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
