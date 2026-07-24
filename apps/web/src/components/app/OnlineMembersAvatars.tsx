"use client";

import { Avatar } from "@/components/ui/Avatar";
import { authClient } from "@/lib/auth-client";
import { useWorkspaceData } from "./WorkspaceDataProvider";
import { useOnlinePresence } from "./OnlinePresenceProvider";

const MAX_SHOWN = 5;

export function OnlineMembersAvatars() {
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const { members } = useWorkspaceData();
  const { onlineUserIds, awayUserIds } = useOnlinePresence();

  const onlineMembers = members.filter(
    (m) =>
      onlineUserIds.has(m.userId) &&
      !awayUserIds.has(m.userId) &&
      m.userId !== currentUserId,
  );

  if (onlineMembers.length === 0) return null;

  const shown = onlineMembers.slice(0, MAX_SHOWN);
  const overflow = onlineMembers.length - MAX_SHOWN;

  return (
    <div className="flex items-center gap-1.5" role="list" aria-label={`${onlineMembers.length} teammate${onlineMembers.length === 1 ? "" : "s"} online`}>
      {shown.map((m) => (
          <div
            key={m.userId}
            role="listitem"
            className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--accent-muted)] text-[10px] font-semibold uppercase tracking-tight text-[var(--fg)]"
            title={m.name || m.email}
          >
            <Avatar name={m.name} email={m.email} image={m.image} size="size-full" />
          </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[10px] font-semibold text-[var(--muted)]"
          title={`${overflow} more online`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
