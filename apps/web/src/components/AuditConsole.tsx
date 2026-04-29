"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { apiFetch, apiJson } from "@/lib/api";

type Org = { id: string; name: string };
type Dept = { id: string; name: string; organizationId: string };
type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  departmentId: string;
  assignerId: string;
  deletedAt: string | null;
};
type LedgerRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actorId: string;
  createdAt: string;
  clientMutationId: string | null;
};
type TaskDetail = {
  task: TaskRow;
  capabilities: { canDeleteTask: boolean; canReschedule: boolean; canAppendLedger: boolean };
  assigneeUserIds: string[];
  ledger: LedgerRow[];
};

export function AuditConsole() {
  const { data: session, isPending } = authClient.useSession();
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [token, setToken] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [logBody, setLogBody] = useState('{"message":"Acknowledged."}');
  const [logType, setLogType] = useState<"ack" | "note" | "status_change">("note");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const refreshToken = useCallback(async () => {
    const { data, error: err } = await authClient.token();
    if (err) {
      setToken(null);
      return;
    }
    setToken(data?.token ?? null);
  }, []);

  useEffect(() => {
    if (session?.user) void refreshToken();
    else setToken(null);
  }, [session, refreshToken]);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await apiJson<Org[]>("/organizations", { token });
      setOrgs(data);
      if (data.length && !orgId) setOrgId(data[0]!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organizations");
    }
  }, [token, orgId]);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  const loadDeptTasks = useCallback(async () => {
    if (!token || !orgId) return;
    setError(null);
    try {
      const d = await apiJson<Dept[]>(`/organizations/${orgId}/departments`, { token });
      setDepts(d);
      const t = await apiJson<TaskRow[]>(`/organizations/${orgId}/tasks`, { token });
      setTasks(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load departments/tasks");
    }
  }, [token, orgId]);

  useEffect(() => {
    void loadDeptTasks();
  }, [loadDeptTasks]);

  const loadDetail = useCallback(async () => {
    if (!token || !taskId) {
      setDetail(null);
      return;
    }
    setError(null);
    try {
      const d = await apiJson<TaskDetail>(`/tasks/${taskId}`, { token });
      setDetail(d);
      if (d.task.dueAt) setRescheduleAt(d.task.dueAt.slice(0, 16));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    }
  }, [token, taskId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const deptName = useMemo(() => {
    if (!detail) return "";
    return depts.find((x) => x.id === detail.task.departmentId)?.name ?? detail.task.departmentId;
  }, [detail, depts]);

  async function appendLog() {
    if (!token || !taskId) return;
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
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to append log");
    }
  }

  async function reschedule() {
    if (!token || !taskId || !rescheduleReason.trim()) return;
    setError(null);
    try {
      const iso = rescheduleAt ? new Date(rescheduleAt).toISOString() : new Date().toISOString();
      await apiJson(`/tasks/${taskId}/reschedule`, {
        method: "POST",
        token,
        body: JSON.stringify({ newDueAt: iso, reason: rescheduleReason }),
      });
      setRescheduleReason("");
      await loadDetail();
      await loadDeptTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reschedule failed");
    }
  }

  async function archive() {
    if (!token || !taskId) return;
    if (!confirm("Archive this task? (assigner only — soft delete)")) return;
    setError(null);
    try {
      await apiJson(`/tasks/${taskId}/archive`, { method: "POST", token });
      await loadDetail();
      await loadDeptTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Archive failed");
    }
  }

  async function downloadPdf() {
    if (!token || !taskId) return;
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

  if (isPending) {
    return <div className="p-8 text-sm text-muted">Loading session…</div>;
  }

  if (!session?.user) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-sm">You need to sign in to use the audit console.</p>
        <Link className="btn btn-primary" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="panel border-t-0 border-x-0 flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm font-medium tracking-tight">Work Ledger — Audit</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-mono-ledger">{session.user.email}</span>
          <select
            className="input text-sm py-1 max-w-[9rem]"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <button type="button" className="btn panel text-sm" onClick={() => authClient.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      {error && (
        <div className="px-4 py-2 text-sm border-b border-[var(--border)] bg-red-500/10 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <aside className="w-56 shrink-0 panel border-t-0 border-b-0 border-l-0 overflow-y-auto p-3">
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Organizations</div>
          <ul className="space-y-1">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`w-full text-left text-sm px-2 py-1 border ${orgId === o.id ? "border-[var(--accent)]" : "border-transparent"}`}
                  onClick={() => {
                    setOrgId(o.id);
                    setTaskId(null);
                  }}
                >
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="text-xs uppercase tracking-wide text-muted mt-4 mb-2">Departments</div>
          <ul className="space-y-1 text-sm text-muted">
            {depts.map((d) => (
              <li key={d.id} className="px-2 font-mono-ledger text-xs">
                {d.name}
              </li>
            ))}
          </ul>
        </aside>
        <section className="flex-1 min-w-0 panel border-t-0 border-b-0 overflow-y-auto p-4">
          <div className="text-xs uppercase tracking-wide text-muted mb-2">Activity stream — tasks</div>
          <ul className="space-y-0">
            {tasks.map((t) => (
              <li key={t.id} className="border-b border-[var(--border)]">
                <button
                  type="button"
                  className={`w-full text-left py-2 px-2 text-sm ${taskId === t.id ? "bg-[var(--accent)]/10" : ""}`}
                  onClick={() => setTaskId(t.id)}
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="block text-xs text-muted font-mono-ledger mt-1">
                    {t.status} · due {t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 10) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <aside className="w-[28rem] shrink-0 panel border-t-0 border-b-0 border-r-0 overflow-y-auto p-4 flex flex-col gap-4">
          {!detail ? (
            <p className="text-sm text-muted">Select a task to inspect the reason log.</p>
          ) : (
            <>
              <div>
                <h2 className="text-base font-semibold">{detail.task.title}</h2>
                <p className="text-xs text-muted font-mono-ledger mt-1">
                  {detail.task.id} · {deptName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.capabilities.canDeleteTask && (
                    <button type="button" className="btn panel text-sm" onClick={archive}>
                      Archive
                    </button>
                  )}
                  <button type="button" className="btn panel text-sm" onClick={downloadPdf}>
                    Export PDF
                  </button>
                </div>
              </div>
              {detail.capabilities.canReschedule && (
                <div className="panel p-3 space-y-2">
                  <div className="text-xs uppercase text-muted">Reschedule (reason required)</div>
                  <input
                    className="input text-sm"
                    type="datetime-local"
                    value={rescheduleAt}
                    onChange={(e) => setRescheduleAt(e.target.value)}
                  />
                  <textarea
                    className="input text-sm min-h-[4rem]"
                    placeholder="Reason for date change"
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary text-sm" onClick={reschedule}>
                    Save new due date
                  </button>
                </div>
              )}
              {detail.capabilities.canAppendLedger && (
                <div className="panel p-3 space-y-2">
                  <div className="text-xs uppercase text-muted">Append ledger entry</div>
                  <select
                    className="input text-sm"
                    value={logType}
                    onChange={(e) => setLogType(e.target.value as typeof logType)}
                  >
                    <option value="note">note</option>
                    <option value="ack">ack</option>
                    <option value="status_change">status_change</option>
                  </select>
                  <textarea
                    className="input text-sm font-mono-ledger min-h-[5rem]"
                    value={logBody}
                    onChange={(e) => setLogBody(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary text-sm" onClick={appendLog}>
                    Append
                  </button>
                </div>
              )}
              <div>
                <div className="text-xs uppercase text-muted mb-2">Reason log</div>
                <ul className="space-y-2 text-sm">
                  {detail.ledger.map((row) => (
                    <li key={row.id} className="panel p-2">
                      <div className="font-mono-ledger text-xs text-muted">
                        {new Date(row.createdAt).toISOString()} · {row.type} · {row.actorId}
                      </div>
                      <pre className="mt-1 text-xs font-mono-ledger whitespace-pre-wrap break-all">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
