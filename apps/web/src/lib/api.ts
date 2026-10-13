import type { RequestOptions } from "@work-ledger/client-core";
import { apiClient } from "@/lib/session";

export { ApiError, NetworkError, SessionLostError, isTerminalError } from "@work-ledger/client-core";
export { NETWORK_STATUS_EVENT, getApiBaseUrl } from "@/lib/session";

/**
 * `token` is accepted for call-site compatibility only and ignored: credentials are owned by the
 * session's token manager (see `lib/session.ts`), so a request can never carry a stale token.
 */
type LegacyInit = Omit<RequestInit, "body" | "method" | "headers"> & {
  token?: string | null;
  method?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
};

function toOptions(init: LegacyInit = {}): RequestOptions {
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    headers[key] = value;
  });
  // Call sites pass pre-serialized JSON strings; label them like the old helper did.
  if (typeof init.body === "string" && !("content-type" in headers)) headers["content-type"] = "application/json";
  return {
    method: (init.method?.toUpperCase() ?? "GET") as RequestOptions["method"],
    body: init.body ?? undefined,
    headers,
    signal: init.signal ?? undefined,
    // Matches the old helper: a caller-supplied signal (e.g. a long upload timeout) replaces the default.
    timeoutMs: init.signal ? 10 * 60_000 : undefined,
  };
}

/** Authenticated request returning the Response as-is (callers inspect `res.ok`). */
export function apiFetch(path: string, init: LegacyInit = {}): Promise<Response> {
  return apiClient.raw(path, toOptions(init), { throwOnError: false });
}

export function apiJson<T>(path: string, init: LegacyInit = {}): Promise<T> {
  return apiClient.json<T>(path, toOptions(init));
}

/**
 * Conditional GET for ETag-revalidated endpoints. A `304` means the caller's cached data is still
 * current — `data` comes back `null` and the caller should keep what it already has.
 */
export function apiJsonConditional<T>(
  path: string,
  init: LegacyInit & { etag?: string | null } = {},
): Promise<{ data: T | null; etag: string | null; notModified: boolean }> {
  const { etag, ...rest } = init;
  return apiClient.conditional<T>(path, etag, toOptions(rest));
}

/** For DELETE / no-response-body endpoints. */
export async function apiVoid(path: string, init: LegacyInit = {}): Promise<void> {
  await apiClient.json<unknown>(path, toOptions(init));
}
