import "./load-env";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/** Browser origins allowed to call the API (comma-separated). Overrides single-origin fallback when set. */
function corsAllowedOrigins(): (string | RegExp)[] {
  const multi = process.env.API_CORS_ORIGINS?.trim();
  if (multi) {
    const urls = multi
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    return [...urls, /^https?:\/\/localhost(:\d+)?$/, /^exp:\/\//];
  }
  const primary = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return [primary, /^https?:\/\/localhost(:\d+)?$/, /^exp:\/\//];
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
