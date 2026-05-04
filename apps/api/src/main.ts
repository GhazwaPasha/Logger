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

/** Browser origins allowed to call the API (comma-separated). Overrides NEXT_PUBLIC_APP_URL when set. */
function corsAllowedOrigins(): (string | RegExp)[] {
  const multi = process.env.API_CORS_ORIGINS?.trim();
  if (multi) {
    const urls = normalizeOriginList(multi, "");
    return [...urls, /^https?:\/\/localhost(:\d+)?$/, /^exp:\/\//];
  }
  // Match auth.service: NEXT_PUBLIC_APP_URL may be comma-separated issuer/audience URLs — allow CORS for each.
  const primaries = normalizeOriginList(
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
  );
  return [...primaries, /^https?:\/\/localhost(:\d+)?$/, /^exp:\/\//];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: false });
  app.enableCors({
    origin: corsAllowedOrigins(),
    credentials: true,
  });
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`API http://localhost:${port}`);
}

bootstrap();
