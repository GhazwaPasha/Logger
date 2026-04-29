"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import type { Dept } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useEffect } from "react";

export default function LevelsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { token } = useApiSession();
  const { depts, error, setError, reload } = useWorkspaceData();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  async function addLevel() {
    if (!token || !newName.trim()) return;
    setError(null);
    try {
      await apiJson(`/organizations/${workspaceId}/departments`, {
        method: "POST",
        token,
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add level");
    }
  }

  async function saveLevel(d: Dept) {
    const name = (editing[d.id] ?? d.name).trim();
    if (!token || !name) return;
    setError(null);
    try {
      await apiJson(`/organizations/${workspaceId}/departments/${d.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name }),
      });
      setEditing((m) => {
        const n = { ...m };
        delete n[d.id];
        return n;
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename level");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{NODE_LABELS.level}s</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Node 2 under this workspace — departments, divisions, streams, or anything you want to call them.
        </p>
      </div>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Add level</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input
            className="input flex-1 rounded-xl"
            placeholder="e.g. Operations, Client A, Q3"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="button" className="btn-primary shrink-0 rounded-xl px-5" onClick={() => void addLevel()}>
            Add
          </button>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">All levels</h2>
        {depts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-sm text-[var(--muted)]">
            No levels yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {depts.map((d) => (
              <li key={d.id} className="surface-elevated flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-4 shadow-sm sm:flex-row sm:items-center">
                <input
                  className="input flex-1 rounded-xl"
                  value={editing[d.id] ?? d.name}
                  onChange={(e) => setEditing((m) => ({ ...m, [d.id]: e.target.value }))}
                />
                <button type="button" className="btn-secondary shrink-0 rounded-xl px-4" onClick={() => void saveLevel(d)}>
                  Save name
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
