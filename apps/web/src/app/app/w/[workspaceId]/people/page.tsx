"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useApiSession } from "@/hooks/useApiSession";
import { useWorkspaceData } from "@/components/app/WorkspaceDataProvider";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { NODE_LABELS } from "@/lib/nodes";
import { setLastWorkspaceId } from "@/lib/workspace-storage";

export default function PeoplePage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const { token } = useApiSession();
  const { depts, members, error, setError, reload } = useWorkspaceData();
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"owner" | "manager" | "member">("member");
  const [memberDeptId, setMemberDeptId] = useState("");

  useEffect(() => {
    setLastWorkspaceId(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    if (depts.length && !memberDeptId) setMemberDeptId(depts[0]!.id);
  }, [depts, memberDeptId]);

  async function addMember() {
    if (!token || !memberEmail.trim()) return;
    if (memberRole === "manager" && !memberDeptId) {
      setError("Select a level for managers.");
      return;
    }
    setError(null);
    try {
      const body: Record<string, unknown> = { email: memberEmail.trim(), role: memberRole };
      if (memberRole === "manager") body.departmentId = memberDeptId;
      await apiJson(`/organizations/${workspaceId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      setMemberEmail("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add member");
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Who can access this {NODE_LABELS.workspace.toLowerCase()} and, for managers, which {NODE_LABELS.level.toLowerCase()} they cover.
        </p>
      </div>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="mt-4 divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-[var(--muted)]">{m.email}</span>
              </div>
              <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium capitalize">
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="surface-elevated rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Invite by email</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">They must already have an account. Owners can add or update roles.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <input
              type="email"
              className="input rounded-xl"
              placeholder="colleague@company.com"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-[var(--muted)]">Role</label>
            <select className="input rounded-xl" value={memberRole} onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          {memberRole === "manager" && (
            <div>
              <label className="mb-1.5 block text-xs text-[var(--muted)]">{NODE_LABELS.level}</label>
              <select className="input rounded-xl" value={memberDeptId} onChange={(e) => setMemberDeptId(e.target.value)}>
                <option value="">Select…</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button type="button" className="btn-primary mt-4 rounded-xl" onClick={() => void addMember()}>
          Add or update member
        </button>
      </section>
    </div>
  );
}
