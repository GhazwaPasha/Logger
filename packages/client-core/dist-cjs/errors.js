"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionLostError = exports.NetworkError = exports.ApiError = void 0;
exports.isTerminalError = isTerminalError;
/** The API answered with a non-2xx status. Branch on `code`, not on `message`. */
class ApiError extends Error {
    status;
    code;
    body;
    constructor(status, code, message, body = null) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.body = body;
    }
    /** Milliseconds the server asked us to wait (RATE_LIMITED), if any. */
    get retryAfterMs() {
        const s = this.body?.retryAfterSeconds;
        return typeof s === "number" && s > 0 ? s * 1000 : null;
    }
}
exports.ApiError = ApiError;
/** The request never got a response (offline, server down, DNS, timeout). */
class NetworkError extends Error {
    constructor(message) {
        super(message);
        this.name = "NetworkError";
    }
}
exports.NetworkError = NetworkError;
/**
 * The session can't produce a credential the server accepts — signed out, or the circuit breaker
 * tripped after repeated rejections. Nothing will be sent until the app signs in again.
 */
class SessionLostError extends Error {
    reason;
    constructor(reason) {
        super(reason === "signed_out" ? "You're signed out." : "Your session could not be verified. Please sign in again.");
        this.name = "SessionLostError";
        this.reason = reason;
    }
}
exports.SessionLostError = SessionLostError;
/** Errors that retrying the same request can never fix. React Query `retry` callbacks should use this. */
function isTerminalError(error) {
    if (error instanceof SessionLostError)
        return true;
    if (!(error instanceof ApiError))
        return false;
    return (error.code === "NOT_A_MEMBER" ||
        error.code === "FORBIDDEN" ||
        error.code === "NOT_FOUND" ||
        error.code === "VALIDATION_FAILED" ||
        error.code === "CONFLICT" ||
        error.code === "TOKEN_MISSING" ||
        error.code === "TOKEN_EXPIRED" ||
        error.code === "TOKEN_INVALID");
}
