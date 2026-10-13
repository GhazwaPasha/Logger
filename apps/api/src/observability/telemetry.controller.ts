import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import { Public } from "../auth/public.decorator";
import { log } from "./logger";

const clientEventSchema = z.object({
  type: z.enum(["session_lost", "realtime_stopped"]),
  reason: z.string().max(64),
  platform: z.enum(["web", "android", "ios"]),
  appVersion: z.string().max(32).optional(),
  userId: z.string().max(64).optional(),
  organizationId: z.string().max(64).optional(),
});

/**
 * Clients report the moments they deliberately stop talking to the API (circuit breaker tripped,
 * realtime refused for good). Public on purpose: by definition the client may no longer hold a
 * credential the API accepts. Tightly rate-limited and size-bounded.
 */
@Controller("telemetry")
export class TelemetryController {
  @Public()
  @Throttle({ burst: { limit: 5, ttl: 60_000 }, sustained: { limit: 20, ttl: 3_600_000 } })
  @Post("client-events")
  @HttpCode(204)
  clientEvent(@Body() body: unknown): void {
    const event = clientEventSchema.parse(body);
    log.warn({ msg: "client_event", ...event });
  }
}
