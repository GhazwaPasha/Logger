import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE } from "./drizzle.constants";
import { createDbFromPool, normalizeDatabaseUrl } from "@work-ledger/db";
import { Pool } from "pg";
import { instrumentPool } from "../observability/instrument-pool";

@Global()
@Module({
  providers: [
    {
      provide: "PG_POOL",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("DATABASE_URL");
        return instrumentPool(new Pool({ connectionString: normalizeDatabaseUrl(url) }));
      },
    },
    {
      provide: DRIZZLE,
      inject: ["PG_POOL"],
      useFactory: (pool: Pool) => createDbFromPool(pool),
    },
  ],
  exports: [DRIZZLE, "PG_POOL"],
})
export class DbModule {}
