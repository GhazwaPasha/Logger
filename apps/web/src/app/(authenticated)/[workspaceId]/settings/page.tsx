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
import { SettingsCard, SettingsFieldRow } from "@/components/ui/SettingsCard";
import { faPalette, faUser, faKey, faPlug } from "@fortawesome/free-solid-svg-icons";

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

  // Same origin as the app itself — /mcp is proxied through to the API (see next.config.mjs
  // rewrites) so users never see the API's separate hosting domain.
  const mcpUrl = `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/mcp`;
  const [copiedMcpUrl, setCopiedMcpUrl] = useState(false);
  const cliCommand = `claude mcp add --transport http work-ledger ${mcpUrl} --header "Authorization: Bearer <your-key>"`;

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
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your settings</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Account and appearance for your signed-in user.</p>
      </div>
      <SettingsCard
        icon={faPalette}
        title="Appearance"
        description="Color theme for this browser. System follows your OS light/dark mode."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
      </SettingsCard>
      <SettingsCard icon={faUser} title="Profile" description="Information from your login session.">
        {nameError && (
          <div className="mb-4">
            <ErrorBanner message={nameError} onDismiss={() => setNameError(null)} />
          </div>
        )}
        {avatarError && (
          <div className="mb-4">
            <ErrorBanner message={avatarError} onDismiss={() => setAvatarError(null)} />
          </div>
        )}
        <dl className="space-y-4 text-sm">
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
        </dl>
        <div className="mt-5">
          <SettingsFieldRow
            label="Name"
            htmlFor="settings-name-input"
            action={
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
            }
          >
            <input
              id="settings-name-input"
              className="input rounded-xl"
              value={name}
              disabled={nameSaveBusy}
              onChange={(e) => setName(e.target.value)}
            />
          </SettingsFieldRow>
        </div>
        <p className="mt-6 text-xs text-[var(--muted)]">
          Workspace and organization options live under{" "}
          <Link href={`${base}/organization-settings`} className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
            Organization settings
          </Link>
          .
        </p>
      </SettingsCard>
      <SettingsCard
        icon={faKey}
        title="API keys"
        description="Long-lived credentials for connecting external tools and AI agents (via the MCP endpoint) to your account."
      >
        {createdKey && (
          <div className="mb-4 rounded-xl border border-amber-400/50 bg-amber-50 p-4 dark:bg-amber-900/20">
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
        <SettingsFieldRow
          label="New key"
          htmlFor="settings-new-key-input"
          action={
            <button
              type="button"
              className="btn-primary inline-flex min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5"
              disabled={createKeyMutation.isPending || !newKeyName.trim()}
              aria-busy={createKeyMutation.isPending || undefined}
              onClick={() => createKeyMutation.mutate()}
            >
              {createKeyMutation.isPending ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
              <span>{createKeyMutation.isPending ? "Creating" : "Create key"}</span>
            </button>
          }
        >
          <input
            id="settings-new-key-input"
            className="input rounded-xl"
            placeholder="e.g. Claude"
            value={newKeyName}
            disabled={createKeyMutation.isPending}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
        </SettingsFieldRow>
        <div className="mt-5 space-y-2">
          {apiKeysLoading && <p className="text-xs text-[var(--muted)]">Loading…</p>}
          {!apiKeysLoading && apiKeys.length === 0 && (
            <p className="text-xs text-[var(--muted)]">No API keys yet.</p>
          )}
          {apiKeys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-3"
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
      </SettingsCard>
      <SettingsCard
        icon={faPlug}
        title="Connect to Claude"
        description="Let Claude read and update your tasks, time entries, and roadmap directly."
      >
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">MCP server URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs">
              {mcpUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(mcpUrl);
                setCopiedMcpUrl(true);
                setTimeout(() => setCopiedMcpUrl(false), 2000);
              }}
              className="btn-secondary shrink-0 rounded-lg px-3 py-1.5 text-xs"
            >
              {copiedMcpUrl ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Claude Desktop or claude.ai
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-[var(--fg)]">
              <li>
                In Claude, open <span className="font-medium">Settings → Connectors</span> (sometimes labeled
                &ldquo;Custom Connectors&rdquo;).
              </li>
              <li>
                Choose <span className="font-medium">Add custom connector</span> and paste the URL above.
              </li>
              <li>
                Click <span className="font-medium">Connect</span> — you&rsquo;ll be asked to log in and approve
                access. No API key needed.
              </li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Claude Code (CLI)</p>
            <p className="mt-2 text-sm text-[var(--fg)]">
              Create an API key above, then run:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs">
              {cliCommand}
            </pre>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
