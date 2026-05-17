"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api";

type TimeEntry = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  startedAt: string;
  stoppedAt: string | null;
  duration: string | null;
  note: string | null;
  createdAt: string;
};

function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

export function TimeTracker({
  taskId,
  token,
  userId,
}: {
  taskId: string;
  token: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const timeKey = ["time", taskId];

  const { data: entries = [] } = useQuery<TimeEntry[]>({
    queryKey: timeKey,
    queryFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/tasks/${taskId}/time`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load time entries");
      return res.json() as Promise<TimeEntry[]>;
    },
    staleTime: 30_000,
  });

  // Detect running timer (no stoppedAt, owned by current user)
  const runningEntry = entries.find((e) => !e.stoppedAt && e.userId === userId) ?? null;
  const elapsed = useElapsedSeconds(runningEntry?.startedAt ?? null);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/tasks/${taskId}/time/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Failed to start timer");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: timeKey }),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/tasks/${taskId}/time/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to stop timer");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: timeKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`${getApiBaseUrl()}/time/${entryId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete entry");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: timeKey }),
  });

  const [showManual, setShowManual] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualError, setManualError] = useState("");

  const logManualMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBaseUrl()}/tasks/${taskId}/time/log`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startedAt: manualStart, stoppedAt: manualEnd, note: manualNote || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Failed to log time");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timeKey });
      setShowManual(false);
      setManualStart("");
      setManualEnd("");
      setManualNote("");
      setManualError("");
    },
    onError: (e: Error) => setManualError(e.message),
  });

  const totalSeconds = entries
    .filter((e) => e.duration)
    .reduce((acc, e) => acc + parseInt(e.duration!, 10), 0);

  const completedEntries = entries.filter((e) => e.stoppedAt);

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Time Tracking</h3>
        {totalSeconds > 0 && (
          <span className="text-xs font-semibold text-[var(--fg)]">{formatDuration(totalSeconds)} total</span>
        )}
      </div>

      {/* Timer control */}
      <div className="flex items-center gap-3">
        {runningEntry ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-mono font-semibold text-red-500">
              <span className="size-2 animate-pulse rounded-full bg-red-500" />
              {formatSeconds(elapsed)}
            </span>
            <button
              type="button"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              className="btn-secondary rounded-lg px-3 py-1 text-xs font-medium"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="btn-secondary rounded-lg px-3 py-1 text-xs font-medium"
          >
            ▶ Start Timer
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--fg)]"
        >
          Log manually
        </button>
      </div>

      {startMutation.isError && (
        <p className="text-xs text-red-500">{(startMutation.error as Error).message}</p>
      )}

      {/* Manual log form */}
      {showManual && (
        <div className="space-y-2 rounded-lg bg-[var(--surface-muted)] p-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--muted)]">Start</label>
              <input
                type="datetime-local"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-xs outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-[var(--muted)]">End</label>
              <input
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-xs outline-none"
              />
            </div>
          </div>
          <input
            type="text"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={512}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none placeholder:text-[var(--muted)]"
          />
          {manualError && <p className="text-xs text-red-500">{manualError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!manualStart || !manualEnd) { setManualError("Start and end times are required"); return; }
                logManualMutation.mutate();
              }}
              disabled={logManualMutation.isPending}
              className="btn-primary rounded-lg px-3 py-1 text-xs font-medium"
            >
              Log
            </button>
            <button
              type="button"
              onClick={() => { setShowManual(false); setManualError(""); }}
              className="btn-secondary rounded-lg px-3 py-1 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entry list */}
      {completedEntries.length > 0 && (
        <ul className="space-y-1">
          {completedEntries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{e.userName}</span>
                  <span className="text-[var(--muted)]">{formatDuration(parseInt(e.duration ?? "0", 10))}</span>
                </div>
                <div className="text-[var(--muted)]">{formatDateTime(e.startedAt)}</div>
                {e.note && <div className="mt-0.5 italic text-[var(--muted)]">{e.note}</div>}
              </div>
              {e.userId === userId && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(e.id)}
                  className="shrink-0 text-[var(--muted)] hover:text-red-500"
                  aria-label="Delete entry"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
