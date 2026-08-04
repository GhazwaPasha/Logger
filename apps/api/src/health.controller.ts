import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/public.decorator";
import { MemoryCacheService } from "./cache/memory-cache.service";

@Controller()
export class HealthController {
  constructor(private readonly cache: MemoryCacheService) {}

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
}
