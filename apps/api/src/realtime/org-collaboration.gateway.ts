import { Logger, OnModuleDestroy } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { HttpException } from "@nestjs/common";
import { REALTIME_EVENTS, type ApiErrorCode, type RealtimeRejection, isApiErrorCode } from "@work-ledger/contracts";
import type { Server, Socket } from "socket.io";
import type { RedisClientType } from "redis";
import { AuthService } from "../auth/auth.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { corsAllowedOrigins } from "../cors-origins";
import { CollaborationService, orgSocketRoom, userSocketRoom } from "./collaboration.service";

export type PresenceSyncPayload = { onlineUserIds: string[]; awayUserIds: string[] };
export type PresenceUpdatePayload = { userId: string; status: "online" | "offline" | "away" };

type SocketIdentity = { userId: string; organizationId: string };

/** Handshakes allowed per user per minute. A healthy client needs one per page load / network blip. */
const HANDSHAKES_PER_USER_PER_MINUTE = 30;

/** Credential problems are fixed by re-minting; everything else except membership is transient. */
const TERMINAL_CODES: readonly ApiErrorCode[] = ["NOT_A_MEMBER", "NOT_FOUND"];

/** A handshake refusal the client receives as `connect_error` with typed `data`. */
function rejection(code: ApiErrorCode, message: string): Error & { data: RealtimeRejection } {
  return Object.assign(new Error(message), { data: { code, retryable: !TERMINAL_CODES.includes(code) } });
}

/**
 * Org-scoped collaboration channel.
 *
 * Authentication and membership are enforced in Socket.IO middleware, i.e. during the handshake: a
 * refused client never becomes "connected", and receives a typed {@link RealtimeRejection} telling it
 * whether retrying can ever help. Clients re-read their token on every reconnect attempt, so token
 * renewal never requires tearing the connection down.
 */
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

  /** userId → recent handshake timestamps (sliding one-minute window). */
  private readonly handshakes = new Map<string, number[]>();

  private allowHandshake(userId: string): boolean {
    const now = Date.now();
    const recent = (this.handshakes.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= HANDSHAKES_PER_USER_PER_MINUTE) {
      this.handshakes.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.handshakes.set(userId, recent);
    return true;
  }

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
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        (err: Error & { data?: RealtimeRejection }) => {
          this.log.warn(
            `Socket handshake refused (${err.data?.code ?? "SERVER_ERROR"}): ${err.message} ip=${socket.handshake.address}`,
          );
          next(err);
        },
      );
    });

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

  /** Handshake middleware body: resolves identity or throws a typed rejection. */
  private async authenticate(socket: Socket): Promise<void> {
    const auth = socket.handshake.auth as { token?: unknown; organizationId?: unknown };
    const token = typeof auth?.token === "string" ? auth.token : "";
    const organizationId = typeof auth?.organizationId === "string" ? auth.organizationId : "";
    if (!token) throw rejection("TOKEN_MISSING", "Missing token");
    if (!organizationId) throw rejection("NOT_FOUND", "Missing organizationId");

    let userId: string;
    try {
      userId = (await this.auth.verifyBearerJwt(token)).sub as string;
    } catch (e) {
      throw this.toRejection(e);
    }

    if (!this.allowHandshake(userId)) throw rejection("RATE_LIMITED", "Too many connection attempts");

    let isMember: boolean;
    try {
      isMember = (await this.authz.findMembership(userId, organizationId)) !== null;
    } catch (e) {
      throw rejection("SERVER_ERROR", e instanceof Error ? e.message : "Membership lookup failed");
    }
    if (!isMember) throw rejection("NOT_A_MEMBER", "Not a member of this organization");

    const identity: SocketIdentity = { userId, organizationId };
    socket.data = identity;
  }

  private toRejection(e: unknown): Error & { data: RealtimeRejection } {
    if (e instanceof HttpException) {
      const body = e.getResponse() as { code?: unknown; message?: unknown };
      const code = isApiErrorCode(body?.code) ? body.code : "TOKEN_INVALID";
      return rejection(code, typeof body?.message === "string" ? body.message : e.message);
    }
    return rejection("SERVER_ERROR", e instanceof Error ? e.message : String(e));
  }

  async handleConnection(client: Socket): Promise<void> {
    const { userId, organizationId } = client.data as SocketIdentity;
    await client.join([orgSocketRoom(organizationId), userSocketRoom(userId)]);
    this.addPresence(organizationId, userId, client.id);

    const syncPayload: PresenceSyncPayload = {
      onlineUserIds: this.onlineUserIds(organizationId),
      awayUserIds: this.awayUserIds(organizationId),
    };
    client.emit(REALTIME_EVENTS.presenceSync, syncPayload);

    const updatePayload: PresenceUpdatePayload = { userId, status: "online" };
    client.to(orgSocketRoom(organizationId)).emit(REALTIME_EVENTS.presenceUpdate, updatePayload);
  }

  handleDisconnect(client: Socket): void {
    const { userId, organizationId } = (client.data ?? {}) as Partial<SocketIdentity>;
    if (!userId || !organizationId) return;
    this.awayUsers.get(organizationId)?.delete(userId);
    const wasLast = this.removePresence(organizationId, userId, client.id);
    if (wasLast) {
      const payload: PresenceUpdatePayload = { userId, status: "offline" };
      this.server.to(orgSocketRoom(organizationId)).emit(REALTIME_EVENTS.presenceUpdate, payload);
    }
  }

  @SubscribeMessage(REALTIME_EVENTS.presenceAway)
  handleAway(client: Socket): void {
    const { userId, organizationId } = (client.data ?? {}) as Partial<SocketIdentity>;
    if (!userId || !organizationId) return;
    if (!this.awayUsers.has(organizationId)) this.awayUsers.set(organizationId, new Set());
    this.awayUsers.get(organizationId)!.add(userId);
    const payload: PresenceUpdatePayload = { userId, status: "away" };
    this.server.to(orgSocketRoom(organizationId)).emit(REALTIME_EVENTS.presenceUpdate, payload);
  }

  @SubscribeMessage(REALTIME_EVENTS.presenceActive)
  handleActive(client: Socket): void {
    const { userId, organizationId } = (client.data ?? {}) as Partial<SocketIdentity>;
    if (!userId || !organizationId) return;
    this.awayUsers.get(organizationId)?.delete(userId);
    const payload: PresenceUpdatePayload = { userId, status: "online" };
    this.server.to(orgSocketRoom(organizationId)).emit(REALTIME_EVENTS.presenceUpdate, payload);
  }
}
