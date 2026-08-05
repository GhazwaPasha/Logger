import { Controller, Get, Inject } from "@nestjs/common";
import { Public } from "./auth/public.decorator";
import { MemoryCacheService } from "./cache/memory-cache.service";
import { Pool } from "pg";

@Controller()
export class HealthController {
  constructor(
    private readonly cache: MemoryCacheService,
    @Inject("PG_POOL") private readonly pool: Pool,
  ) {}

  @Public()
  @Get()
  root() {
    return { status: "ok" };
  }

  @Public()
  @Get("health")
  health() {
    return { status: "ok" };
  }

  @Public()
  @Get("health/cache")
  cacheStats() {
    return this.cache.getStats();
  }

  // Pinged by UptimeRobot to keep Supabase from auto-pausing after 7 days
  // of inactivity. Kept separate from /health so a DB hiccup doesn't make
  // Render's own health probe (which uses /health) mark the service down.
  @Public()
  @Get("health/db")
  async dbHealth() {
    await this.pool.query("SELECT 1");
    return { status: "ok", db: "reachable" };
  }
}
