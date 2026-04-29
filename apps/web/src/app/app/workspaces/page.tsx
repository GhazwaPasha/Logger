"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PickerChrome } from "@/components/app/PickerChrome";
import { NODE_LABELS } from "@/lib/nodes";
import type { Org } from "@/lib/ledger-types";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function WorkspacesPickerPage() {
  const router = useRouter();
  const { token } = useApiSession();
  const { orgs, error, setError, reload } = useOrganizationsState();
  const [name, setName] = useState("");

  async function createWorkspace() {
    if (!token || !name.trim()) return;
    setError(null);
    try {
      const org = await apiJson<Org>("/organizations", {
        method: "POST",
        token,
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await reload();
      setLastWorkspaceId(org.id);
      router.push(`/app/w/${org.id}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
    }
  }

  function openWorkspace(id: string) {
    setLastWorkspaceId(id);
    router.push(`/app/w/${id}/overview`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-base)]">
      <PickerChrome />
      <div className="mx-auto w-full max-w-screen-2xl flex-1 space-y-10 px-4 py-10 sm:px-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Choose a workspace</h1>
          <p className="mt-2 text-[var(--muted)]">
            A workspace is your top-level node (you can rename it anytime). Under each workspace you add levels, then
            work items on those levels.
          </p>
        </div>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Create workspace</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Call it a company, a program, a client, or anything else — it is just node 1 in the tree.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]" htmlFor="ws-name">
                Name
              </label>
              <input
                id="ws-name"
                className="input rounded-xl"
                placeholder={`e.g. ${NODE_LABELS.workspace} East`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button type="button" className="btn-primary shrink-0 rounded-xl px-6" onClick={() => void createWorkspace()}>
              Create
            </button>
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">Your workspaces</h2>
          {orgs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] px-6 py-14 text-center text-sm text-[var(--muted)]">
              None yet. Create one above.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {orgs.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => openWorkspace(o.id)}
                    className="surface-elevated w-full rounded-2xl border border-[var(--border-subtle)] p-5 text-left shadow-sm transition-all hover:border-[var(--accent)]/40 hover:shadow-md"
                  >
                    <span className="text-base font-semibold">{o.name}</span>
                    <span className="mt-4 block text-xs font-medium text-[var(--accent)]">Enter →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="text-center text-xs text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--fg)]">
            ← Home
          </Link>
        </p>
      </div>
    </div>
  );
}
