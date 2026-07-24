const FALLBACK = "/app";

const WORKSPACE_ID_SEGMENT =
  /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i;

const RESERVED_WORKSPACE_SEGMENTS = new Set(["app", "login", "audit", "api", "_next", "workspaces"]);

/** `/app/w/<uuid>/…` → `/<uuid>/…` for bookmarks and old `next=` params. */
function normalizeLegacyWorkspacePath(pathPart: string): string {
  const m = pathPart.match(
    /^\/app\/w\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/.*)?$/i,
  );
  if (!m) return pathPart;
  return `/${m[1]}${m[2] ?? ""}`;
}

function workspaceFirstSegment(pathPart: string): string | undefined {
  const seg = pathPart.split("/").filter(Boolean)[0];
  return seg;
}

function isWorkspaceScopedPath(pathPart: string): boolean {
  const seg = workspaceFirstSegment(pathPart);
  if (!seg || RESERVED_WORKSPACE_SEGMENTS.has(seg)) return false;
  if (WORKSPACE_ID_SEGMENT.test(pathPart)) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(seg);
}

/** Prevent open redirects: `/app` hub or workspace URLs (`/<slug|uuid>/…`). */
export function safeReturnPath(raw: string | null | undefined, fallback = FALLBACK): string {
  const v0 = (raw ?? fallback).trim();
  if (!v0.startsWith("/") || v0.startsWith("//") || v0.includes("\\") || v0.includes("://")) {
    return fallback;
  }

  const qIdx = v0.indexOf("?");
  const pathPart = qIdx >= 0 ? v0.slice(0, qIdx) : v0;
  const queryPart = qIdx >= 0 ? v0.slice(qIdx) : "";
  const path = normalizeLegacyWorkspacePath(pathPart) + queryPart;

  const pathOnly = qIdx >= 0 ? path.slice(0, path.indexOf("?")) : path;

  if (pathOnly.startsWith("/app/orgs")) return fallback;
  if (pathOnly === "/app" || pathOnly === "/app/") return "/app";
  if (pathOnly.startsWith("/app/workspaces")) return "/app";
  // OAuth consent screen — needs its query string (consent_code/client_id/scope) preserved through login.
  if (pathOnly === "/oauth/consent") return path;
  if (isWorkspaceScopedPath(pathOnly)) return path;

  return fallback;
}
