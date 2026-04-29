"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useEffect } from "react";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { token } = useApiSession();
  const { reload: reloadWorkspaceList } = useOrganizationsState();
  const { depts, tasks, members, error, setError, reload } = useWorkspaceData();
  const [org, setOrg] = useState<Org | null>(null);
  const [rename, setRename] = useState("");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (!token) return;
    let c = false;
    void (async () => {
      try {
        const o = await apiJson<Org>(`/organizations/${workspaceId}`, { token });
        if (!c) {
          setOrg(o);
          setRename(o.name);
        }
      } catch {
        if (!c) setOrg(null);
      }
    })();
    return () => {
      c = true;
    };
  }, [token, workspaceId]);

  async function saveWorkspaceName() {
    if (!token || !rename.trim()) return;
    setError(null);
    try {
      const o = await apiJson<Org>(`/organizations/${workspaceId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: rename.trim() }),
      });
      setOrg(o);
      await reload();
      await reloadWorkspaceList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename workspace");
    }
  }

  const base = `/app/w/${workspaceId}`;

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {NODE_LABELS.workspace} (node 1) → {NODE_LABELS.level}s (node 2) → {NODE_LABELS.workItem}s (node 3).
        </p>
      </div>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Rename this workspace</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">The label is yours; internally it stays one workspace record.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input className="input flex-1 rounded-xl" value={rename} onChange={(e) => setRename(e.target.value)} />
          <button type="button" className="btn-primary shrink-0 rounded-xl px-5" onClick={() => void saveWorkspaceName()}>
            Save name
          </button>
        </div>
        {org && (
          <p className="mt-3 font-mono-ledger text-xs text-[var(--muted)]">
            Id <span className="text-[var(--fg)]">{org.id}</span>
          </p>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{NODE_LABELS.level}s</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{depts.length}</p>
        </div>
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Open work items</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{tasks.filter((t) => !t.deletedAt).length}</p>
        </div>
        <div className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">People</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{members.length}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={`${base}/levels`} className="btn-primary rounded-xl px-5">
          Manage {NODE_LABELS.level}s
        </Link>
        <Link href={`${base}/work`} className="btn-secondary rounded-xl px-5">
          Open work items
        </Link>
        <Link href={`${base}/people`} className="btn-secondary rounded-xl px-5">
          People &amp; access
        </Link>
      </div>
    </div>
  );
}
