import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { createDbFromPool, normalizeDatabaseUrl } from "@work-ledger/db";
import { account, jwks, session, user, verification } from "@work-ledger/db/schema";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for Better Auth");
}

const pool = new Pool({ connectionString: normalizeDatabaseUrl(connectionString) });
export const authDb = createDbFromPool(pool);

/** Canonical site URL for Better Auth (must match browser origin on each deployment). */
function resolveAuthBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/**
 * Static origin allowlist (env + defaults).
 * On Vercel, browser Origin often matches `x-forwarded-host`, which may differ from BETTER_AUTH_URL
 * (preview URL vs production alias, custom domain vs *.vercel.app). Per-request origins are merged below.
 */
function resolveTrustedOriginsStatic(): string[] {
  const origins = new Set<string>();
  const addUrl = (value?: string | null) => {
    const v = value?.trim();
    if (!v) return;
    try {
      const withProto = v.includes("://") ? v : `https://${v}`;
      origins.add(new URL(withProto).origin);
    } catch {
      /* ignore invalid */
    }
  };
  addUrl(resolveAuthBaseUrl());
  addUrl(process.env.BETTER_AUTH_URL);
  addUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.VERCEL_URL) addUrl(`https://${process.env.VERCEL_URL}`);
  if (origins.size === 0) addUrl("http://localhost:3000");
  // Host wildcard — matches any *.vercel.app deployment (previews + production hostname mismatches).
  if (process.env.VERCEL) origins.add("*.vercel.app");
  return [...origins];
}

async function resolveTrustedOrigins(request?: Request): Promise<string[]> {
  const list = resolveTrustedOriginsStatic();
  if (!request) return list;

  const extra = new Set<string>();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      try {
        extra.add(new URL(`${proto}://${host}`).origin);
      } catch {
        /* ignore */
      }
    }
  }

  return [...new Set([...list, ...extra])];
}

const authBaseUrl = resolveAuthBaseUrl();

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: { user, session, account, verification, jwks },
  }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
  baseURL: authBaseUrl,
  trustedOrigins: resolveTrustedOrigins,
  plugins: [
    jwt({
      jwks: {
        // Default encrypts JWKS private keys with BETTER_AUTH_SECRET; changing the secret without DB cleanup
        // causes "Failed to decrypt private key" and 500s on get-session. Storing the key material unencrypted
        // in Postgres (still protected by DB access) avoids deploy/env secret mismatches with Neon.
        disablePrivateKeyEncryption: true,
      },
    }),
    nextCookies(),
    dash({
      // Required for Better Auth Infra / dashboard “connect your app” validation
      apiKey: process.env.BETTER_AUTH_API_KEY,
      ...(process.env.BETTER_AUTH_API_URL && {
        apiUrl: process.env.BETTER_AUTH_API_URL,
      }),
      ...(process.env.BETTER_AUTH_KV_URL && {
        kvUrl: process.env.BETTER_AUTH_KV_URL,
      }),
    }),
  ],
});
