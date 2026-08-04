import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MemoryCacheService } from "./memory-cache.service";

@Injectable()
export class CacheStatsLoggerService {
  private readonly logger = new Logger(CacheStatsLoggerService.name);
  private lastLoggedTotal = 0;

  constructor(private readonly cache: MemoryCacheService) {}

  @Cron("0 */15 * * * *")
  logStats(): void {
    if (process.env.CACHE_STATS_LOG === "0" || process.env.CACHE_STATS_LOG === "false") return;

    try {
      const stats = this.cache.getStats();
      const total = Object.values(stats.categories).reduce((sum, c) => sum + c.hits + c.misses, 0);
      // Skip logging when nothing happened since the last tick — avoids spamming an idle instance.
      if (total === this.lastLoggedTotal) return;
      this.lastLoggedTotal = total;

      const summary = Object.entries(stats.categories)
        .map(([cat, s]) => `${cat}=${s.hits}/${s.hits + s.misses} (${Math.round(s.hitRate * 100)}%)`)
        .join(", ");
      this.logger.log(`entries=${stats.entries} ${summary}`);
    } catch (err) {
      this.logger.error("Cache stats logging failed", err instanceof Error ? err.stack : String(err));
    }
  }
}
