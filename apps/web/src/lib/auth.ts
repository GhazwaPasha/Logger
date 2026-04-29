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

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: { user, session, account, verification, jwks },
  }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
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
