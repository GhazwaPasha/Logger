"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { apiJson } from "@/lib/api";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function AddOrganizationPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const router = useRouter();
  const { token } = useApiSession();
  const { error, setError, reload } = useOrganizationsState();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function createOrganization() {
    if (!token || !name.trim() || isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      const org = await apiJson<Org>("/organizations", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim() }),
      });
      await reload();
      setLastWorkspaceId(org.id);
      setName("");
      router.replace(`/app/w/${org.id}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create organization");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add organization</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Create another organization, then continue in its workspace.
        </p>
      </div>

      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Organization details</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          You are currently inside workspace <span className="font-mono-ledger">{workspaceId}</span>.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="org-name">
              Name
            </label>
            <input
              id="org-name"
              className="input rounded-xl"
              placeholder="e.g. Work Ledger HQ"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary shrink-0 rounded-xl px-6"
            onClick={() => void createOrganization()}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create organization"}
          </button>
        </div>
      </section>
    </div>
  );
}
