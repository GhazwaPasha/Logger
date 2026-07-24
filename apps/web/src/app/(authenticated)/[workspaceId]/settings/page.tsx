"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { authClient } from "@/lib/auth-client";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useAppPreferences } from "@/components/app/AppPreferencesContext";
import type { ThemePref } from "@/hooks/useThemePreference";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";

export default function UserSettingsPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useAppPreferences();
  const [name, setName] = useState("");
  const [nameSynced, setNameSynced] = useState(false);
  const [nameSaveBusy, setNameSaveBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;
  const user = session?.user;

  useEffect(() => {
    if (!nameSynced && user) {
      setName(user.name ?? "");
      setNameSynced(true);
    }
  }, [nameSynced, user]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || nameSaveBusy || trimmed === user?.name) return;
    setNameSaveBusy(true);
    setNameError(null);
    try {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) throw new Error(error.message ?? "Could not update name");
      setName(trimmed);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Could not update name");
    } finally {
      setNameSaveBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Account and appearance for your signed-in user.</p>
      </div>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Color theme for this browser. System follows your OS light/dark mode.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-xs font-medium text-[var(--muted)] sm:min-w-[4.5rem]" htmlFor="settings-theme">
            Theme
          </label>
          <SelectPopover
            value={theme}
            onChange={(v) => setTheme(v as ThemePref)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            aria-label="Theme"
          />
        </div>
      </section>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6">
        <h2 className="text-sm font-semibold">Profile</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Information from your login session.</p>
        {nameError && (
          <div className="mt-4">
            <ErrorBanner message={nameError} onDismiss={() => setNameError(null)} />
          </div>
        )}
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Email</dt>
            <dd className="mt-0.5 font-mono-ledger text-[var(--fg)]">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]" id="settings-name-label">
              Name
            </dt>
            <dd className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                aria-labelledby="settings-name-label"
                className="input flex-1 rounded-xl sm:max-w-sm"
                value={name}
                disabled={nameSaveBusy}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary inline-flex min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5"
                disabled={nameSaveBusy || !name.trim() || name.trim() === user?.name}
                aria-busy={nameSaveBusy || undefined}
                onClick={() => void saveName()}
              >
                {nameSaveBusy ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
                <span>{nameSaveBusy ? "Saving" : "Save"}</span>
              </button>
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-[var(--muted)]">
          Workspace and organization options live under{" "}
          <Link href={`${base}/organization-settings`} className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
            Organization settings
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
