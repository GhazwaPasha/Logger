"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { authClient } from "@/lib/auth-client";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useAppPreferences } from "@/components/app/AppPreferencesContext";
import type { ThemePref } from "@/hooks/useThemePreference";
import { SelectPopover } from "@/components/ui/SelectPopover";

export default function UserSettingsPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useAppPreferences();

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  const base = `/${workspaceSlug}`;
  const user = session?.user;

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
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Email</dt>
            <dd className="mt-0.5 font-mono-ledger text-[var(--fg)]">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Name</dt>
            <dd className="mt-0.5 text-[var(--fg)]">{user?.name?.trim() || "—"}</dd>
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
