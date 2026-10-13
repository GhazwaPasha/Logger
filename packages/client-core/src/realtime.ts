import {
  REALTIME_EVENTS,
  TOKEN_REFRESHABLE_CODES,
  type RealtimeRejection,
  type WorkspaceChangedEvent,
} from "@work-ledger/contracts";
import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { SessionLostError } from "./errors.js";
import type { TokenManager } from "./token-manager.js";

export type PresenceSync = { onlineUserIds: string[]; awayUserIds?: string[] };
export type PresenceUpdate = { userId: string; status: "online" | "offline" | "away" };

export type RealtimeStatus =
  | { state: "connecting" }
  | { state: "connected" }
  /** Waiting `retryInMs` before the next attempt. */
  | { state: "reconnecting"; retryInMs: number }
  /** Will not reconnect on its own (terminal rejection, session lost, or closed). */
  | { state: "stopped"; rejection?: RealtimeRejection };

export type RealtimeHandlers = {
  onWorkspaceChanged?: (event: WorkspaceChangedEvent) => void;
  onPresenceSync?: (payload: PresenceSync) => void;
  onPresenceUpdate?: (payload: PresenceUpdate) => void;
  onStatus?: (status: RealtimeStatus) => void;
};

type IoFactory = (url: string, opts?: Partial<ManagerOptions & SocketOptions>) => Socket;

export type RealtimeClientOptions = RealtimeHandlers & {
  io: IoFactory;
  url: string;
  organizationId: string;
  tokens: TokenManager;
  transports?: ("websocket" | "polling")[];
  /** Backoff bounds for handshake rejections and server-side disconnects. */
  minDelayMs?: number;
  maxDelayMs?: number;
};

/**
 * One long-lived org socket per session.
 *
 * The socket is created once and never rebuilt on token renewal: the handshake `auth` is a callback,
 * so every (re)connect presents the token manager's *current* token. Handshake refusals arrive as
 * typed {@link RealtimeRejection}s — credential problems re-mint through the token manager (and its
 * circuit breaker), transient ones back off exponentially with full jitter, and terminal ones
 * (NOT_A_MEMBER) stop for good. Nothing here can invalidate caches or trigger app-wide refetches.
 */
export class RealtimeClient {
  private readonly socket: Socket;
  private readonly opts: RealtimeClientOptions;
  private lastToken: string | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private suspended = false;

  constructor(opts: RealtimeClientOptions) {
    this.opts = opts;
    this.socket = opts.io(opts.url, {
      path: "/socket.io/",
      transports: opts.transports ?? ["websocket", "polling"],
      autoConnect: false,
      // Transport drops (network blips, server restarts) are retried by Socket.IO itself, with jitter.
      reconnection: true,
      reconnectionDelay: opts.minDelayMs ?? 1_000,
      reconnectionDelayMax: opts.maxDelayMs ?? 30_000,
      randomizationFactor: 0.5,
      auth: (cb) => {
        opts.tokens.getToken().then(
          (token) => {
            this.lastToken = token;
            cb({ token, organizationId: opts.organizationId });
          },
          (err) => {
            if (err instanceof SessionLostError) this.stop();
            // Network trouble minting: present no token; the server refuses with a retryable code.
            cb({ token: "", organizationId: opts.organizationId });
          },
        );
      },
    });

    this.socket.on("connect", () => {
      this.attempt = 0;
      this.status({ state: "connected" });
    });
    this.socket.on("connect_error", (err: Error & { data?: RealtimeRejection }) => {
      // Without `data` this is a transport error, which the Manager already retries.
      if (err.data) void this.onRejected(err.data);
    });
    this.socket.on("disconnect", (reason) => {
      // The server closed us deliberately (e.g. membership revoked) — Socket.IO won't retry this one;
      // re-handshake so the server can tell us, with a typed rejection, whether we're still allowed in.
      if (reason === "io server disconnect") this.scheduleReconnect();
      else if (!this.stopped) this.status({ state: "connecting" });
    });
    this.socket.on(REALTIME_EVENTS.workspaceChanged, (e: WorkspaceChangedEvent) => {
      if (e?.organizationId === opts.organizationId) opts.onWorkspaceChanged?.(e);
    });
    this.socket.on(REALTIME_EVENTS.presenceSync, (p: PresenceSync) => opts.onPresenceSync?.(p));
    this.socket.on(REALTIME_EVENTS.presenceUpdate, (p: PresenceUpdate) => opts.onPresenceUpdate?.(p));

    this.connect();
  }

  get connected(): boolean {
    return this.socket.connected;
  }

  emit(event: string, ...args: unknown[]): void {
    if (this.socket.connected) this.socket.emit(event, ...args);
  }

  /** Disconnect while the app is backgrounded; {@link resume} reconnects. */
  suspend(): void {
    if (this.stopped) return;
    this.suspended = true;
    this.clearRetry();
    this.socket.disconnect();
  }

  resume(): void {
    if (this.stopped || !this.suspended) return;
    this.suspended = false;
    this.attempt = 0;
    this.connect();
  }

  /** Permanent shutdown. */
  close(): void {
    this.stop();
  }

  private connect(): void {
    if (this.stopped || this.suspended) return;
    this.status({ state: "connecting" });
    this.socket.connect();
  }

  private async onRejected(rejection: RealtimeRejection): Promise<void> {
    if (this.stopped) return;
    if (!rejection.retryable) {
      this.stop(rejection);
      return;
    }
    if (TOKEN_REFRESHABLE_CODES.includes(rejection.code) && this.lastToken) {
      try {
        await this.opts.tokens.refreshAfterRejection(this.lastToken);
      } catch {
        this.stop(rejection);
        return;
      }
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.suspended) return;
    this.clearRetry();
    const min = this.opts.minDelayMs ?? 1_000;
    const max = this.opts.maxDelayMs ?? 30_000;
    const ceiling = Math.min(max, min * 2 ** this.attempt);
    const delay = Math.round(min / 2 + Math.random() * (ceiling - min / 2));
    this.attempt++;
    this.status({ state: "reconnecting", retryInMs: delay });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private stop(rejection?: RealtimeRejection): void {
    if (this.stopped) return;
    this.stopped = true;
    this.clearRetry();
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.status({ state: "stopped", rejection });
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private status(s: RealtimeStatus): void {
    this.opts.onStatus?.(s);
  }
}
