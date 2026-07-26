"use client";

import { useEffect, useState } from "react";
import { useWorkspaceRoute } from "@/components/app/workspace-route-context";
import { apiJson, apiVoid } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { InlineSpinner } from "@/components/ui/InlineSpinner";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";
import { isWorkspaceOwner } from "@/lib/workspace-permissions";
import type { MemberRow } from "@/lib/ledger-types";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { Avatar } from "@/components/ui/Avatar";
import { SettingsCard } from "@/components/ui/SettingsCard";
import { faUsers, faUserPlus, faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type EditState = {
  role: "owner" | "manager" | "member";
  deptIds: Set<string>;
  saving: boolean;
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  member: "bg-[var(--surface-muted)] text-[var(--fg-muted,var(--muted))]",
};

export default function PeoplePage() {
  const { workspaceId } = useWorkspaceRoute();
  const { token, session } = useApiSession();
  const { depts, members, error, setError, reload } = useWorkspaceData();
  const currentUserId = session?.user?.id ?? null;
  const amOwner = isWorkspaceOwner(members, currentUserId);

  // Invite form
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "manager" | "member">("member");
  const [memberDeptIds, setMemberDeptIds] = useState<Set<string>>(() => new Set());

  // Per-card edit state
  const [editMap, setEditMap] = useState<Map<string, EditState>>(() => new Map());
  // Which member is pending delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (depts.length === 0 || memberRole !== "manager") return;
    setMemberDeptIds((prev) => (prev.size === 0 ? new Set([depts[0]!.id]) : prev));
  }, [depts, memberRole]);

  function toggleMemberDept(id: string) {
    setMemberDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(m: MemberRow) {
    setDeleteConfirm(null);
    setEditMap((prev) => {
      const next = new Map(prev);
      next.set(m.userId, {
        role: m.role as "owner" | "manager" | "member",
        deptIds: new Set(m.managedDepartmentIds),
        saving: false,
      });
      return next;
    });
  }

  function cancelEdit(userId: string) {
    setEditMap((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  }

  function updateEditRole(userId: string, role: "owner" | "manager" | "member") {
    setEditMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(userId);
      if (!cur) return prev;
      const deptIds =
        role === "manager" && cur.deptIds.size === 0 && depts.length > 0
          ? new Set([depts[0]!.id])
          : cur.deptIds;
      next.set(userId, { ...cur, role, deptIds });
      return next;
    });
  }

  function toggleEditDept(userId: string, deptId: string) {
    setEditMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(userId);
      if (!cur) return prev;
      const deptIds = new Set(cur.deptIds);
      if (deptIds.has(deptId)) deptIds.delete(deptId);
      else deptIds.add(deptId);
      next.set(userId, { ...cur, deptIds });
      return next;
    });
  }

  async function saveEdit(m: MemberRow) {
    const edit = editMap.get(m.userId);
    if (!edit || !token) return;
    if (edit.role === "manager" && edit.deptIds.size === 0) {
      setError(`Select at least one ${NODE_LABELS.level.toLowerCase()} for managers.`);
      return;
    }
    setError(null);
    setEditMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(m.userId);
      if (cur) next.set(m.userId, { ...cur, saving: true });
      return next;
    });
    try {
      const body: Record<string, unknown> = { email: m.email, role: edit.role };
      if (edit.role === "manager") body.departmentIds = [...edit.deptIds];
      await apiJson(`/organizations/${workspaceId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      cancelEdit(m.userId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update member");
      setEditMap((prev) => {
        const next = new Map(prev);
        const cur = next.get(m.userId);
        if (cur) next.set(m.userId, { ...cur, saving: false });
        return next;
      });
    }
  }

  async function deleteMember(userId: string) {
    if (!token || removeBusy) return;
    setError(null);
    setRemoveBusy(true);
    try {
      await apiVoid(`/organizations/${workspaceId}/members/${userId}`, {
        method: "DELETE",
        token,
      });
      setDeleteConfirm(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member");
    } finally {
      setRemoveBusy(false);
    }
  }

  async function addMember() {
    if (!token || !memberEmail.trim() || inviteBusy) return;
    if (memberRole === "manager" && memberDeptIds.size === 0) {
      setError(`Select at least one ${NODE_LABELS.level.toLowerCase()} for managers.`);
      return;
    }
    setError(null);
    setInviteBusy(true);
    try {
      const body: Record<string, unknown> = { email: memberEmail.trim(), role: memberRole };
      if (memberRole === "manager") body.departmentIds = [...memberDeptIds];
      await apiJson(`/organizations/${workspaceId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setMemberEmail("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add member");
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,104rem)] space-y-2">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Who can access this {NODE_LABELS.workspace.toLowerCase()} and, for managers, which{" "}
          {NODE_LABELS.level.toLowerCase()}(s) they cover.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
          <FontAwesomeIcon icon={faUsers} className="size-3.5" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">Members</h2>
        <span className="text-xs text-[var(--muted)]">
          {members.length} {members.length === 1 ? "person" : "people"} with access
        </span>
      </div>

      {/* Member cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const editing = editMap.get(m.userId);
            const isSelf = m.userId === currentUserId;
            const canManage = amOwner && !isSelf;
            const isConfirmingDelete = deleteConfirm === m.userId;

            return (
              <div
                key={m.userId}
                className="ui-elevated-panel flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4"
              >
                {/* Header: avatar + name/email + role badge */}
                <div className="flex items-start gap-3">
                  <Avatar
                    name={m.name}
                    email={m.email}
                    image={m.image}
                    size="h-10 w-10"
                    className="bg-[var(--surface-muted)] text-sm font-semibold uppercase"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{m.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{m.email}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_BADGE[m.role] ?? ROLE_BADGE.member}`}
                  >
                    {m.role}
                  </span>
                </div>

                {/* Managed levels (read mode) */}
                {!editing && m.role === "manager" && m.managedDepartmentIds.length > 0 && (
                  <p className="text-xs text-[var(--muted)]">
                    <span className="font-medium">{NODE_LABELS.level}:</span>{" "}
                    {m.managedDepartmentIds
                      .map((id) => depts.find((d) => d.id === id)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}

                {/* Inline edit form */}
                {editing && (
                  <div className="space-y-3 border-t border-[var(--border-subtle)] pt-3">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--muted)]">Role</label>
                      <SelectPopover
                        value={editing.role}
                        onChange={(v) => updateEditRole(m.userId, v as EditState["role"])}
                        options={[
                          { value: "member", label: "Member" },
                          { value: "manager", label: "Manager" },
                          { value: "owner", label: "Owner" },
                        ]}
                        disabled={editing.saving}
                        aria-label="Role"
                      />
                    </div>
                    {editing.role === "manager" && (
                      <div>
                        <label className="mb-1 block text-xs text-[var(--muted)]">
                          {NODE_LABELS.level} (select one or more)
                        </label>
                        <ul className="max-h-32 space-y-1.5 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-2">
                          {depts.map((d) => (
                            <li key={d.id}>
                              <label className="flex cursor-pointer items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={editing.deptIds.has(d.id)}
                                  onChange={() => toggleEditDept(m.userId, d.id)}
                                  disabled={editing.saving}
                                />
                                {d.name}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                        onClick={() => void saveEdit(m)}
                        disabled={editing.saving}
                        aria-busy={editing.saving || undefined}
                      >
                        {editing.saving ? <InlineSpinner className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
                        <span>{editing.saving ? "Saving" : "Save"}</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                        onClick={() => cancelEdit(m.userId)}
                        disabled={editing.saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete confirmation */}
                {isConfirmingDelete && !editing && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/[0.04] p-3 text-xs dark:bg-red-500/[0.06]">
                    <p className="mb-2 font-medium text-red-700 dark:text-red-300">Remove {m.name} from the workspace?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
                        onClick={() => void deleteMember(m.userId)}
                        disabled={removeBusy}
                        aria-busy={removeBusy || undefined}
                      >
                        {removeBusy ? <InlineSpinner className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
                        <span>{removeBusy ? "Removing" : "Remove"}</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                        onClick={() => setDeleteConfirm(null)}
                        disabled={removeBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Edit / Remove actions — owner only, not self, not while editing or confirming delete */}
                {canManage && !editing && !isConfirmingDelete && (
                  <div className="flex gap-2 border-t border-[var(--border-subtle)] pt-3">
                    <button
                      type="button"
                      className="btn-secondary inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                      onClick={() => startEdit(m)}
                    >
                      <FontAwesomeIcon icon={faPen} className="size-3" aria-hidden />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
                      onClick={() => setDeleteConfirm(m.userId)}
                    >
                      <FontAwesomeIcon icon={faTrash} className="size-3" aria-hidden />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <SettingsCard
        icon={faUserPlus}
        title="Invite by email"
        description="They must already have an account. Owners can add or update roles."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="sm:w-64">
            <label className="mb-1.5 block text-xs text-[var(--muted)]" htmlFor="invite-email-input">
              Email
            </label>
            <input
              id="invite-email-input"
              type="email"
              className="input rounded-xl"
              placeholder="colleague@company.com"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">Role</label>
            <SelectPopover
              value={memberRole}
              onChange={(v) => setMemberRole(v as typeof memberRole)}
              options={[
                { value: "member", label: "Member" },
                { value: "manager", label: "Manager" },
                { value: "owner", label: "Owner" },
              ]}
              aria-label="Role"
            />
          </div>
        </div>
        {memberRole === "manager" && (
          <div className="mt-4 sm:max-w-md">
            <label className="mb-1.5 block text-xs text-[var(--muted)]">
              {NODE_LABELS.level}
              {` (select one or more)`}
            </label>
            <ul className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-3">
              {depts.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded border-[var(--border-subtle)]"
                      checked={memberDeptIds.has(d.id)}
                      onChange={() => toggleMemberDept(d.id)}
                    />
                    {d.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="btn-primary mt-4 inline-flex min-w-[9rem] items-center justify-center gap-2 rounded-xl px-5"
          onClick={() => void addMember()}
          disabled={inviteBusy || !memberEmail.trim()}
          aria-busy={inviteBusy || undefined}
        >
          {inviteBusy ? <InlineSpinner className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : null}
          <span>{inviteBusy ? "Adding" : "Invite User"}</span>
        </button>
      </SettingsCard>
    </div>
  );
}
