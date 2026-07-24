import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { createDbFromPool, normalizeDatabaseUrl } from "@work-ledger/db";
import { account, jwks, session, user, verification } from "@work-ledger/db/schema";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for Better Auth");
}

const pool = new Pool({ connectionString: normalizeDatabaseUrl(connectionString) });
export const authDb = createDbFromPool(pool);

/**
 * Caches this provider's avatar on the user (`discordImage`/`googleImage`) and decides what
 * `image` (the effective avatar rendered everywhere) should be.
 *
 * Linking/signing in with a *second* provider must not silently swap the visible avatar out from
 * under the user — so the effective image follows `avatarSource` once the user has picked one in
 * settings, and otherwise defaults to Discord's avatar (falling back to Google's, then whatever
 * this sign-in just provided for brand-new users with no row yet).
 */
async function resolveAvatarFields(email: string, providerId: "discord" | "google", newImage: string | undefined) {
  if (!newImage) return {};
  const [existing] = await authDb
    .select({ discordImage: user.discordImage, googleImage: user.googleImage, avatarSource: user.avatarSource })
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);

  const discordImage = providerId === "discord" ? newImage : (existing?.discordImage ?? undefined);
  const googleImage = providerId === "google" ? newImage : (existing?.googleImage ?? undefined);

  const image =
    existing?.avatarSource === "discord"
      ? (discordImage ?? newImage)
      : existing?.avatarSource === "google"
        ? (googleImage ?? newImage)
        : (discordImage ?? googleImage ?? newImage);

  return {
    image,
    ...(providerId === "discord" ? { discordImage: newImage } : { googleImage: newImage }),
  };
}

/** Canonical site URL for Better Auth (must match browser origin on each deployment). */
function resolveAuthBaseUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const publicApp = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicApp) return publicApp.replace(/\/$/, "");
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

/**
 * `__Secure-*` session cookies require `Secure` and are dropped on `http://` origins.
 * If `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` point at https while you run `next dev` on
 * localhost, Better Auth would otherwise mint secure-only cookies and the browser would
 * never persist the session. See Better Auth `createCookieGetter` + `advanced.useSecureCookies`.
 */
function resolveUseSecureCookies(): boolean {
  if (process.env.AUTH_FORCE_INSECURE_COOKIES === "1" || process.env.AUTH_FORCE_INSECURE_COOKIES === "true") {
    return false;
  }
  if (process.env.AUTH_FORCE_SECURE_COOKIES === "1" || process.env.AUTH_FORCE_SECURE_COOKIES === "true") {
    return true;
  }
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.VERCEL === "1") return true;
  return /^https:\/\//i.test(process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "");
}

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: { user, session, account, verification, jwks },
  }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      // Server-only: synced from OAuth profiles by resolveAvatarFields, not client-settable.
      discordImage: { type: "string", required: false, input: false },
      googleImage: { type: "string", required: false, input: false },
      // Client-settable via authClient.updateUser — the user's chosen avatar provider.
      avatarSource: { type: "string", required: false },
    },
  },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_LOGIN_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_LOGIN_CLIENT_SECRET ?? "",
      /** Without this, linking a provider to an existing account never backfills its avatar/name. */
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) =>
        profile.email ? resolveAvatarFields(profile.email, "discord", profile.image_url) : {},
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      overrideUserInfoOnSignIn: true,
      mapProfileToUser: (profile) =>
        profile.email ? resolveAvatarFields(profile.email, "google", profile.picture) : {},
    },
  },
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production-min-32-chars!!",
  baseURL: authBaseUrl,
  trustedOrigins: resolveTrustedOrigins,
  session: {
    /** Keep signed-in users on longer-lived server sessions; sliding window via updateAge. */
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: resolveUseSecureCookies(),
  },
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
