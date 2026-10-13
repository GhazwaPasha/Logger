import { Injectable } from "@nestjs/common";
import { REALTIME_EVENTS, type WorkspaceChangedEvent } from "@work-ledger/contracts";
import type { Server } from "socket.io";
import { membershipCacheKey } from "../authorization/authorization.service";
import { MemoryCacheService } from "../cache/memory-cache.service";

export function orgSocketRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

export function userSocketRoom(userId: string): string {
  return `user:${userId}`;
}

@Injectable()
export class CollaborationService {
  private server: Server | null = null;
  /** Per-org data version. See {@link dataVersion}. */
  private readonly versions = new Map<string, number>();

  constructor(private readonly cache: MemoryCacheService) {}

  bindServer(server: Server): void {
    this.server = server;
  }

  /**
   * Monotonic version of everything readable in an organization, bumped on every committed write.
   * It's a hybrid logical clock (`max(last + 1, now)`), so it keeps increasing across restarts
   * without being persisted — a restart simply makes every client's cached version stale once.
   * Read endpoints derive their ETags from it, so revalidating unchanged data costs no database work.
   */
  dataVersion(organizationId: string): number {
    let v = this.versions.get(organizationId);
    if (v === undefined) {
      v = Date.now();
      this.versions.set(organizationId, v);
    }
    return v;
  }

  private bumpVersion(organizationId: string): number {
    const next = Math.max((this.versions.get(organizationId) ?? 0) + 1, Date.now());
    this.versions.set(organizationId, next);
    return next;
  }

  /**
   * Safe to call from HTTP handlers after DB commits — never throws. Invalidates every derived read
   * for the org and tells connected clients what changed, so they refresh only that.
   */
  notifyOrgChanged(organizationId: string, taskId?: string | null): void {
    const version = this.bumpVersion(organizationId);
    this.cache.invalidatePrefix(`roadmap:${organizationId}`);
    this.cache.invalidatePrefix(`workspace:${organizationId}`);
    this.cache.invalidatePrefix(`perf:scorecards:${organizationId}`);
    this.cache.invalidatePrefix(`tasks:${organizationId}`);
    this.cache.invalidatePrefix(`taskcounts:${organizationId}`);
    this.cache.invalidatePrefix(`seriessummary:${organizationId}`);
    this.cache.invalidatePrefix(`activity:${organizationId}`);
    this.cache.invalidatePrefix(membershipCacheKey(organizationId));
    if (!this.server) return;
    const event: WorkspaceChangedEvent = {
      organizationId,
      version,
      scope: taskId ? "task" : "workspace",
      taskId: taskId ?? null,
    };
    try {
      this.server.to(orgSocketRoom(organizationId)).emit(REALTIME_EVENTS.workspaceChanged, event);
    } catch {
      /* realtime is best-effort; HTTP reads stay correct via versions */
    }
  }

  /** Drops a removed member's live sockets for that org immediately, rather than at their next reconnect. */
  revokeMembership(organizationId: string, userId: string): void {
    this.cache.invalidatePrefix(membershipCacheKey(organizationId, userId));
    if (!this.server) return;
    void this.server
      .in(userSocketRoom(userId))
      .fetchSockets()
      .then((sockets) => {
        for (const s of sockets) {
          if ((s.data as { organizationId?: string }).organizationId === organizationId) s.disconnect(true);
        }
      })
      .catch(() => undefined);
  }
}
