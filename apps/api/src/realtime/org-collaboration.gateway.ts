import { Logger, OnModuleDestroy } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { RedisClientType } from "redis";
import { AuthService } from "../auth/auth.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { corsAllowedOrigins } from "../cors-origins";
import { CollaborationService, orgSocketRoom, userSocketRoom } from "./collaboration.service";

/**
 * Org-scoped collaboration channel. Auth uses handshake `auth.token` (JWT) and
 * `auth.organizationId` (must be an org the user belongs to).
 *
 * Global `JwtAuthGuard` skips `ws` contexts; we verify JWT here in `handleConnection`.
 */
export type PresenceSyncPayload = { onlineUserIds: string[]; awayUserIds: string[] };
export type PresenceUpdatePayload = { userId: string; status: "online" | "offline" | "away" };

@WebSocketGateway({
  cors: {
    origin: corsAllowedOrigins(),
    credentials: true,
  },
  transports: ["websocket", "polling"],
})
export class OrgCollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly log = new Logger(OrgCollaborationGateway.name);

  @WebSocketServer()
  server!: Server;

  private redisPub: RedisClientType | null = null;
  private redisSub: RedisClientType | null = null;

  /** orgId → userId → Set<socketId>: tracks multiple tabs per user */
  private readonly presence = new Map<string, Map<string, Set<string>>>();

  /** orgId → Set<userId>: users who are idle (away) */
  private readonly awayUsers = new Map<string, Set<string>>();

  constructor(
    private readonly auth: AuthService,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
  ) {}

  private addPresence(orgId: string, userId: string, socketId: string): void {
    if (!this.presence.has(orgId)) this.presence.set(orgId, new Map());
    const orgMap = this.presence.get(orgId)!;
    if (!orgMap.has(userId)) orgMap.set(userId, new Set());
    orgMap.get(userId)!.add(socketId);
  }

  /** Returns true when this was the user's last socket (they are now offline). */
  private removePresence(orgId: string, userId: string, socketId: string): boolean {
    const orgMap = this.presence.get(orgId);
    if (!orgMap) return false;
    const sockets = orgMap.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      orgMap.delete(userId);
      return true;
    }
    return false;
  }

  private onlineUserIds(orgId: string): string[] {
    return [...(this.presence.get(orgId)?.keys() ?? [])];
  }

  private awayUserIds(orgId: string): string[] {
    return [...(this.awayUsers.get(orgId) ?? [])];
  }

  async afterInit(server: Server): Promise<void> {
    this.collaboration.bindServer(server);

    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.log.log("Socket.IO: single-instance mode (REDIS_URL unset)");
      return;
    }

    try {
      const { createClient } = await import("redis");
      const { createAdapter } = await import("@socket.io/redis-adapter");
      const pubClient = createClient({ url: redisUrl }) as RedisClientType;
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      server.adapter(createAdapter(pubClient, subClient));
      this.redisPub = pubClient;
      this.redisSub = subClient;
      this.log.log("Socket.IO: Redis adapter enabled");
    } catch (e) {
      this.log.warn(
        `Socket.IO: Redis adapter failed (${e instanceof Error ? e.message : String(e)}); continuing single-instance`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.redisPub?.quit(), this.redisSub?.quit()]);
    this.redisPub = null;
    this.redisSub = null;
  }

  handleConnection(client: Socket): void {
    void this.verifyAndJoin(client);
  }

  handleDisconnect(client: Socket): void {
    const { userId, organizationId } = client.data as { userId?: string; organizationId?: string };
    if (!userId || !organizationId) return;
    this.awayUsers.get(organizationId)?.delete(userId);
    const wasLast = this.removePresence(organizationId, userId, client.id);
    if (wasLast) {
      const payload: PresenceUpdatePayload = { userId, status: "offline" };
      this.server.to(orgSocketRoom(organizationId)).emit("presence_update", payload);
    }
  }

  @SubscribeMessage("presence_away")
  handleAway(client: Socket): void {
    const { userId, organizationId } = client.data as { userId?: string; organizationId?: string };
    if (!userId || !organizationId) return;
    if (!this.awayUsers.has(organizationId)) this.awayUsers.set(organizationId, new Set());
    this.awayUsers.get(organizationId)!.add(userId);
    const payload: PresenceUpdatePayload = { userId, status: "away" };
    this.server.to(orgSocketRoom(organizationId)).emit("presence_update", payload);
  }

  @SubscribeMessage("presence_active")
  handleActive(client: Socket): void {
    const { userId, organizationId } = client.data as { userId?: string; organizationId?: string };
    if (!userId || !organizationId) return;
    this.awayUsers.get(organizationId)?.delete(userId);
    const payload: PresenceUpdatePayload = { userId, status: "online" };
    this.server.to(orgSocketRoom(organizationId)).emit("presence_update", payload);
  }

  private async verifyAndJoin(client: Socket): Promise<void> {
    try {
      const auth = client.handshake.auth as { token?: unknown; organizationId?: unknown };
      const token = typeof auth?.token === "string" ? auth.token : "";
      const organizationId = typeof auth?.organizationId === "string" ? auth.organizationId : "";
      if (!token || !organizationId) {
        client.emit("collaboration_auth_error", { reason: "missing_credentials" });
        client.disconnect(true);
        return;
      }
      const payload = await this.auth.verifyBearerJwt(token);
      const userId = typeof payload.sub === "string" ? payload.sub : "";
      if (!userId) {
        client.emit("collaboration_auth_error", { reason: "invalid_token" });
        client.disconnect(true);
        return;
      }
      await this.authz.assertOrgMember(userId, organizationId);
      await client.join([orgSocketRoom(organizationId), userSocketRoom(userId)]);

      client.data.userId = userId;
      client.data.organizationId = organizationId;

      this.addPresence(organizationId, userId, client.id);

      // Send current online snapshot to the newly connected client
      const syncPayload: PresenceSyncPayload = {
        onlineUserIds: this.onlineUserIds(organizationId),
        awayUserIds: this.awayUserIds(organizationId),
      };
      client.emit("presence_sync", syncPayload);

      // Notify others in the org room that this user came online
      const updatePayload: PresenceUpdatePayload = { userId, status: "online" };
      client.to(orgSocketRoom(organizationId)).emit("presence_update", updatePayload);
    } catch (e) {
      this.log.debug(`Socket auth failed: ${e instanceof Error ? e.message : String(e)}`);
      client.emit("collaboration_auth_error", { reason: "unauthorized" });
      client.disconnect(true);
    }
  }
}
