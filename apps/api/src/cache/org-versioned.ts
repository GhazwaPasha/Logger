import { createHash } from "node:crypto";
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { type Observable, of, tap } from "rxjs";
import { CollaborationService } from "../realtime/collaboration.service";
import { MemoryCacheService } from "./memory-cache.service";
import { NotModifiedException } from "./not-modified.exception";

export type OrgVersionedOptions = {
  /**
   * Cache namespace; must match a prefix that `CollaborationService.notifyOrgChanged` invalidates.
   * Keys are `${namespace}:${orgId}[:${userId}]:${url}`.
   */
  namespace: string;
  /** Same response for every member (no role scoping) — one cache entry per org instead of per user. */
  shared?: boolean;
  /** Upper bound on how long an entry may be served from memory. Default 5 min. */
  ttlSeconds?: number;
};

const ORG_VERSIONED = "orgVersioned";

/**
 * Marks a GET handler under `organizations/:organizationId` as a pure function of the org's data.
 * Its ETag is derived from the org's data version (see `CollaborationService.dataVersion`), so:
 * - revalidating unchanged data is a version comparison — a 304 with no database work at all;
 * - responses are memoized server-side per (org, requester, URL) until the next write.
 * Only use it where every change to the response's inputs goes through `notifyOrgChanged`.
 */
export const OrgVersioned = (options: OrgVersionedOptions) => SetMetadata(ORG_VERSIONED, options);

/**
 * Time-derived fields (e.g. "overdue") and data owned outside the org (user names/avatars) change
 * without an org write; folding a coarse time bucket into the tag bounds that staleness.
 */
const TIME_BUCKET_MS = 5 * 60_000;

type Entry = { etag: string; body: unknown };

@Injectable()
export class OrgVersionedInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly collaboration: CollaborationService,
    private readonly cache: MemoryCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<OrgVersionedOptions | undefined>(ORG_VERSIONED, context.getHandler());
    if (!options || context.getType() !== "http") return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const res = context.switchToHttp().getResponse<Response>();
    const orgId = req.params.organizationId;
    const userId = req.user?.id;
    if (typeof orgId !== "string" || !userId) return next.handle();

    const scope = options.shared ? orgId : `${orgId}:${userId}`;
    const version = this.collaboration.dataVersion(orgId);
    const bucket = Math.floor(Date.now() / TIME_BUCKET_MS);
    const digest = createHash("sha1").update(`${scope}|${req.originalUrl}`).digest("base64url").slice(0, 16);
    const etag = `W/"${version.toString(36)}.${bucket.toString(36)}.${digest}"`;

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    if (req.headers["if-none-match"] === etag) throw new NotModifiedException();

    const key = `${options.namespace}:${scope}:${req.originalUrl}`;
    const hit = this.cache.get(key)?.data as Entry | undefined;
    if (hit && hit.etag === etag) return of(hit.body);

    return next.handle().pipe(
      tap((body) => {
        this.cache.set(key, { etag, body } satisfies Entry, options.ttlSeconds ?? 300);
      }),
    );
  }
}
