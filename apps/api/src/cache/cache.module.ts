import { Global, Module } from "@nestjs/common";
import { CacheStatsLoggerService } from "./cache-stats-logger.service";
import { MemoryCacheService } from "./memory-cache.service";

@Global()
@Module({
  providers: [MemoryCacheService, CacheStatsLoggerService],
  exports: [MemoryCacheService],
})
export class CacheModule {}
