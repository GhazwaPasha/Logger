import "./load-env";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { corsAllowedOrigins } from "./cors-origins";

/**
 * Browser origins allowed to call the API.
 * - **`NEXT_PUBLIC_APP_URL`** on the API (comma-separated) — same list style as Auth issuer/audience.
 * - **`API_CORS_ORIGINS`** (comma-separated) — **merged** with the above when set, so listing one does not drop the other.
 * - **`API_CORS_ALLOW_VERCEL_APP`** — `1` / `true` appends a regex for all `https://*.vercel.app` origins (optional; use when previews must call prod API).
 *
 * Shared implementation: `cors-origins.ts` (also used by Socket.IO).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.enableCors({
    origin: corsAllowedOrigins(),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept", "Mcp-Session-Id", "Mcp-Protocol-Version"],
    exposedHeaders: ["Mcp-Session-Id"],
  });
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
