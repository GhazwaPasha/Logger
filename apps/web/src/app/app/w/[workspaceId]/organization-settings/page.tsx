"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function OrganizationSettingsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { token } = useApiSession();
  const { reload: reloadWorkspaceList } = useOrganizationsState();
  const { error, setError, reload } = useWorkspaceData();
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
      setError(e instanceof Error ? e.message : "Could not rename organization");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Manage this organization&apos;s name and identity details.</p>
      </div>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Rename organization</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">This updates how the organization appears across your workspace list.</p>
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
    </div>
  );
}
