import { Logger, OnModuleDestroy } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { RedisClientType } from "redis";
import { AuthService } from "../auth/auth.service";
import { AuthorizationService } from "../authorization/authorization.service";
import { corsAllowedOrigins } from "../cors-origins";
import { CollaborationService, orgSocketRoom } from "./collaboration.service";

/**
 * Org-scoped collaboration channel. Auth uses handshake `auth.token` (JWT) and
 * `auth.organizationId` (must be an org the user belongs to).
 *
 * Global `JwtAuthGuard` skips `ws` contexts; we verify JWT here in `handleConnection`.
 */
@WebSocketGateway({
  cors: {
    origin: corsAllowedOrigins(),
    credentials: true,
  },
  transports: ["websocket", "polling"],
})
export class OrgCollaborationGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly log = new Logger(OrgCollaborationGateway.name);

  @WebSocketServer()
  server!: Server;

  private redisPub: RedisClientType | null = null;
  private redisSub: RedisClientType | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
  ) {}

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
      await client.join(orgSocketRoom(organizationId));
    } catch (e) {
      this.log.debug(`Socket auth failed: ${e instanceof Error ? e.message : String(e)}`);
      client.emit("collaboration_auth_error", { reason: "unauthorized" });
      client.disconnect(true);
    }
  }
}
