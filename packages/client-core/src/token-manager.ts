import { SessionLostError, type SessionLostReason } from "./errors.js";

/** Mints a fresh API token from the auth server. Resolve `null` when there is no session. */
export type TokenMinter = () => Promise<string | null>;

export type TokenManagerOptions = {
  mint: TokenMinter;
  /** Called once each time the session is declared lost. */
  onSessionLost?: (reason: SessionLostReason) => void;
  /** Renew this long before `exp`, so requests never carry a token about to expire. Default 60s. */
  renewBeforeExpiryMs?: number;
  /**
   * Circuit breaker: at most this many *rejection-driven* re-mints per window. A healthy client needs
   * about one per token lifetime; exceeding this means the server keeps refusing fresh tokens, and
   * continuing would only hammer the auth server and API. Default 3 per 60s.
   */
  maxRejectionRefreshes?: number;
  rejectionWindowMs?: number;
  now?: () => number;
};

export type TokenState = "idle" | "ready" | "lost";

/** Decodes a JWT's `exp` (ms since epoch); 0 when unreadable, which forces a re-mint on next use. */
export function jwtExpiryMs(token: string): number {
  try {
    const payload = token.split(".")[1] ?? "";
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp * 1000 : 0;
  } catch {
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
export class TokenManager {
  private readonly opts: Required<Omit<TokenManagerOptions, "onSessionLost">> & Pick<TokenManagerOptions, "onSessionLost">;
  private current: { token: string; expiresAt: number } | null = null;
  private inflight: Promise<string> | null = null;
  private rejectionRefreshes: number[] = [];
  private lost: SessionLostReason | null = null;
  private generation = 0;
  private readonly listeners = new Set<(state: TokenState) => void>();

  constructor(options: TokenManagerOptions) {
    this.opts = {
      renewBeforeExpiryMs: 60_000,
      maxRejectionRefreshes: 3,
      rejectionWindowMs: 60_000,
      now: () => Date.now(),
      ...options,
    };
  }

  get state(): TokenState {
    if (this.lost) return "lost";
    return this.current ? "ready" : "idle";
  }

  subscribe(listener: (state: TokenState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** A token valid for at least `renewBeforeExpiryMs`. */
  async getToken(): Promise<string> {
    if (this.lost) throw new SessionLostError(this.lost);
    const c = this.current;
    if (c && c.expiresAt - this.opts.now() > this.opts.renewBeforeExpiryMs) return c.token;
    return this.mintOnce();
  }

  /**
   * The server rejected `rejected` as expired/invalid. Returns a different token to retry with, or
   * throws {@link SessionLostError} once the breaker trips.
   */
  async refreshAfterRejection(rejected: string): Promise<string> {
    if (this.lost) throw new SessionLostError(this.lost);
    if (this.current && this.current.token !== rejected) return this.current.token;
    if (this.inflight) return this.inflight;

    const now = this.opts.now();
    this.rejectionRefreshes = this.rejectionRefreshes.filter((t) => now - t < this.opts.rejectionWindowMs);
    if (this.rejectionRefreshes.length >= this.opts.maxRejectionRefreshes) {
      this.declareLost("rejected");
      throw new SessionLostError("rejected");
    }
    this.rejectionRefreshes.push(now);
    this.current = null;
    return this.mintOnce();
  }

  /** The server rejected a token minted moments ago — no point minting another. */
  declareLost(reason: SessionLostReason): void {
    if (this.lost) return;
    this.lost = reason;
    this.current = null;
    this.emit();
    this.opts.onSessionLost?.(reason);
  }

  /** Forget everything (sign-in, sign-out, user switch) and re-arm the breaker. */
  reset(): void {
    this.generation++;
    this.current = null;
    this.inflight = null;
    this.rejectionRefreshes = [];
    this.lost = null;
    this.emit();
  }

  private mintOnce(): Promise<string> {
    if (this.inflight) return this.inflight;
    const generation = this.generation;
    const p: Promise<string> = (async () => {
      try {
        const token = await this.opts.mint();
        if (generation !== this.generation) throw new SessionLostError("signed_out");
        if (!token) {
          this.declareLost("signed_out");
          throw new SessionLostError("signed_out");
        }
        const wasIdle = this.current === null;
        this.current = { token, expiresAt: jwtExpiryMs(token) };
        if (wasIdle) this.emit();
        return token;
      } finally {
        this.inflight = null;
      }
    })();
    this.inflight = p;
    return p;
  }

  private emit(): void {
    const state = this.state;
    for (const l of this.listeners) l(state);
  }
}
