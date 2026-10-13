import {
  type ApiErrorBody,
  TOKEN_REFRESHABLE_CODES,
  apiErrorCodeForStatus,
  isApiErrorCode,
} from "@work-ledger/contracts";
import { ApiError, NetworkError, SessionLostError } from "./errors.js";
import type { TokenManager } from "./token-manager.js";

type Params = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: "GET" | "HEAD" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serialized unless it's FormData / Blob / string. */
  body?: unknown;
  params?: Params;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Skip the bearer token (public endpoints). */
  anonymous?: boolean;
};

export type ConditionalResult<T> = { data: T | null; etag: string | null; notModified: boolean };

export type ApiClientOptions = {
  baseUrl: string | (() => string);
  tokens: TokenManager;
  fetch?: typeof fetch;
  defaultTimeoutMs?: number;
  /** Reachability signal after every attempt (drives "offline" banners). */
  onReachability?: (reachable: boolean) => void;
  /** Extra `fetch` init merged into every request (e.g. `{ cache: "no-store" }` in browsers). */
  fetchInit?: Omit<RequestInit, "method" | "headers" | "body" | "signal">;
};

/** Upper bound on how long the client will hold requests for a server-requested backoff. */
const MAX_BACKOFF_HOLD_MS = 60_000;

/** GET responses remembered for revalidation. Bounded LRU; cleared whenever the session changes. */
const REVALIDATION_CACHE_MAX = 150;

function withQuery(path: string, params?: Params): string {
  if (!params) return path;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  if (!qs) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

function isRawBody(body: unknown): boolean {
  return (
    typeof body === "string" ||
    (typeof FormData !== "undefined" && body instanceof FormData) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    body instanceof ArrayBuffer
  );
}

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  let message = res.statusText || "Request failed";
  try {
    const text = await res.text();
    if (text) {
      const parsed = JSON.parse(text) as Partial<ApiErrorBody> & { message?: string | string[] };
      const msg = Array.isArray(parsed.message) ? parsed.message.join(" ") : parsed.message;
      if (msg) message = msg;
      body = {
        ...parsed,
        statusCode: res.status,
        code: isApiErrorCode(parsed.code) ? parsed.code : apiErrorCodeForStatus(res.status),
        message,
      } as ApiErrorBody;
    }
  } catch {
    /* non-JSON body */
  }
  if (res.status === 429 && body && body.retryAfterSeconds === undefined) {
    const header = Number(res.headers.get("Retry-After"));
    if (Number.isFinite(header) && header > 0) body.retryAfterSeconds = header;
  }
  return new ApiError(res.status, body?.code ?? apiErrorCodeForStatus(res.status), message, body);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });

/**
 * HTTP transport shared by web and mobile.
 *
 * - Credentials come only from the {@link TokenManager}; callers never pass tokens.
 * - A 401 TOKEN_EXPIRED / TOKEN_INVALID retries *that request once* with a re-minted token. It never
 *   invalidates caches or triggers app-wide refetches.
 * - A 429 puts the whole client on hold until the server's Retry-After, so a runaway caller is
 *   throttled at the source instead of hammering the server.
 */
