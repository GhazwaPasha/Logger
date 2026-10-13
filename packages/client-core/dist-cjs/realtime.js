"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeClient = void 0;
const contracts_1 = require("@work-ledger/contracts");
const errors_js_1 = require("./errors.js");
/**
 * One long-lived org socket per session.
 *
 * The socket is created once and never rebuilt on token renewal: the handshake `auth` is a callback,
 * so every (re)connect presents the token manager's *current* token. Handshake refusals arrive as
 * typed {@link RealtimeRejection}s — credential problems re-mint through the token manager (and its
 * circuit breaker), transient ones back off exponentially with full jitter, and terminal ones
 * (NOT_A_MEMBER) stop for good. Nothing here can invalidate caches or trigger app-wide refetches.
 */
class RealtimeClient {
    socket;
    opts;
    lastToken = null;
    attempt = 0;
    retryTimer = null;
    stopped = false;
    suspended = false;
    constructor(opts) {
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
                opts.tokens.getToken().then((token) => {
                    this.lastToken = token;
                    cb({ token, organizationId: opts.organizationId });
                }, (err) => {
                    if (err instanceof errors_js_1.SessionLostError)
                        this.stop();
                    // Network trouble minting: present no token; the server refuses with a retryable code.
                    cb({ token: "", organizationId: opts.organizationId });
                });
            },
        });
        this.socket.on("connect", () => {
            this.attempt = 0;
            this.status({ state: "connected" });
        });
        this.socket.on("connect_error", (err) => {
            // Without `data` this is a transport error, which the Manager already retries.
            if (err.data)
                void this.onRejected(err.data);
        });
        this.socket.on("disconnect", (reason) => {
            // The server closed us deliberately (e.g. membership revoked) — Socket.IO won't retry this one;
            // re-handshake so the server can tell us, with a typed rejection, whether we're still allowed in.
            if (reason === "io server disconnect")
                this.scheduleReconnect();
            else if (!this.stopped)
                this.status({ state: "connecting" });
        });
        this.socket.on(contracts_1.REALTIME_EVENTS.workspaceChanged, (e) => {
            if (e?.organizationId === opts.organizationId)
                opts.onWorkspaceChanged?.(e);
        });
        this.socket.on(contracts_1.REALTIME_EVENTS.presenceSync, (p) => opts.onPresenceSync?.(p));
        this.socket.on(contracts_1.REALTIME_EVENTS.presenceUpdate, (p) => opts.onPresenceUpdate?.(p));
        this.connect();
    }
    get connected() {
        return this.socket.connected;
    }
    emit(event, ...args) {
        if (this.socket.connected)
            this.socket.emit(event, ...args);
    }
    /** Disconnect while the app is backgrounded; {@link resume} reconnects. */
    suspend() {
        if (this.stopped)
            return;
        this.suspended = true;
        this.clearRetry();
        this.socket.disconnect();
    }
    resume() {
        if (this.stopped || !this.suspended)
            return;
        this.suspended = false;
        this.attempt = 0;
        this.connect();
    }
    /** Permanent shutdown. */
    close() {
        this.stop();
    }
    connect() {
        if (this.stopped || this.suspended)
            return;
        this.status({ state: "connecting" });
        this.socket.connect();
    }
    async onRejected(rejection) {
        if (this.stopped)
            return;
        if (!rejection.retryable) {
            this.stop(rejection);
            return;
        }
        if (contracts_1.TOKEN_REFRESHABLE_CODES.includes(rejection.code) && this.lastToken) {
            try {
                await this.opts.tokens.refreshAfterRejection(this.lastToken);
            }
            catch {
                this.stop(rejection);
                return;
            }
        }
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.stopped || this.suspended)
            return;
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
    stop(rejection) {
        if (this.stopped)
            return;
        this.stopped = true;
        this.clearRetry();
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.status({ state: "stopped", rejection });
    }
    clearRetry() {
        if (this.retryTimer)
            clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }
    status(s) {
        this.opts.onStatus?.(s);
    }
}
exports.RealtimeClient = RealtimeClient;
