import type { Org } from "@/lib/ledger-types";

const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable first URL segment: slug when present, else org id (migration / stale cache safe). */
export function workspaceUrlSegment(org: Pick<Org, "id"> & { slug?: string | null }): string {
  const s = org.slug?.trim();
  return s || org.id;
}

export function resolveOrgFromUrlSegment(orgs: Org[], segment: string): Org | undefined {
  if (!segment || segment === "undefined" || segment === "null") return undefined;
  if (ORG_ID_RE.test(segment)) {
    return orgs.find((o) => o.id === segment);
  }
  return orgs.find((o) => o.slug === segment);
}

/** Path after the first URL segment: `/[seg]/a/b` → `/a/b`; `/[seg]` only → `/dashboard`. */
export function pathAfterWorkspace(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/dashboard";
  return `/${parts.slice(1).join("/")}`;
}
