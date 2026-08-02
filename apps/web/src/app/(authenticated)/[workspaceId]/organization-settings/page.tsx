"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { apiJson, apiVoid } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useOrganizationsState } from "@/components/app/OrganizationsProvider";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { useDiscordChannels } from "@/hooks/useDiscordChannels";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { LoadingFrame } from "@/components/ui/LoadingFrame";
import { SettingsCard, EditableField } from "@/components/ui/SettingsCard";
import { faBuilding, faClock, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faDiscord } from "@fortawesome/free-brands-svg-icons";
import type { Org } from "@/lib/ledger-types";
import { discordKeys, orgKeys, workspaceKeys } from "@/lib/query-keys";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { workspaceUrlSegment } from "@/lib/workspace-url";
import { isWorkspaceOwner } from "@/lib/workspace-permissions";
import { NODE_LABELS } from "@/lib/nodes";
import { TIMEZONE_GROUPS } from "@/lib/timezones";
import { formatInTimeZone } from "@/lib/date";

type DiscordIntegrationConfig = { guildId: string; updatedAt: string } | null;
type DiscordConnectionResult = { ok: true; guildName: string } | { ok: false; reason: string };

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
  const [editingOrgName, setEditingOrgName] = useState(false);
  const [timeZoneDraft, setTimeZoneDraft] = useState("");
  const [editingTimeZone, setEditingTimeZone] = useState(false);
  const [timeZoneSaveBusy, setTimeZoneSaveBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [orgDeleteDialog, setOrgDeleteDialog] = useState<ConfirmDialogOptions | null>(null);
  const canDeleteOrg = isWorkspaceOwner(members, session?.user?.id);

  const [discordConfig, setDiscordConfig] = useState<DiscordIntegrationConfig>(null);
  const [discordLoading, setDiscordLoading] = useState(true);
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordSaveBusy, setDiscordSaveBusy] = useState(false);
  const [discordTestBusy, setDiscordTestBusy] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<DiscordConnectionResult | null>(null);
  const [statusCheckBusy, setStatusCheckBusy] = useState(false);
  const [discordInviteUrl, setDiscordInviteUrl] = useState<string | null>(null);
  const [editingGuildId, setEditingGuildId] = useState(false);
  const channelsQuery = useDiscordChannels(discordConfig ? token : null, workspaceId);

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
          setTimeZoneDraft(o.timeZone);
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

  useEffect(() => {
    if (!token || !canDeleteOrg) {
      setDiscordLoading(false);
      return;
    }
    setDiscordLoading(true);
    let c = false;
    void (async () => {
      try {
        const [cfg, invite] = await Promise.all([
          apiJson<DiscordIntegrationConfig>(`/organizations/${workspaceId}/discord-integration`, { token }),
          apiJson<{ url: string }>("/discord/invite-url", { token }).catch(() => null),
        ]);
        if (!c) {
          setDiscordConfig(cfg);
          setDiscordGuildId(cfg?.guildId ?? "");
          setDiscordInviteUrl(invite?.url ?? null);
        }
      } catch {
        if (!c) setDiscordConfig(null);
      } finally {
        if (!c) setDiscordLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [token, workspaceId, canDeleteOrg]);

  // Background live-status check so the card shows the current connection state (server name,
  // reachability) without requiring a manual "Test connection" click on every page load.
  useEffect(() => {
    const guildId = discordConfig?.guildId;
    if (!token || !guildId) return;
    setStatusCheckBusy(true);
    let c = false;
    void (async () => {
      try {
        const result = await apiJson<DiscordConnectionResult>(`/organizations/${workspaceId}/discord-integration/test`, {
          method: "POST",
          token,
        });
        if (!c) setConnectionStatus(result);
      } catch {
        // Best-effort background check — the manual "Test connection" button surfaces real errors.
      } finally {
        if (!c) setStatusCheckBusy(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [token, workspaceId, discordConfig?.guildId]);

  async function saveDiscordIntegration() {
    if (!token || !discordGuildId.trim() || discordSaveBusy) return;
    setDiscordSaveBusy(true);
    setConnectionStatus(null);
    try {
      const result = await apiJson<DiscordConnectionResult>(`/organizations/${workspaceId}/discord-integration`, {
        method: "PUT",
        token,
        body: JSON.stringify({ guildId: discordGuildId.trim() }),
      });
      setConnectionStatus(result);
      const cfg = await apiJson<DiscordIntegrationConfig>(`/organizations/${workspaceId}/discord-integration`, { token });
      setDiscordConfig(cfg);
      setEditingGuildId(false);
      await queryClient.invalidateQueries({ queryKey: discordKeys.channels(workspaceId) });
    } catch (e) {
      setConnectionStatus({ ok: false, reason: e instanceof Error ? e.message : "Could not save Discord integration" });
    } finally {
      setDiscordSaveBusy(false);
    }
  }

  function startEditGuildId() {
    setDiscordGuildId(discordConfig?.guildId ?? "");
    setEditingGuildId(true);
  }

  function cancelEditGuildId() {
    setDiscordGuildId(discordConfig?.guildId ?? "");
    setEditingGuildId(false);
  }

  async function testDiscordIntegration() {
    if (!token || discordTestBusy) return;
    setDiscordTestBusy(true);
    try {
      const result = await apiJson<DiscordConnectionResult>(`/organizations/${workspaceId}/discord-integration/test`, {
        method: "POST",
        token,
      });
      setConnectionStatus(result);
    } catch (e) {
      setConnectionStatus({ ok: false, reason: e instanceof Error ? e.message : "Connection test failed" });
    } finally {
      setDiscordTestBusy(false);
    }
  }

  async function disconnectDiscordIntegration() {
    if (!token || discordSaveBusy) return;
    setDiscordSaveBusy(true);
    setConnectionStatus(null);
    try {
      await apiVoid(`/organizations/${workspaceId}/discord-integration`, { method: "DELETE", token });
      setDiscordConfig(null);
      setDiscordGuildId("");
      await queryClient.invalidateQueries({ queryKey: discordKeys.channels(workspaceId) });
    } catch (e) {
      setConnectionStatus({ ok: false, reason: e instanceof Error ? e.message : "Could not disconnect Discord" });
    } finally {
      setDiscordSaveBusy(false);
    }
  }

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
      setEditingOrgName(false);
      await reload();
      await reloadWorkspaceList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename organization");
    } finally {
      setSaveBusy(false);
    }
  }

  function startEditOrgName() {
    setRename(org?.name ?? "");
    setError(null);
    setEditingOrgName(true);
  }

  function cancelEditOrgName() {
    setRename(org?.name ?? "");
    setError(null);
    setEditingOrgName(false);
  }

  async function saveTimeZone() {
    if (!token || !timeZoneDraft || timeZoneSaveBusy) return;
    setTimeZoneSaveBusy(true);
    setError(null);
    try {
      const o = await apiJson<Org>(`/organizations/${workspaceId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ timeZone: timeZoneDraft }),
      });
      setOrg(o);
      setEditingTimeZone(false);
      await reload();
      await reloadWorkspaceList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update timezone");
    } finally {
      setTimeZoneSaveBusy(false);
    }
  }

  function startEditTimeZone() {
    setTimeZoneDraft(org?.timeZone ?? "");
    setError(null);
    setEditingTimeZone(true);
  }

  function cancelEditTimeZone() {
    setTimeZoneDraft(org?.timeZone ?? "");
    setError(null);
    setEditingTimeZone(false);
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
      description: `“${org.name}” and all of its ${NODE_LABELS.level.toLowerCase()}s, ${NODE_LABELS.list.toLowerCase()}s, tasks, and members will be permanently removed. This cannot be undone.`,
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
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-2">
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
          className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 sm:p-7"
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
        <SettingsCard
          icon={faBuilding}
          title="Rename organization"
          description="This updates how the organization appears across your workspace list."
        >
          <EditableField
            label="Name"
            value={org.name}
            editing={editingOrgName}
            onEdit={startEditOrgName}
            onCancel={cancelEditOrgName}
            action={
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
            }
          >
            <input
              id="org-rename-input"
              aria-label="Name"
              className="input rounded-xl"
              value={rename}
              disabled={saveBusy}
              onChange={(e) => setRename(e.target.value)}
              autoFocus
            />
          </EditableField>
        </SettingsCard>
      )}
      {!orgLoading && org ? (
        <SettingsCard
          icon={faClock}
          title="Time zone"
          description="Due dates, activity timestamps, and the Discord bot all display times in this timezone."
        >
          <EditableField
            label="Time zone"
            value={TIMEZONE_GROUPS.flatMap((g) => g.zones).find((z) => z.value === org.timeZone)?.label ?? org.timeZone}
            editing={editingTimeZone}
            onEdit={startEditTimeZone}
            onCancel={cancelEditTimeZone}
            action={
              <button
                type="button"
                className="btn-primary inline-flex min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5"
                disabled={timeZoneSaveBusy}
                aria-busy={timeZoneSaveBusy || undefined}
                onClick={() => void saveTimeZone()}
              >
                {timeZoneSaveBusy ? (
                  <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
                ) : null}
                <span>{timeZoneSaveBusy ? "Saving" : "Save time zone"}</span>
              </button>
            }
          >
            <select
              id="org-timezone-select"
              aria-label="Time zone"
              className="input rounded-xl"
              value={timeZoneDraft}
              disabled={timeZoneSaveBusy}
              onChange={(e) => setTimeZoneDraft(e.target.value)}
              autoFocus
            >
              {TIMEZONE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.zones.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </EditableField>
        </SettingsCard>
      ) : null}
      {!orgLoading && org && canDeleteOrg ? (
        <SettingsCard
          icon={faDiscord}
          title="Discord integration"
          description="Invite the bot to your Discord server, then connect it here so task attachments can be posted to a channel picked per task."
        >
          {discordLoading ? (
            <div className="h-10 w-full max-w-md animate-pulse rounded-xl bg-[var(--surface-muted)] motion-reduce:animate-none" />
          ) : (
            <>
              {discordInviteUrl ? (
                <a
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                >
                  Invite bot to your Discord server
                </a>
              ) : null}
              {discordConfig ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl bg-[var(--surface-muted)] px-3.5 py-3 text-xs">
                  <span
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      statusCheckBusy
                        ? "text-[var(--muted)]"
                        : connectionStatus?.ok
                          ? "text-emerald-600 dark:text-emerald-400"
                          : connectionStatus && !connectionStatus.ok
                            ? "text-red-600 dark:text-red-400"
                            : "text-[var(--muted)]"
                    }`}
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        statusCheckBusy
                          ? "animate-pulse bg-[var(--muted)]"
                          : connectionStatus?.ok
                            ? "bg-emerald-500"
                            : connectionStatus && !connectionStatus.ok
                              ? "bg-red-500"
                              : "bg-[var(--muted)]"
                      }`}
                      aria-hidden
                    />
                    {statusCheckBusy
                      ? "Checking connection…"
                      : connectionStatus?.ok
                        ? "Connected"
                        : connectionStatus
                          ? "Connection issue"
                          : "Status unknown"}
                  </span>
                  {connectionStatus?.ok && <span className="text-[var(--fg)]">{connectionStatus.guildName}</span>}
                  {connectionStatus && !connectionStatus.ok && (
                    <span className="text-red-600 dark:text-red-400">{connectionStatus.reason}</span>
                  )}
                  <span className="text-[var(--muted)]">
                    Connected since {formatInTimeZone(new Date(discordConfig.updatedAt), org.timeZone, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-[var(--muted)]">
                    {channelsQuery.isLoading
                      ? "Loading channels…"
                      : `${channelsQuery.data?.length ?? 0} channel${(channelsQuery.data?.length ?? 0) === 1 ? "" : "s"} available`}
                  </span>
                </div>
              ) : null}
              <div className="mt-3">
                <EditableField
                  label="Server (guild) ID"
                  value={<span className="font-mono-ledger">{discordConfig?.guildId}</span>}
                  editing={editingGuildId || !discordConfig}
                  onEdit={discordConfig ? startEditGuildId : undefined}
                  onCancel={discordConfig ? cancelEditGuildId : undefined}
                  action={
                    <button
                      type="button"
                      className="btn-primary inline-flex min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-xl px-5"
                      disabled={discordSaveBusy || !discordGuildId.trim()}
                      aria-busy={discordSaveBusy || undefined}
                      onClick={() => void saveDiscordIntegration()}
                    >
                      {discordSaveBusy ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
                      <span>{discordSaveBusy ? "Saving" : discordConfig ? "Save" : "Connect"}</span>
                    </button>
                  }
                >
                  <input
                    id="discord-guild-id-input"
                    aria-label="Server (guild) ID"
                    className="input rounded-xl"
                    value={discordGuildId}
                    disabled={discordSaveBusy}
                    onChange={(e) => setDiscordGuildId(e.target.value)}
                    placeholder="123456789012345678"
                    autoComplete="off"
                    autoFocus={editingGuildId}
                  />
                </EditableField>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {discordConfig ? (
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-4"
                    disabled={discordTestBusy}
                    aria-busy={discordTestBusy || undefined}
                    onClick={() => void testDiscordIntegration()}
                  >
                    {discordTestBusy ? "Testing…" : "Test connection"}
                  </button>
                ) : null}
                {discordConfig ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--muted)] underline decoration-dotted hover:text-[var(--fg)]"
                    disabled={discordSaveBusy}
                    onClick={() => void disconnectDiscordIntegration()}
                  >
                    Disconnect
                  </button>
                ) : null}
              </div>
            </>
          )}
        </SettingsCard>
      ) : null}
      {!orgLoading && org && canDeleteOrg ? (
        <SettingsCard
          icon={faTriangleExclamation}
          title="Delete organization"
          description={`Permanently delete this workspace, all ${NODE_LABELS.level.toLowerCase()}s, ${NODE_LABELS.list.toLowerCase()}s, tasks, and members. This cannot be undone.`}
          tone="danger"
        >
          <label className="block text-xs font-medium text-[var(--muted)]" htmlFor="org-delete-confirm-input">
            Type <span className="font-semibold text-[var(--fg)]">{org.name}</span> to confirm
          </label>
          <input
            id="org-delete-confirm-input"
            className="input mt-1.5 w-full max-w-md rounded-xl focus:!border-red-500 focus-visible:!outline-red-400"
            value={deleteConfirm}
            disabled={deleteBusy}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
            placeholder="Organization name"
          />
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-red-500 px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
            disabled={deleteBusy || deleteConfirm.trim() !== org.name.trim()}
            aria-busy={deleteBusy || undefined}
            onClick={() => openOrgDeleteDialog()}
          >
            {deleteBusy ? "Deleting…" : "Delete organization forever"}
          </button>
        </SettingsCard>
      ) : null}
    </div>
  );
}
