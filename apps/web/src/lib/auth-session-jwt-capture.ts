/**
 * Better Auth JWT plugin can expose the token on `get-session` via the `set-auth-jwt` header.
 * Intercepting fetch lets us reuse that JWT and skip an extra `/api/auth/token` round trip when present.
 */
let jwtFromLastGetSession: string | null = null;

function installFetchInterceptor() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __wlAuthFetchPatched?: boolean };
  if (w.__wlAuthFetchPatched) return;
  w.__wlAuthFetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await orig(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (url.includes("/api/auth/get-session")) {
        const h = res.headers.get("set-auth-jwt");
        if (h) jwtFromLastGetSession = h;
      }
    } catch {
      /* ignore */
    }
    return res;
  };
}

installFetchInterceptor();

export function getJwtCapturedFromGetSession(): string | null {
  return jwtFromLastGetSession;
}

export function clearJwtCapture() {
  jwtFromLastGetSession = null;
}
