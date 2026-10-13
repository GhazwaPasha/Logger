"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REALTIME_EVENTS = exports.TOKEN_REFRESHABLE_CODES = exports.API_ERROR_CODES = void 0;
exports.isApiErrorCode = isApiErrorCode;
exports.apiErrorCodeForStatus = apiErrorCodeForStatus;
/**
 * Wire contract between the API and its clients for failures and realtime. Clients branch on `code`,
 * never on status text or message wording, so the server can reword messages freely.
 */
exports.API_ERROR_CODES = [
    /** No bearer credential was sent. */
    "TOKEN_MISSING",
    /** The JWT was valid but has expired — mint a new one and retry. */
    "TOKEN_EXPIRED",
    /** The JWT failed verification (bad signature, retired key, wrong issuer/audience) — mint a new one once. */
    "TOKEN_INVALID",
    /** Authenticated, but not a member of the organization in the URL. Retrying cannot help. */
    "NOT_A_MEMBER",
    /** Authenticated member without the role this action needs. */
    "FORBIDDEN",
    "NOT_FOUND",
    "VALIDATION_FAILED",
    "CONFLICT",
    /** Too many requests — wait `retryAfterSeconds` before trying again. */
    "RATE_LIMITED",
    "SERVER_ERROR",
];
/** Codes that mean "your credential is stale": the client may mint one new token and retry once. */
exports.TOKEN_REFRESHABLE_CODES = ["TOKEN_EXPIRED", "TOKEN_INVALID"];
function isApiErrorCode(value) {
    return typeof value === "string" && exports.API_ERROR_CODES.includes(value);
}
/** Fallback when a body has no `code` (proxies, older servers). */
function apiErrorCodeForStatus(status) {
    switch (status) {
        case 400:
        case 422:
            return "VALIDATION_FAILED";
        case 401:
            return "TOKEN_INVALID";
        case 403:
            return "FORBIDDEN";
        case 404:
            return "NOT_FOUND";
        case 409:
            return "CONFLICT";
        case 429:
            return "RATE_LIMITED";
        default:
            return "SERVER_ERROR";
    }
}
exports.REALTIME_EVENTS = {
    workspaceChanged: "workspace_changed",
    presenceSync: "presence_sync",
    presenceUpdate: "presence_update",
    presenceAway: "presence_away",
    presenceActive: "presence_active",
};
