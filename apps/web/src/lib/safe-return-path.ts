const FALLBACK = "/app";

/** Prevent open redirects: only same-origin paths under /app workspace routes. */
export function safeReturnPath(raw: string | null | undefined, fallback = FALLBACK): string {
  const v = (raw ?? fallback).trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.includes("://")) return fallback;
  if (!v.startsWith("/app")) return fallback;
  if (v.startsWith("/app/orgs")) return FALLBACK;
  if (v.startsWith("/app/workspaces")) return "/app";
  if (v === "/app" || v === "/app/") return "/app";
  if (v.startsWith("/app/w/")) return v;
  return fallback;
}
