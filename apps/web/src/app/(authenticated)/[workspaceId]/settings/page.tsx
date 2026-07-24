"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { useApiSession } from "@/hooks/useApiSession";
import { authClient } from "@/lib/auth-client";
import { apiJson, apiVoid } from "@/lib/api";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { useAppPreferences } from "@/components/app/AppPreferencesContext";
import type { ThemePref } from "@/hooks/useThemePreference";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { Avatar } from "@/components/ui/Avatar";

const AVATAR_PROVIDER_LABELS = { discord: "Discord", google: "Google" } as const;

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export default function UserSettingsPage() {
  const { workspaceId, workspaceSlug } = useWorkspaceRoute();
  const { data: session } = authClient.useSession();
  const { token } = useApiSession();
  const { theme, setTheme } = useAppPreferences();
  const [name, setName] = useState("");
  const [nameSynced, setNameSynced] = useState(false);
  const [nameSaveBusy, setNameSaveBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const apiKeysQueryKey = ["api-keys"];
  const { data: apiKeys = [], isLoading: apiKeysLoading } = useQuery<ApiKeyRow[]>({
    queryKey: apiKeysQueryKey,
    queryFn: () => apiJson<ApiKeyRow[]>("/api-keys", { token }),
    enabled: Boolean(token),
  });
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const createKeyMutation = useMutation({
    mutationFn: () =>
      apiJson<ApiKeyRow & { key: string }>("/api-keys", {
        token,
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey });
      setCreatedKey(data.key);
      setNewKeyName("");
    },
  });
  const revokeKeyMutation = useMutation({
    mutationFn: (id: string) => apiVoid(`/api-keys/${id}`, { token, method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: apiKeysQueryKey }),
  });

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

  const avatarOptions = (["discord", "google"] as const)
    .map((source) => ({ source, image: source === "discord" ? user?.discordImage : user?.googleImage }))
    .filter((o): o is { source: "discord" | "google"; image: string } => Boolean(o.image));
  const activeAvatarSource =
    user?.avatarSource === "discord" || user?.avatarSource === "google"
      ? user.avatarSource
      : (avatarOptions[0]?.source ?? null);
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function chooseAvatar(source: "discord" | "google", image: string) {
    if (avatarSaving || source === activeAvatarSource) return;
    setAvatarSaving(source);
    setAvatarError(null);
    try {
      const { error } = await authClient.updateUser({ avatarSource: source, image });
      if (error) throw new Error(error.message ?? "Could not update avatar");
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : "Could not update avatar");
    } finally {
      setAvatarSaving(null);
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
        {avatarError && (
          <div className="mt-4">
            <ErrorBanner message={avatarError} onDismiss={() => setAvatarError(null)} />
          </div>
        )}
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Avatar</dt>
            <dd className="mt-1.5">
              {avatarOptions.length === 0 ? (
                <div className="flex items-center gap-3">
                  <Avatar
                    name={user?.name}
                    email={user?.email}
                    image={user?.image}
                    size="size-12"
                    className="border border-[var(--border-subtle)] bg-[var(--accent-muted)] text-sm font-semibold text-[var(--fg)]"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Connect a Discord or Google account to set a profile picture.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {avatarOptions.map((o) => {
                    const active = o.source === activeAvatarSource;
                    const busy = avatarSaving === o.source;
                    return (
                      <button
                        key={o.source}
                        type="button"
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition-colors ${
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                            : "border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
                        }`}
                        disabled={avatarSaving !== null}
                        aria-pressed={active}
                        onClick={() => void chooseAvatar(o.source, o.image)}
                      >
                        <Avatar
                          name={user?.name}
                          email={user?.email}
                          image={o.image}
                          size="size-12"
                          className="border border-[var(--border-subtle)]"
                        />
                        <span className="font-medium text-[var(--fg)]">
                          {busy ? "Saving…" : AVATAR_PROVIDER_LABELS[o.source]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </dd>
          </div>
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
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6">
        <h2 className="text-sm font-semibold">API keys</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Long-lived credentials for connecting external tools and AI agents (via the MCP endpoint) to your account.
        </p>
        {createdKey && (
          <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-50 p-4 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Save this key now — it won't be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-white/60 px-3 py-2 font-mono text-xs dark:bg-black/30">
                {createdKey}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(createdKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="btn-secondary shrink-0 rounded-lg px-3 py-1.5 text-xs"
              >
                {copiedKey ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="mt-2 text-xs text-amber-700 underline dark:text-amber-400"
            >
              I've saved it, dismiss
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            aria-label="New API key name"
            className="input flex-1 rounded-xl sm:max-w-sm"
            placeholder="e.g. Claude"
            value={newKeyName}
            disabled={createKeyMutation.isPending}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5"
            disabled={createKeyMutation.isPending || !newKeyName.trim()}
            aria-busy={createKeyMutation.isPending || undefined}
            onClick={() => createKeyMutation.mutate()}
          >
            {createKeyMutation.isPending ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
            <span>{createKeyMutation.isPending ? "Creating" : "Create key"}</span>
          </button>
        </div>
        <div className="mt-5 space-y-2">
          {apiKeysLoading && <p className="text-xs text-[var(--muted)]">Loading…</p>}
          {!apiKeysLoading && apiKeys.length === 0 && (
            <p className="text-xs text-[var(--muted)]">No API keys yet.</p>
          )}
          {apiKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{k.name}</p>
                <p className="font-mono-ledger text-xs text-[var(--muted)]">
                  {k.keyPrefix}… · created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revokeKeyMutation.mutate(k.id)}
                disabled={revokeKeyMutation.isPending && revokeKeyMutation.variables === k.id}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
