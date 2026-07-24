import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // RFC 8414 requires authorization-server metadata at the origin root, but Better Auth's `mcp`
  // plugin only serves it under /api/auth. Neither next.config.mjs `rewrites()` nor an `app/`
  // route file under a dot-prefixed directory are reachable for `.well-known/*` paths — Next.js's
  // static/dotfile handling intercepts them earlier in the pipeline, and even an in-pipeline
  // `NextResponse.rewrite()` from middleware still 404s for this specific path (confirmed: the
  // rewrite header is set correctly but the catch-all route never receives it). A real redirect —
  // a fresh request the client re-issues — is what actually works; OAuth discovery clients follow
  // redirects as a matter of course.
  if (pathname === "/.well-known/oauth-authorization-server") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/auth/.well-known/oauth-authorization-server";
    return NextResponse.redirect(url, 307);
  }

  if (!pathname.startsWith("/app/orgs")) return NextResponse.next();

  const url = request.nextUrl.clone();
  const m = pathname.match(/^\/app\/orgs(?:\/([^/]+))?(?:\/(.*))?$/);
  if (!m) return NextResponse.next();

  const id = m[1];
  const sub = m[2];

  if (!id) {
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  if (!sub) {
    url.pathname = `/${id}/dashboard`;
    return NextResponse.redirect(url);
  }

  if (sub === "tasks") {
    url.pathname = `/${id}/work`;
    return NextResponse.redirect(url);
  }

  const taskDeep = sub.match(/^tasks\/(.+)$/);
  if (taskDeep) {
    url.pathname = `/${id}/work`;
    url.searchParams.set("task", taskDeep[1]);
    return NextResponse.redirect(url);
  }

  if (sub === "structure" || sub.startsWith("structure/")) {
    url.pathname = `/${id}/work`;
    return NextResponse.redirect(url);
  }

  url.pathname = `/${id}/dashboard`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/orgs", "/app/orgs/:path*", "/.well-known/oauth-authorization-server"],
};
