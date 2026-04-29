import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DRIZZLE } from "./drizzle.constants";
import { createDbFromPool } from "@work-ledger/db";
import { Pool } from "pg";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("DATABASE_URL");
        const pool = new Pool({ connectionString: url });
        return createDbFromPool(pool);
      },
    },
    {
      provide: "PG_POOL",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>("DATABASE_URL");
        return new Pool({ connectionString: url });
      },
    },
  ],
  exports: [DRIZZLE, "PG_POOL"],
})
export class DbModule {}
