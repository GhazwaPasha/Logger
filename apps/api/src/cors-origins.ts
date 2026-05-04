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
 * Browser origins allowed to call the API (REST + Socket.IO).
 * Same rules as documented on `main.ts` CORS.
 */
export function corsAllowedOrigins(): (string | RegExp)[] {
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
