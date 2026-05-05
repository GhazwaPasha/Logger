"use client";

import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function OrganizationSettingsPage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token } = useApiSession();
  const { reload: reloadWorkspaceList } = useOrganizationsState();
  const { error, setError, reload } = useWorkspaceData();
  const [org, setOrg] = useState<Org | null>(null);
  const [rename, setRename] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (!token) {
      setOrgLoading(false);
      return;
    }
    setOrgLoading(true);
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
      } finally {
        if (!c) setOrgLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [token, workspaceId]);

  async function saveWorkspaceName() {
    if (!token || !rename.trim() || saveBusy) return;
    setSaveBusy(true);
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
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Manage this organization&apos;s name and identity details.</p>
      </div>
      {orgLoading ? (
        <LoadingFrame
          show
          className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6"
          ribbonRadius="2xl"
          aria-label="Loading organization"
        >
          <div className="space-y-4 pt-2">
            <div className="h-4 w-40 animate-pulse rounded-md bg-[var(--surface-muted)] motion-reduce:animate-none" />
            <div className="h-3 w-full max-w-lg animate-pulse rounded bg-[var(--surface-muted)] motion-reduce:animate-none" />
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end">
              <div className="h-10 max-w-md flex-1 animate-pulse rounded-xl bg-[var(--surface-muted)] motion-reduce:animate-none" />
              <div className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-[var(--surface-muted)] motion-reduce:animate-none" />
            </div>
          </div>
        </LoadingFrame>
      ) : !org ? (
        <p className="text-sm text-[var(--muted)]">Could not load this organization.</p>
      ) : (
        <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6">
          <h2 className="text-sm font-semibold">Rename organization</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">This updates how the organization appears across your workspace list.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              className="input flex-1 rounded-xl"
              value={rename}
              disabled={saveBusy}
              onChange={(e) => setRename(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary inline-flex min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5"
              disabled={saveBusy}
              aria-busy={saveBusy || undefined}
              onClick={() => void saveWorkspaceName()}
            >
              {saveBusy ? (
                <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
              ) : null}
              <span>{saveBusy ? "Saving" : "Save name"}</span>
            </button>
          </div>
          <p className="mt-3 font-mono-ledger text-xs text-[var(--muted)]">
            Id <span className="text-[var(--fg)]">{org.id}</span>
          </p>
        </section>
      )}
    </div>
  );
}
