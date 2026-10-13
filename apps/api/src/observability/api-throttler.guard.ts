import { type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import { ApiException } from "../common/api-error";
import { log } from "./logger";
import { UsageMonitorService } from "./usage-monitor.service";

/**
 * Per-user request limits (per-IP for unauthenticated routes). Runs after authentication so the
 * budget follows the person, not the network they're on. Refusals are typed RATE_LIMITED with
 * `retryAfterSeconds`; the shared client honors it by holding *all* its requests, so one runaway
 * screen can't keep hammering through the limit.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly monitor: UsageMonitorService,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ? `user:${user.id}` : `ip:${String(req.ip ?? "unknown")}`;
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<{ method: string; originalUrl: string }>();
    const retryAfterSeconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    log.warn({ msg: "rate_limited", tracker: detail.tracker, route: `${req.method} ${req.originalUrl}`, retryAfterSeconds });
    this.monitor.recordThrottle(detail.tracker);
    throw new ApiException(429, "RATE_LIMITED", "Too many requests — slow down.", { retryAfterSeconds });
  }
}
