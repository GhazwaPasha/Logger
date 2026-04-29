"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useAppPreferences } from "@/components/app/AppPreferencesContext";
import { AppHeader } from "@/components/app/AppHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { apiJson } from "@/lib/api";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId, getLastWorkspaceId } from "@/lib/workspace-storage";

export default function AppEntryPage() {
  const router = useRouter();
  const { token, isPending } = useApiSession();
  const { orgs, error, setError, reload } = useOrganizationsState();
  const { theme, setTheme } = useAppPreferences();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isPending || !token) return;
    if (orgs.length === 0) return;
    const lastWorkspaceId = getLastWorkspaceId();
    const target = orgs.find((o) => o.id === lastWorkspaceId) ?? orgs[0];
    setLastWorkspaceId(target.id);
    router.replace(`/app/w/${target.id}/dashboard`);
  }, [isPending, token, orgs, router]);

  async function createWorkspace() {
    if (!token || !name.trim() || isCreating) return;
    setError(null);
    setIsCreating(true);
    try {
      const org = await apiJson<Org>("/organizations", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim() }),
      });
      setLastWorkspaceId(org.id);
      setName("");
      await reload();
      router.replace(`/app/w/${org.id}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <AppHeader theme={theme} onThemeChange={setTheme} />
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-10 sm:px-6">
        {orgs.length > 0 ? (
          <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-6 text-center">
            <p className="text-sm text-[var(--muted)]">Opening your workspace…</p>
          </div>
        ) : (
          <section className="surface-elevated w-full rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Create your first workspace</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Once this is created, you can switch workspaces from the sidebar user menu.
            </p>
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="ws-name">
                  Name
                </label>
                <input
                  id="ws-name"
                  className="input rounded-xl"
                  placeholder="e.g. Work Ledger HQ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-primary shrink-0 rounded-xl px-6"
                onClick={() => void createWorkspace()}
                disabled={!name.trim() || isCreating}
              >
                {isCreating ? "Creating..." : "Create workspace"}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
