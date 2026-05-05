"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { apiJson, apiVoid } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import type { Org } from "@/lib/ledger-types";
import { orgKeys, workspaceKeys } from "@/lib/query-keys";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { isWorkspaceOwner } from "@/lib/workspace-permissions";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { reload: reloadWorkspaceList } = useOrganizationsState();
  const { error, setError, reload, members } = useWorkspaceData();
  const [org, setOrg] = useState<Org | null>(null);
  const [rename, setRename] = useState("");
  const [orgLoading, setOrgLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [orgDeleteDialog, setOrgDeleteDialog] = useState<ConfirmDialogOptions | null>(null);
  const canDeleteOrg = isWorkspaceOwner(members, session?.user?.id);

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

  function openOrgDeleteDialog() {
    if (!org) return;
    if (deleteConfirm.trim() !== org.name.trim()) {
      setError("Type the organization name exactly to confirm deletion.");
      return;
    }
    setError(null);
    setOrgDeleteDialog({
      title: "Delete this organization?",
      description: `“${org.name}” and all of its levels, lists, tasks, and members will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete forever",
      variant: "danger",
      onConfirm: () => void performOrganizationDelete(),
    });
  }

  async function performOrganizationDelete() {
    if (!token || !org || deleteBusy) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await apiVoid(`/organizations/${workspaceId}`, { method: "DELETE", token });
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.workspace(workspaceId) });
      const list = await queryClient.fetchQuery({
        queryKey: orgKeys.all,
        queryFn: () => apiJson<Org[]>("/organizations", { token }),
      });
      setDeleteConfirm("");
      setOrgDeleteDialog(null);
      if (list.length > 0) {
        const next = list[0]!;
        setLastWorkspaceId(next.id);
        router.replace(`/${workspaceUrlSegment(next)}/dashboard`);
      } else {
        router.replace("/app");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete organization");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-8">
      <ConfirmDialog
        open={orgDeleteDialog != null}
        options={orgDeleteDialog}
        onClose={() => setOrgDeleteDialog(null)}
      />
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
      {!orgLoading && org && canDeleteOrg ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-700 p-6 text-white shadow-md dark:bg-red-900">
          <h2 className="text-sm font-semibold text-white">Delete organization</h2>
          <p className="mt-1 text-xs text-white/85">
            Permanently delete this workspace, all levels, lists, tasks, and members. This cannot be undone.
          </p>
          <label className="mt-4 block text-xs font-medium text-white">
            Type <span className="font-semibold">{org.name}</span> to confirm
            <input
              className="mt-1.5 w-full max-w-md rounded-xl border border-white/35 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/55 focus:ring-2 focus:ring-white/25"
              value={deleteConfirm}
              disabled={deleteBusy}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
              placeholder="Organization name"
            />
          </label>
          <button
            type="button"
            className="mt-4 rounded-xl border-2 border-white/50 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={deleteBusy || deleteConfirm.trim() !== org.name.trim()}
            aria-busy={deleteBusy || undefined}
            onClick={() => openOrgDeleteDialog()}
          >
            {deleteBusy ? "Deleting…" : "Delete organization forever"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
