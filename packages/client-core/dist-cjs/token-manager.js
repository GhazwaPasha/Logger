"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
exports.jwtExpiryMs = jwtExpiryMs;
const errors_js_1 = require("./errors.js");
/** Decodes a JWT's `exp` (ms since epoch); 0 when unreadable, which forces a re-mint on next use. */
function jwtExpiryMs(token) {
    try {
        const payload = token.split(".")[1] ?? "";
        const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const json = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
        return typeof json.exp === "number" ? json.exp * 1000 : 0;
    }
    catch {
        return 0;
    }
}
/**
 * The single owner of the API credential for one signed-in user.
 *
 * - **Single-flight:** concurrent callers share one mint.
 * - **Proactive:** tokens are renewed shortly before `exp`; expiry is not the normal refresh trigger.
 * - **Rejection-aware:** after a 401, {@link refreshAfterRejection} re-mints only if nobody already
 *   replaced the rejected token, so N failing requests cause one mint, not N.
 * - **Circuit breaker:** too many rejection-driven re-mints → the session is declared lost, every
 *   caller gets {@link SessionLostError} without touching the network, and the app is told once.
 *   Only {@link reset} (a new sign-in) re-arms it.
 */
class TokenManager {
    opts;
    current = null;
    inflight = null;
    rejectionRefreshes = [];
    lost = null;
    generation = 0;
    listeners = new Set();
    constructor(options) {
        this.opts = {
            renewBeforeExpiryMs: 60_000,
            maxRejectionRefreshes: 3,
            rejectionWindowMs: 60_000,
            now: () => Date.now(),
            ...options,
        };
    }
    get state() {
        if (this.lost)
            return "lost";
        return this.current ? "ready" : "idle";
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /** A token valid for at least `renewBeforeExpiryMs`. */
    async getToken() {
        if (this.lost)
            throw new errors_js_1.SessionLostError(this.lost);
        const c = this.current;
        if (c && c.expiresAt - this.opts.now() > this.opts.renewBeforeExpiryMs)
            return c.token;
        return this.mintOnce();
    }
    /**
     * The server rejected `rejected` as expired/invalid. Returns a different token to retry with, or
     * throws {@link SessionLostError} once the breaker trips.
     */
    async refreshAfterRejection(rejected) {
        if (this.lost)
            throw new errors_js_1.SessionLostError(this.lost);
        if (this.current && this.current.token !== rejected)
            return this.current.token;
        if (this.inflight)
            return this.inflight;
        const now = this.opts.now();
        this.rejectionRefreshes = this.rejectionRefreshes.filter((t) => now - t < this.opts.rejectionWindowMs);
        if (this.rejectionRefreshes.length >= this.opts.maxRejectionRefreshes) {
            this.declareLost("rejected");
            throw new errors_js_1.SessionLostError("rejected");
        }
        this.rejectionRefreshes.push(now);
        this.current = null;
        return this.mintOnce();
    }
    /** The server rejected a token minted moments ago — no point minting another. */
    declareLost(reason) {
        if (this.lost)
            return;
        this.lost = reason;
        this.current = null;
        this.emit();
        this.opts.onSessionLost?.(reason);
    }
    /** Forget everything (sign-in, sign-out, user switch) and re-arm the breaker. */
    reset() {
        this.generation++;
        this.current = null;
        this.inflight = null;
        this.rejectionRefreshes = [];
        this.lost = null;
        this.emit();
    }
    mintOnce() {
        if (this.inflight)
            return this.inflight;
        const generation = this.generation;
        const p = (async () => {
            try {
                const token = await this.opts.mint();
                if (generation !== this.generation)
                    throw new errors_js_1.SessionLostError("signed_out");
                if (!token) {
                    this.declareLost("signed_out");
                    throw new errors_js_1.SessionLostError("signed_out");
                }
                const wasIdle = this.current === null;
                this.current = { token, expiresAt: jwtExpiryMs(token) };
                if (wasIdle)
                    this.emit();
                return token;
            }
            finally {
                this.inflight = null;
            }
        })();
        this.inflight = p;
        return p;
    }
    emit() {
        const state = this.state;
        for (const l of this.listeners)
            l(state);
    }
}
exports.TokenManager = TokenManager;
