import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    url.pathname = `/app/w/${id}/dashboard`;
    return NextResponse.redirect(url);
  }

  if (sub === "tasks") {
    url.pathname = `/app/w/${id}/work`;
    return NextResponse.redirect(url);
  }

  const taskDeep = sub.match(/^tasks\/(.+)$/);
  if (taskDeep) {
    url.pathname = `/app/w/${id}/work`;
    url.searchParams.set("task", taskDeep[1]);
    return NextResponse.redirect(url);
  }

  if (sub === "structure" || sub.startsWith("structure/")) {
    url.pathname = `/app/w/${id}/work`;
    return NextResponse.redirect(url);
  }

  url.pathname = `/app/w/${id}/dashboard`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/orgs", "/app/orgs/:path*"],
};
