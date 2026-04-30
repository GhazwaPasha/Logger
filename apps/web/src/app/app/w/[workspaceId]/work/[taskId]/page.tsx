"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { taskKeys, workspaceKeys } from "@/lib/query-keys";
import type { TaskDetail } from "@/lib/ledger-types";
import {
  KANBAN_STATUS_ORDER,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type BoardTaskStatus,
  type TaskPriority,
  normalizeTaskStatus,
  taskPriority,
} from "@/lib/task-board";

export default function WorkItemDetailPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const taskId = params.taskId as string;
  const { token } = useApiSession();
  const queryClient = useQueryClient();
  const { depts, lists } = useWorkspaceData();
  const { detail, error, setError, reload } = useTaskDetail(token, taskId);
  const [logBody, setLogBody] = useState('{"message":"Acknowledged."}');
  const [logType, setLogType] = useState<"ack" | "note" | "status_change">("note");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (detail?.task.dueAt) setRescheduleAt(detail.task.dueAt.slice(0, 16));
  }, [detail?.task.dueAt, detail?.task.id]);

  const currentList = detail ? lists.find((x) => x.id === detail.task.listId) : null;
  const deptName = currentList && depts.length ? depts.find((x) => x.id === currentList.departmentId)?.name ?? currentList.departmentId : "";

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
      const next = await apiJson<TaskDetail>(`/tasks/${taskId}/reschedule`, {
        method: "POST",
        token,
        body: JSON.stringify({ newDueAt: iso, reason: rescheduleReason }),
      });
      setRescheduleReason("");
      queryClient.setQueryData(taskKeys.detail(taskId), next);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  async function archive() {
    if (!token) return;
    if (!confirm("Archive this task? (assigner only — soft delete)")) return;
    setError(null);
    try {
      const next = await apiJson<TaskDetail>(`/tasks/${taskId}/archive`, { method: "POST", token });
      queryClient.setQueryData(taskKeys.detail(taskId), next);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
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

  async function patchTaskFields(patch: { status?: BoardTaskStatus; priority?: TaskPriority }) {
    if (!token) return;
    setError(null);
    try {
      const next = await apiJson<TaskDetail>(`/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      queryClient.setQueryData(taskKeys.detail(taskId), next);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task");
    }
  }

  async function createSubtask() {
    if (!token || !newSubtaskTitle.trim()) return;
    setError(null);
    try {
      await apiJson(`/tasks/${taskId}/subtasks`, {
        method: "POST",
        token,
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      });
      setNewSubtaskTitle("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create subtask");
    }
  }

  async function setSubtaskDone(subtaskId: string, done: boolean) {
    if (!token) return;
    setError(null);
    try {
      await apiJson(`/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ done }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update subtask");
    }
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-screen-2xl space-y-4">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <p className="text-sm text-[var(--muted)]">{error ? "Could not load this task." : "Loading…"}</p>
        <Link href={`/app/w/${workspaceId}/work`} className="btn-secondary inline-flex rounded-xl">
          ← Back to tasks
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8 pb-12">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <nav className="text-xs text-[var(--muted)]">
        <Link href={`/app/w/${workspaceId}/work`} className="hover:text-[var(--fg)]">
          ← Tasks
        </Link>
      </nav>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{detail.task.title}</h1>
        <p className="font-mono-ledger text-xs text-[var(--muted)]">
          {detail.task.id} · {deptName}
          {currentList ? ` · ${currentList.name}` : ""}
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
        {detail.capabilities.canAppendLedger && (
          <div className="flex flex-wrap items-end gap-4 pt-4">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Status
              <select
                className="input h-10 rounded-xl text-sm"
                value={normalizeTaskStatus(detail.task.status)}
                onChange={(e) => void patchTaskFields({ status: e.target.value as BoardTaskStatus })}
              >
                {KANBAN_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              Priority
              <select
                className="input h-10 rounded-xl text-sm"
                value={taskPriority(detail.task)}
                onChange={(e) => void patchTaskFields({ priority: e.target.value as TaskPriority })}
              >
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
                  <option key={k} value={k}>
                    {PRIORITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
      <section className="surface-elevated space-y-3 rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Subtasks</h2>
        <div className="flex gap-2">
          <input
            className="input rounded-xl"
            placeholder="Add subtask"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createSubtask();
              }
            }}
          />
          <button type="button" className="btn-primary rounded-xl px-4" onClick={() => void createSubtask()}>
            Add
          </button>
        </div>
        {detail.subtasks.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No subtasks yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.done} onChange={(e) => void setSubtaskDone(s.id, e.target.checked)} />
                <span className={s.done ? "text-[var(--muted)] line-through" : ""}>{s.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