export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private holdUntil = 0;
  /** url → last 200 body + its ETag, for automatic conditional GETs. */
  private readonly revalidation = new Map<string, { etag: string; body: unknown }>();

  constructor(private readonly opts: ApiClientOptions) {
    this.fetchImpl = opts.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    // A different (or no) user must never be served another session's remembered bodies.
    opts.tokens.subscribe((state) => {
      if (state !== "ready") this.revalidation.clear();
    });
  }

  get tokens(): TokenManager {
    return this.opts.tokens;
  }

  url(path: string, params?: Params): string {
    const base = typeof this.opts.baseUrl === "function" ? this.opts.baseUrl() : this.opts.baseUrl;
    return `${base.replace(/\/$/, "")}${withQuery(path, params)}`;
  }

  /**
   * JSON request; resolves the parsed body (or `undefined` for empty responses).
   *
   * GETs are revalidated automatically: the last body for the URL is remembered with its ETag and
   * sent back as `If-None-Match`; a 304 (the server checks a version number, no database work)
   * resolves the remembered body. Unchanged data therefore costs a header round-trip, not a payload.
   */
  async json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const key = method === "GET" && !options.anonymous ? this.url(path, options.params) : null;
    const remembered = key ? this.revalidation.get(key) : undefined;
    const headers = remembered ? { ...options.headers, "If-None-Match": remembered.etag } : options.headers;

    const res = await this.send(path, { ...options, headers }, { allowNotModified: Boolean(remembered) });
    if (res.status === 304 && remembered && key) {
      this.revalidation.delete(key);
      this.revalidation.set(key, remembered);
      return remembered.body as T;
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const body = (text ? JSON.parse(text) : undefined) as T;
    const etag = res.headers.get("ETag");
    if (key) {
      this.revalidation.delete(key);
      if (etag && body !== undefined) {
        this.revalidation.set(key, { etag, body });
        if (this.revalidation.size > REVALIDATION_CACHE_MAX) {
          this.revalidation.delete(this.revalidation.keys().next().value as string);
        }
      }
    }
    return body;
  }

  /** Conditional GET: sends `If-None-Match`; a 304 resolves `{ notModified: true, data: null }`. */
  async conditional<T>(path: string, etag: string | null | undefined, options: RequestOptions = {}): Promise<ConditionalResult<T>> {
    const headers = { ...options.headers, ...(etag ? { "If-None-Match": etag } : {}) };
    const res = await this.send(path, { ...options, headers }, { allowNotModified: true });
    if (res.status === 304) return { data: null, etag: etag ?? null, notModified: true };
    const text = await res.text();
    return { data: (text ? JSON.parse(text) : null) as T, etag: res.headers.get("ETag"), notModified: false };
  }

  /**
   * Authenticated request returning the raw Response (downloads, streams, callers that inspect
   * status themselves). Token refresh, session loss and rate-limit holds still apply; other HTTP
   * errors are returned rather than thrown when `throwOnError` is false.
   */
  async raw(path: string, options: RequestOptions = {}, { throwOnError = true } = {}): Promise<Response> {
    return this.send(path, options, { returnErrors: !throwOnError });
  }

  private async send(
    path: string,
    options: RequestOptions,
    flags: { allowNotModified?: boolean; returnErrors?: boolean } = {},
  ): Promise<Response> {
    await this.waitForHold(options);

    let token = options.anonymous ? null : await this.opts.tokens.getToken();
    let res = await this.attempt(path, options, token);

    if (res.status === 401 && token) {
      const err = await parseError(res.clone());
      if (TOKEN_REFRESHABLE_CODES.includes(err.code)) {
        token = await this.opts.tokens.refreshAfterRejection(token);
        res = await this.attempt(path, options, token);
        if (res.status === 401) {
          // A token minted for this very retry was refused: the server will not accept this session.
          this.opts.tokens.declareLost("rejected");
          throw new SessionLostError("rejected");
        }
      }
    }

    if (res.status === 429) {
      const err = await parseError(res);
      this.holdUntil = Date.now() + Math.min(err.retryAfterMs ?? 5_000, MAX_BACKOFF_HOLD_MS);
      throw err;
    }
    if (res.ok || (flags.allowNotModified && res.status === 304) || flags.returnErrors) return res;
    throw await parseError(res);
  }

  private async waitForHold(options: RequestOptions): Promise<void> {
    const wait = this.holdUntil - Date.now();
    if (wait <= 0) return;
    const budget = options.timeoutMs ?? this.opts.defaultTimeoutMs ?? 30_000;
    if (wait > budget) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests — slowing down.", {
        statusCode: 429,
        code: "RATE_LIMITED",
        message: "Too many requests — slowing down.",
        retryAfterSeconds: Math.ceil(wait / 1000),
      });
    }
    await sleep(wait, options.signal);
  }

  private async attempt(path: string, options: RequestOptions, token: string | null): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.opts.defaultTimeoutMs ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (isRawBody(options.body)) {
        body = options.body as BodyInit;
      } else {
        body = JSON.stringify(options.body);
        headers["Content-Type"] ??= "application/json";
      }
    }

    try {
      const res = await this.fetchImpl(this.url(path, options.params), {
        ...this.opts.fetchInit,
        method: options.method ?? "GET",
        headers,
        body,
        signal: controller.signal,
      });
      this.opts.onReachability?.(true);
      return res;
    } catch (e) {
      if (options.signal?.aborted) throw e;
      this.opts.onReachability?.(false);
      throw new NetworkError(
        controller.signal.aborted
          ? "The server took too long to respond. Please try again."
          : "Can't reach the server. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}
