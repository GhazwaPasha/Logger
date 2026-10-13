import "./load-env";
import "./instrument";
import compression from "compression";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { corsAllowedOrigins } from "./cors-origins";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { requestTelemetry } from "./observability/request-telemetry.middleware";
import { UsageMonitorService } from "./observability/usage-monitor.service";

/**
 * Browser origins allowed to call the API.
 * - **`NEXT_PUBLIC_APP_URL`** on the API (comma-separated) — same list style as Auth issuer/audience.
 * - **`API_CORS_ORIGINS`** (comma-separated) — **merged** with the above when set, so listing one does not drop the other.
 * - **`API_CORS_ALLOW_VERCEL_APP`** — `1` / `true` appends a regex for all `https://*.vercel.app` origins (optional; use when previews must call prod API).
 *
 * Shared implementation: `cors-origins.ts` (also used by Socket.IO).
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: false });
  // Render terminates TLS in front of us; trust its X-Forwarded-For so per-IP limits see real clients.
  app.set("trust proxy", 1);
  app.use(requestTelemetry(app.get(UsageMonitorService)));
  app.use(compression({ threshold: 1024 }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: corsAllowedOrigins(),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Accept",
      "If-None-Match",
      "Mcp-Session-Id",
      "Mcp-Protocol-Version",
    ],
    exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate", "ETag", "Retry-After", "X-Request-Id"],
  });
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
