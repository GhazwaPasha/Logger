"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useAppPreferences } from "@/components/app/AppPreferencesContext";
import type { ThemePref } from "@/hooks/useThemePreference";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { apiJson } from "@/lib/api";
import type { Org } from "@/lib/ledger-types";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export function AddWorkspacePanel({
  variant,
  contextWorkspaceId,
}: {
  /** First workspace vs adding another while inside one. */
  variant: "standalone" | "inWorkspace";
  /** When `inWorkspace`, shown in the details section. */
  contextWorkspaceId?: string;
}) {
  const router = useRouter();
  const { token } = useApiSession();
  const { error, setError, reload } = useOrganizationsState();
  const { theme, setTheme } = useAppPreferences();
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
      await reload();
      setLastWorkspaceId(org.id);
      setName("");
      router.replace(`/${workspaceUrlSegment(org)}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
    } finally {
      setIsCreating(false);
    }
  }

  const title = "Add workspace";
  const description =
    variant === "standalone"
      ? "Create a workspace to get started."
      : "Create another workspace, then continue in it.";

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </div>

      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Workspace details</h2>
        {variant === "inWorkspace" && contextWorkspaceId ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            You are currently inside workspace <span className="font-mono-ledger">{contextWorkspaceId}</span>.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted)]">Choose a name for your workspace.</p>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="workspace-name">
              Name
            </label>
            <input
              id="workspace-name"
              className="input rounded-xl"
              placeholder="e.g. LogBase HQ"
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
        {variant === "standalone" && (
          <div className="mt-6 flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center">
            <label className="text-xs font-medium text-[var(--muted)] sm:min-w-[4.5rem]" htmlFor="onboarding-theme">
              Theme
            </label>
            <select
              id="onboarding-theme"
              className="input max-w-xs rounded-xl text-sm"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemePref)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
