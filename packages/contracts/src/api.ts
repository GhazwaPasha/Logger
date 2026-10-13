/**
 * Wire contract between the API and its clients for failures and realtime. Clients branch on `code`,
 * never on status text or message wording, so the server can reword messages freely.
 */
export const API_ERROR_CODES = [
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
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Every non-2xx JSON body the API returns. */
export type ApiErrorBody = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  /** Present on RATE_LIMITED. */
  retryAfterSeconds?: number;
  /** Field-level details on VALIDATION_FAILED. */
  issues?: { path: string; message: string }[];
};

/** Codes that mean "your credential is stale": the client may mint one new token and retry once. */
export const TOKEN_REFRESHABLE_CODES: readonly ApiErrorCode[] = ["TOKEN_EXPIRED", "TOKEN_INVALID"];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value);
}

/** Fallback when a body has no `code` (proxies, older servers). */
export function apiErrorCodeForStatus(status: number): ApiErrorCode {
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

// ---------------------------------------------------------------------------------------------
// Realtime (Socket.IO) contract
// ---------------------------------------------------------------------------------------------

/** Handshake payload. `token` is re-read on every (re)connect, so it is never stale. */
export type RealtimeAuth = { token: string; organizationId: string };

/** `connect_error.data` when the server refuses a handshake. */
export type RealtimeRejection = {
  code: ApiErrorCode;
  /** False when reconnecting with the same identity can never succeed (e.g. NOT_A_MEMBER). */
  retryable: boolean;
};

/** What part of the workspace an event touched, so clients refresh only that. */
export type WorkspaceChangeScope = "task" | "workspace";

/** Emitted on every committed write in an organization. */
export type WorkspaceChangedEvent = {
  organizationId: string;
  /** Monotonic per-organization data version after this write. */
  version: number;
  scope: WorkspaceChangeScope;
  taskId: string | null;
};

export const REALTIME_EVENTS = {
  workspaceChanged: "workspace_changed",
  presenceSync: "presence_sync",
  presenceUpdate: "presence_update",
  presenceAway: "presence_away",
  presenceActive: "presence_active",
} as const;
