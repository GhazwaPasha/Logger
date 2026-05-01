function apiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:4000";
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${apiBase()}${path}`, {
    ...rest,
    headers,
    cache: rest.cache ?? "no-store",
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
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
