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
    <div className="flex items-center" role="list" aria-label={`${onlineMembers.length} teammate${onlineMembers.length === 1 ? "" : "s"} online`}>
      {shown.map((m, i) => (
          <div
            key={m.userId}
            role="listitem"
            className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--bg-header)] bg-[var(--accent-muted)] text-[9px] font-semibold uppercase tracking-tight text-[var(--fg)] ${i > 0 ? "-ml-2" : ""}`}
            style={{ zIndex: shown.length - i }}
            title={m.name || m.email}
          >
            <Avatar name={m.name} email={m.email} image={m.image} size="size-full" />
          </div>
      ))}
      {overflow > 0 && (
        <div
          className="-ml-2 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bg-header)] bg-[var(--surface-elevated)] text-[9px] font-semibold text-[var(--muted)]"
          style={{ zIndex: 0 }}
          title={`${overflow} more online`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
