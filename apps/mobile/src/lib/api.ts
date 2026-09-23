import { authClient } from '@/lib/auth-client';
import { API_URL } from '@/lib/config';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never got a response (offline, server down, timeout). */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_SKEW_MS = 30_000;

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

function jwtExpiryMs(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { exp?: number };
    return (json.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

export function clearTokenCache() {
  cached = null;
  inflight = null;
}

async function getToken(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - Date.now() > TOKEN_SKEW_MS) return cached.token;
  inflight ??= (async () => {
    try {
      // Better Auth types this call as a union that includes the raw (throwing) response; we use the {data, error} form.
      const { data, error } = (await authClient.token()) as unknown as {
        data?: { token?: string } | null;
        error?: unknown;
      };
      if (error || !data?.token) throw new ApiError(401, 'Not signed in');
      cached = { token: data.token, expiresAt: jwtExpiryMs(data.token) };
      return data.token;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** The API bearer token (cached / refreshed like `api()` does) — for the realtime socket's handshake. */
export function getApiToken(): Promise<string> {
  return getToken();
}

/** Nest error bodies are `{ statusCode, message, error }` where `message` may be an array (ValidationPipe). */
function errorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message) && parsed.message.length > 0) return parsed.message.join(' ');
    if (typeof parsed.message === 'string' && parsed.message) return parsed.message;
  } catch {
    // not JSON
  }
  return text;
}

type Params = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, params?: Params): string {
  if (!params) return path;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${path}?${qs}` : path;
}

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Params;
  signal?: AbortSignal;
  /** Overrides the default 30s timeout — file uploads (Discord submission) need more room. */
  timeoutMs?: number;
};

async function send(path: string, opts: ApiOptions, token: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort());
  // FormData (file uploads) must go through untouched — stringifying it would send "[object
  // FormData]", and setting Content-Type ourselves drops the multipart boundary fetch generates.
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  try {
    return await fetch(`${API_URL}${withQuery(path, opts.params)}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(opts.body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body === undefined ? undefined : isFormData ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new NetworkError(
      controller.signal.aborted
        ? 'The server took too long to respond. Please try again.'
        : "Can't reach the server. Check your connection.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** JSON request to the LogBase API with Bearer auth; refreshes the JWT once on 401. */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res = await send(path, opts, await getToken());
  if (res.status === 401) {
    res = await send(path, opts, await getToken(true));
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(await res.text(), res.statusText || 'Request failed'));
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
