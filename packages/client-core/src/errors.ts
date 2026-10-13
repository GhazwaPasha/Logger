import type { ApiErrorBody, ApiErrorCode } from "@work-ledger/contracts";

/** The API answered with a non-2xx status. Branch on `code`, not on `message`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body: ApiErrorBody | null;

  constructor(status: number, code: ApiErrorCode, message: string, body: ApiErrorBody | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** Milliseconds the server asked us to wait (RATE_LIMITED), if any. */
  get retryAfterMs(): number | null {
    const s = this.body?.retryAfterSeconds;
    return typeof s === "number" && s > 0 ? s * 1000 : null;
  }
}

/** The request never got a response (offline, server down, DNS, timeout). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * The session can't produce a credential the server accepts — signed out, or the circuit breaker
 * tripped after repeated rejections. Nothing will be sent until the app signs in again.
 */
export class SessionLostError extends Error {
  readonly reason: SessionLostReason;

  constructor(reason: SessionLostReason) {
    super(reason === "signed_out" ? "You're signed out." : "Your session could not be verified. Please sign in again.");
    this.name = "SessionLostError";
    this.reason = reason;
  }
}

export type SessionLostReason =
  /** The auth server has no session for this device. */
  | "signed_out"
  /** Fresh tokens kept being rejected — retrying would only generate load. */
  | "rejected";

/** Errors that retrying the same request can never fix. React Query `retry` callbacks should use this. */
export function isTerminalError(error: unknown): boolean {
  if (error instanceof SessionLostError) return true;
  if (!(error instanceof ApiError)) return false;
  return (
    error.code === "NOT_A_MEMBER" ||
    error.code === "FORBIDDEN" ||
    error.code === "NOT_FOUND" ||
    error.code === "VALIDATION_FAILED" ||
    error.code === "CONFLICT" ||
    error.code === "TOKEN_MISSING" ||
    error.code === "TOKEN_EXPIRED" ||
    error.code === "TOKEN_INVALID"
  );
}
