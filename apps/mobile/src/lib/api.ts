import {
  ApiClient,
  ApiError,
  NetworkError,
  SessionLostError,
  TokenManager,
  type SessionLostReason,
} from '@work-ledger/client-core';
import { TOKEN_REFRESHABLE_CODES, apiErrorCodeForStatus, isApiErrorCode } from '@work-ledger/contracts';

import { Platform } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { API_URL } from '@/lib/config';

export { ApiError, NetworkError, SessionLostError, isTerminalError } from '@work-ledger/client-core';

type SessionLostListener = (reason: SessionLostReason) => void;
const sessionLostListeners = new Set<SessionLostListener>();

/** "The API will no longer accept this session" — the root layout signs the device out. */
export function onSessionLost(listener: SessionLostListener): () => void {
  sessionLostListeners.add(listener);
  return () => sessionLostListeners.delete(listener);
}

/**
 * The device's one credential owner (session cookie lives in SecureStore via expoClient; the API is
 * called with short-lived JWTs minted from it). Shared engine: see `@work-ledger/client-core`.
 */
export const tokenManager = new TokenManager({
  mint: async () => {
    // Better Auth types this call as a union that includes the raw (throwing) response; we use the {data, error} form.
    const { data, error } = (await authClient.token()) as unknown as {
      data?: { token?: string } | null;
      error?: { status?: number; message?: string } | null;
    };
    if (error) {
      if (error.status === 401) return null;
      throw new NetworkError(error.message ?? "Can't reach the server. Check your connection.");
    }
    return data?.token ?? null;
  },
  onSessionLost: (reason) => {
    reportClientEvent('session_lost', reason);
    for (const l of sessionLostListeners) l(reason);
  },
});

/** Best-effort beacon so the API's alerting sees devices that deliberately went quiet. */
function reportClientEvent(type: 'session_lost' | 'realtime_stopped', reason: string) {
  void fetch(`${API_URL}/telemetry/client-events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, reason, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
  }).catch(() => undefined);
}

export const apiClient = new ApiClient({ baseUrl: API_URL, tokens: tokenManager });

/** Forget the cached token and re-arm the session (sign-in, sign-out). */
export function clearTokenCache() {
  tokenManager.reset();
}

type Params = Record<string, string | number | boolean | null | undefined>;

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Params;
  signal?: AbortSignal;
  /** Overrides the default 30s timeout — file uploads (Discord submission) need more room. */
  timeoutMs?: number;
};

/** JSON request to the LogBase API. Auth, one-shot token refresh, backoff and session loss are handled by the engine. */
export function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  return apiClient.json<T>(path, opts);
}

function parseXhrError(status: number, text: string): ApiError {
  let code = apiErrorCodeForStatus(status);
  let message = 'Upload failed';
  try {
    const parsed = JSON.parse(text) as { code?: unknown; message?: string | string[] };
    if (isApiErrorCode(parsed.code)) code = parsed.code;
    const msg = Array.isArray(parsed.message) ? parsed.message.join(' ') : parsed.message;
    if (msg) message = msg;
  } catch {
    // not JSON
  }
  return new ApiError(status, code, message);
}

/**
 * Multipart POST that reports real upload progress (0 → 1 as the bytes leave the device). React Native's
 * `fetch` has no upload progress, so this goes through XMLHttpRequest, with the same token rules as {@link api}.
 */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
  onProgress: (fraction: number) => void,
  timeoutMs = 120_000,
): Promise<T> {
  const attempt = (token: string) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', apiClient.url(path));
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.timeout = timeoutMs;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(Math.min(1, e.loaded / e.total));
      };
      xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? '' });
      xhr.onerror = () => reject(new NetworkError("Can't reach the server. Check your connection."));
      xhr.ontimeout = () => reject(new NetworkError('The server took too long to respond. Please try again.'));
      xhr.send(form);
    });

  let token = await tokenManager.getToken();
  let res = await attempt(token);
  if (res.status === 401 && TOKEN_REFRESHABLE_CODES.includes(parseXhrError(401, res.text).code)) {
    onProgress(0);
    token = await tokenManager.refreshAfterRejection(token);
    res = await attempt(token);
    if (res.status === 401) {
      tokenManager.declareLost('rejected');
      throw new SessionLostError('rejected');
    }
  }
  if (res.status < 200 || res.status >= 300) throw parseXhrError(res.status, res.text);
  return (res.text ? JSON.parse(res.text) : undefined) as T;
}
