"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
const contracts_1 = require("@work-ledger/contracts");
const errors_js_1 = require("./errors.js");
/** Upper bound on how long the client will hold requests for a server-requested backoff. */
const MAX_BACKOFF_HOLD_MS = 60_000;
/** GET responses remembered for revalidation. Bounded LRU; cleared whenever the session changes. */
const REVALIDATION_CACHE_MAX = 150;
function withQuery(path, params) {
    if (!params)
        return path;
    const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
    if (!qs)
        return path;
    return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}
function isRawBody(body) {
    return (typeof body === "string" ||
        (typeof FormData !== "undefined" && body instanceof FormData) ||
        (typeof Blob !== "undefined" && body instanceof Blob) ||
        body instanceof ArrayBuffer);
}
async function parseError(res) {
    let body = null;
    let message = res.statusText || "Request failed";
    try {
        const text = await res.text();
        if (text) {
            const parsed = JSON.parse(text);
            const msg = Array.isArray(parsed.message) ? parsed.message.join(" ") : parsed.message;
            if (msg)
                message = msg;
            body = {
                ...parsed,
                statusCode: res.status,
                code: (0, contracts_1.isApiErrorCode)(parsed.code) ? parsed.code : (0, contracts_1.apiErrorCodeForStatus)(res.status),
                message,
            };
        }
    }
    catch {
        /* non-JSON body */
    }
    if (res.status === 429 && body && body.retryAfterSeconds === undefined) {
        const header = Number(res.headers.get("Retry-After"));
        if (Number.isFinite(header) && header > 0)
            body.retryAfterSeconds = header;
    }
    return new errors_js_1.ApiError(res.status, body?.code ?? (0, contracts_1.apiErrorCodeForStatus)(res.status), message, body);
}
const sleep = (ms, signal) => new Promise((resolve, reject) => {
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
class ApiClient {
    opts;
    fetchImpl;
    holdUntil = 0;
    /** url → last 200 body + its ETag, for automatic conditional GETs. */
    revalidation = new Map();
    constructor(opts) {
        this.opts = opts;
        this.fetchImpl = opts.fetch ?? ((...args) => fetch(...args));
        // A different (or no) user must never be served another session's remembered bodies.
        opts.tokens.subscribe((state) => {
            if (state !== "ready")
                this.revalidation.clear();
        });
    }
    get tokens() {
        return this.opts.tokens;
    }
    url(path, params) {
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
    async json(path, options = {}) {
        const method = options.method ?? "GET";
        const key = method === "GET" && !options.anonymous ? this.url(path, options.params) : null;
        const remembered = key ? this.revalidation.get(key) : undefined;
        const headers = remembered ? { ...options.headers, "If-None-Match": remembered.etag } : options.headers;
        const res = await this.send(path, { ...options, headers }, { allowNotModified: Boolean(remembered) });
        if (res.status === 304 && remembered && key) {
            this.revalidation.delete(key);
            this.revalidation.set(key, remembered);
            return remembered.body;
        }
        if (res.status === 204)
            return undefined;
        const text = await res.text();
        const body = (text ? JSON.parse(text) : undefined);
        const etag = res.headers.get("ETag");
        if (key) {
            this.revalidation.delete(key);
            if (etag && body !== undefined) {
                this.revalidation.set(key, { etag, body });
                if (this.revalidation.size > REVALIDATION_CACHE_MAX) {
                    this.revalidation.delete(this.revalidation.keys().next().value);
                }
            }
        }
        return body;
    }
    /** Conditional GET: sends `If-None-Match`; a 304 resolves `{ notModified: true, data: null }`. */
    async conditional(path, etag, options = {}) {
        const headers = { ...options.headers, ...(etag ? { "If-None-Match": etag } : {}) };
        const res = await this.send(path, { ...options, headers }, { allowNotModified: true });
        if (res.status === 304)
            return { data: null, etag: etag ?? null, notModified: true };
        const text = await res.text();
        return { data: (text ? JSON.parse(text) : null), etag: res.headers.get("ETag"), notModified: false };
    }
    /**
     * Authenticated request returning the raw Response (downloads, streams, callers that inspect
     * status themselves). Token refresh, session loss and rate-limit holds still apply; other HTTP
     * errors are returned rather than thrown when `throwOnError` is false.
     */
    async raw(path, options = {}, { throwOnError = true } = {}) {
        return this.send(path, options, { returnErrors: !throwOnError });
    }
    async send(path, options, flags = {}) {
        await this.waitForHold(options);
        let token = options.anonymous ? null : await this.opts.tokens.getToken();
        let res = await this.attempt(path, options, token);
        if (res.status === 401 && token) {
            const err = await parseError(res.clone());
            if (contracts_1.TOKEN_REFRESHABLE_CODES.includes(err.code)) {
                token = await this.opts.tokens.refreshAfterRejection(token);
                res = await this.attempt(path, options, token);
                if (res.status === 401) {
                    // A token minted for this very retry was refused: the server will not accept this session.
                    this.opts.tokens.declareLost("rejected");
                    throw new errors_js_1.SessionLostError("rejected");
                }
            }
        }
        if (res.status === 429) {
            const err = await parseError(res);
            this.holdUntil = Date.now() + Math.min(err.retryAfterMs ?? 5_000, MAX_BACKOFF_HOLD_MS);
            throw err;
        }
        if (res.ok || (flags.allowNotModified && res.status === 304) || flags.returnErrors)
            return res;
        throw await parseError(res);
    }
    async waitForHold(options) {
        const wait = this.holdUntil - Date.now();
        if (wait <= 0)
            return;
        const budget = options.timeoutMs ?? this.opts.defaultTimeoutMs ?? 30_000;
        if (wait > budget) {
            throw new errors_js_1.ApiError(429, "RATE_LIMITED", "Too many requests — slowing down.", {
                statusCode: 429,
                code: "RATE_LIMITED",
                message: "Too many requests — slowing down.",
                retryAfterSeconds: Math.ceil(wait / 1000),
            });
        }
        await sleep(wait, options.signal);
    }
    async attempt(path, options, token) {
        const timeoutMs = options.timeoutMs ?? this.opts.defaultTimeoutMs ?? 30_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onAbort = () => controller.abort();
        options.signal?.addEventListener("abort", onAbort);
        const headers = { Accept: "application/json", ...options.headers };
        if (token)
            headers.Authorization = `Bearer ${token}`;
        let body;
        if (options.body !== undefined) {
            if (isRawBody(options.body)) {
                body = options.body;
            }
            else {
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
        }
        catch (e) {
            if (options.signal?.aborted)
                throw e;
            this.opts.onReachability?.(false);
            throw new errors_js_1.NetworkError(controller.signal.aborted
                ? "The server took too long to respond. Please try again."
                : "Can't reach the server. Check your connection and try again.");
        }
        finally {
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", onAbort);
        }
    }
}
exports.ApiClient = ApiClient;
