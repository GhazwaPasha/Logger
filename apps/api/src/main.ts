import "./load-env";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function normalizeOriginList(raw: string | undefined, fallback: string): string[] {
  const source = raw?.trim() ? raw : fallback;
  return source
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function dedupeOrigins(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/** Any `https://*.vercel.app` origin (preview / branch deploys). JWT still required for protected routes. */
const VERCEL_APP_ORIGIN_REGEX = /^https:\/\/[^\s/]+\.vercel\.app$/;

/**
 * Browser origins allowed to call the API.
 * - **`NEXT_PUBLIC_APP_URL`** on the API (comma-separated) — same list style as Auth issuer/audience.
 * - **`API_CORS_ORIGINS`** (comma-separated) — **merged** with the above when set, so listing one does not drop the other.
 * - **`API_CORS_ALLOW_VERCEL_APP`** — `1` / `true` appends a regex for all `https://*.vercel.app` origins (optional; use when previews must call prod API).
 */
function corsAllowedOrigins(): (string | RegExp)[] {
  const fromAppUrl = normalizeOriginList(
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
  );
  const explicit = process.env.API_CORS_ORIGINS?.trim();
  const fromExplicit = explicit ? normalizeOriginList(explicit, "") : [];
  const staticOrigins = dedupeOrigins(
    fromExplicit.length > 0 ? [...fromExplicit, ...fromAppUrl] : fromAppUrl,
  );

  const origins: (string | RegExp)[] = [
    ...staticOrigins,
    /^https?:\/\/localhost(:\d+)?$/,
    /^exp:\/\//,
  ];

  const allowVercelWildcard =
    process.env.API_CORS_ALLOW_VERCEL_APP === "1" ||
    process.env.API_CORS_ALLOW_VERCEL_APP === "true";
  if (allowVercelWildcard) {
    origins.push(VERCEL_APP_ORIGIN_REGEX);
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.enableCors({
    origin: corsAllowedOrigins(),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept"],
  });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API http://localhost:${port}`);
}

bootstrap();
