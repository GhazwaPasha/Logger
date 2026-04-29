import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { createDbFromPool } from "@work-ledger/db";
import { account, jwks, session, user, verification } from "@work-ledger/db/schema";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for Better Auth");
}

const pool = new Pool({ connectionString });
export const authDb = createDbFromPool(pool);

/** Canonical site URL for Better Auth (must match browser origin on each deployment). */
function resolveAuthBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** Origins allowed for CSRF / Origin checks (prod previews + explicit env + local dev). */
function resolveTrustedOrigins(): string[] {
  const origins = new Set<string>();
  const add = (value?: string | null) => {
    const v = value?.trim();
    if (!v) return;
    try {
      const withProto = v.includes("://") ? v : `https://${v}`;
      origins.add(new URL(withProto).origin);
    } catch {
      /* ignore invalid */
    }
  };
  add(resolveAuthBaseUrl());
  add(process.env.BETTER_AUTH_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  if (process.env.VERCEL_URL) add(`https://${process.env.VERCEL_URL}`);
  if (origins.size === 0) add("http://localhost:3000");
  return [...origins];
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
  trustedOrigins: resolveTrustedOrigins(),
  plugins: [
    jwt(),
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
