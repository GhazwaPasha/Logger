import type { Jwk, JwtOptions } from "better-auth/plugins";

type JwksAdapter = NonNullable<JwtOptions["adapter"]>;

/** How long a signing key is used before Better Auth mints the next one. */
export const JWKS_ROTATION_INTERVAL_SECONDS = 60 * 60 * 24 * 90;

/**
 * How long a rotated-out public key stays in the JWKS document. Only needs to outlive the longest
 * JWT signed with it (15 min by default) plus the API's remote-JWKS cache, so a day is generous.
 */
export const JWKS_GRACE_PERIOD_SECONDS = 60 * 60 * 24;

/** Key rows are read on every token mint and every JWKS fetch; they change only on rotation. */
const KEY_CACHE_TTL_MS = 60_000;

let cached: { keys: Jwk[]; expiresAt: number } | null = null;

/** Secret versions configured in BETTER_AUTH_SECRETS ("<version>:<secret>,…"). */
const SECRET_VERSIONS = new Set(
  (process.env.BETTER_AUTH_SECRETS ?? "")
    .split(",")
    .map((entry) => entry.split(":")[0]?.trim())
    .filter(Boolean),
);

/**
 * Private keys are stored as a JSON-encoded ciphertext string in Better Auth's versioned envelope
 * (`$ba$<version>$<hex>`). Two kinds of legacy key must never sign or verify again:
 * - a JSON-encoded JWK *object*: minted while encryption was disabled, readable by anyone with table access;
 * - a bare-hex ciphertext: encrypted under the old unversioned secret, which was a fallback string
 *   committed to the repo — so anyone with table access could decrypt it.
 * Keys whose version is no longer configured are dropped too, so retiring a secret retires its keys.
 */
function isEncryptedKey(key: Jwk): boolean {
  try {
    const ciphertext: unknown = JSON.parse(key.privateKey);
    if (typeof ciphertext !== "string") return false;
    const version = /^\$ba\$(\d+)\$/.exec(ciphertext)?.[1];
    return version !== undefined && SECRET_VERSIONS.has(version);
  } catch {
    return false;
  }
}

/**
 * JWKS storage for the Better Auth `jwt` plugin.
 *
 * - Only keys whose private half is encrypted at rest (with a current BETTER_AUTH_SECRETS entry) are trusted. Dropping
 *   a legacy plaintext key from this set retires it everywhere at once: it stops signing, disappears
 *   from `/api/auth/jwks`, and the API rejects tokens it signed — clients transparently re-mint.
 * - Rows are memoized per server instance so token minting and JWKS serving don't each hit Postgres.
 */
export const jwksAdapter: JwksAdapter = {
  async getJwks(ctx) {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.keys;
    const rows = await ctx.context.adapter.findMany<Jwk>({ model: "jwks" });
    const keys = rows.filter(isEncryptedKey);
    cached = { keys, expiresAt: now + KEY_CACHE_TTL_MS };
    return keys;
  },
  async createJwk(data, ctx) {
    const created = await ctx.context.adapter.create<Omit<Jwk, "id">, Jwk>({
      model: "jwks",
      data: { ...data, createdAt: new Date() },
    });
    cached = null;
    return created;
  },
};
