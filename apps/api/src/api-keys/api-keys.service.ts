import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { createApiKeySchema } from "@work-ledger/contracts";
import { apiKeys } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";

const KEY_PREFIX = "wl_";

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async create(userId: string, body: unknown) {
    const parsed = createApiKeySchema.parse(body);
    const rawKey = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
    const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6);
    const [row] = await this.db
      .insert(apiKeys)
      .values({ userId, name: parsed.name, keyHash: hashKey(rawKey), keyPrefix })
      .returning({ id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix, createdAt: apiKeys.createdAt });
    /** Raw key is only ever returned here; only its hash is persisted. */
    return { ...row!, key: rawKey };
  }

  async list(userId: string) {
    return this.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async revoke(userId: string, id: string) {
    const [row] = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    if (!row) throw new NotFoundException("API key not found");
  }

  /** Verifies a raw bearer key and returns its owning user, or null if invalid/revoked. */
  async verify(rawKey: string): Promise<{ userId: string } | null> {
    const [row] = await this.db
      .select({ id: apiKeys.id, userId: apiKeys.userId })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hashKey(rawKey)), isNull(apiKeys.revokedAt)))
      .limit(1);
    if (!row) return null;
    void this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
    return { userId: row.userId };
  }
}
