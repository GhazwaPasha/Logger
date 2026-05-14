"use client";

import { authClient } from "@/lib/auth-client";
import { useWorkspaceData } from "./WorkspaceDataProvider";
import { useOnlinePresence } from "./OnlinePresenceProvider";

const MAX_SHOWN = 5;

function initials(name: string, email: string): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]?.[0];
      const b = parts[parts.length - 1]?.[0];
      if (a && b) return (a + b).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function OnlineMembersAvatars() {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const { members } = useWorkspaceData();
  const { onlineUserIds } = useOnlinePresence();

  const onlineMembers = members.filter(
    (m) => onlineUserIds.has(m.userId) && m.userId !== currentUserId,
  );

  if (onlineMembers.length === 0) return null;

  const shown = onlineMembers.slice(0, MAX_SHOWN);
  const overflow = onlineMembers.length - MAX_SHOWN;

  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.userId}
          className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold uppercase tracking-tight text-[var(--fg)] ring-2 ring-[var(--bg-header)]${i > 0 ? " -ml-2" : ""}`}
          title={m.name || m.email}
        >
          {m.image ? (
            <img src={m.image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span aria-hidden>{initials(m.name, m.email)}</span>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] text-[10px] font-semibold text-[var(--muted)] ring-2 ring-[var(--bg-header)]">
          +{overflow}
        </div>
      )}
    </div>
  );
}
