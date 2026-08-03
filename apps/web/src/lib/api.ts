export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:4000";
}

function apiBase(): string {
  return getApiBaseUrl();
}

/** Nest error bodies are `{ statusCode, message, error }`, with `message` sometimes an array
 *  (ValidationPipe). Unwrap that instead of surfacing the raw JSON blob to the user. */
function extractErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message) && parsed.message.length > 0) return parsed.message.join(" ");
    if (typeof parsed.message === "string" && parsed.message) return parsed.message;
  } catch {
    // Body wasn't JSON — fall through and use the raw text.
  }
  return text;
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && rest.body && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiBase()}${path}`, {
    ...rest,
    headers,
    cache: rest.cache ?? "no-store",
    signal: rest.signal ?? AbortSignal.timeout(30_000),
  });
}

export async function apiJson<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const res = await apiFetch(path, options);
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wl:auth-expired"));
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(extractErrorMessage(text, res.statusText));
  }
  return res.json() as Promise<T>;
}

/** For DELETE / no-response-body endpoints. */
export async function apiVoid(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<void> {
  const res = await apiFetch(path, options);
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("wl:auth-expired"));
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(extractErrorMessage(text, res.statusText));
  }
}
