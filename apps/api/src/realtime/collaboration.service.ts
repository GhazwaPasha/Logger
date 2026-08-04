import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";
import { MemoryCacheService } from "../cache/memory-cache.service";

export type WorkspaceChangedPayload = {
  type: "workspace_changed";
  organizationId: string;
  taskId: string | null;
  at: string;
};

export function orgSocketRoom(organizationId: string): string {
  return `org:${organizationId}`;
}

export function userSocketRoom(userId: string): string {
  return `user:${userId}`;
}

@Injectable()
export class CollaborationService {
  private server: Server | null = null;

  constructor(private readonly cache: MemoryCacheService) {}

  bindServer(server: Server): void {
    this.server = server;
  }

  /** Notify all sockets joined to this org room (including the actor — refetch is harmless). */
  emitWorkspaceChanged(organizationId: string, taskId?: string | null): void {
    if (!this.server) return;
    const payload: WorkspaceChangedPayload = {
      type: "workspace_changed",
      organizationId,
      taskId: taskId ?? null,
      at: new Date().toISOString(),
    };
    this.server.to(orgSocketRoom(organizationId)).emit("workspace_changed", payload);
  }

  /** Safe to call from HTTP handlers after DB commits — never throws. */
  notifyOrgChanged(organizationId: string, taskId?: string | null): void {
    // Coarse but correct: busts every date-range/requester variant for this org rather than
    // computing exactly which mutation affected which cached endpoint.
    this.cache.invalidatePrefix(`roadmap:${organizationId}`);
    this.cache.invalidatePrefix(`workspace:${organizationId}`);
    this.cache.invalidatePrefix(`perf:scorecards:${organizationId}`);
    this.cache.invalidatePrefix(`tasks:${organizationId}`);
    try {
      this.emitWorkspaceChanged(organizationId, taskId);
    } catch {
      /* ignore realtime failures */
    }
  }
}
