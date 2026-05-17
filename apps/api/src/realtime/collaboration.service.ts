import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

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
    try {
      this.emitWorkspaceChanged(organizationId, taskId);
    } catch {
      /* ignore realtime failures */
    }
  }

  /** Push a real-time event to a specific user's personal room — never throws. */
  notifyUser(userId: string, payload: Record<string, unknown>): void {
    try {
      if (!this.server) return;
      this.server.to(userSocketRoom(userId)).emit(payload["event"] as string, payload);
    } catch {
      /* ignore realtime failures */
    }
  }
}
