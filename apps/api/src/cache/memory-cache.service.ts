import { randomUUID } from "crypto";
import { Injectable } from "@nestjs/common";

type CacheEntry = {
  etag: string;
  data: unknown;
  expiresAt: number;
};

type CategoryStats = { hits: number; misses: number };

/** Bucket a key like `perf:scorecards:...` under `perf` — the segment before the first `:`. */
function categoryOf(key: string): string {
  const i = key.indexOf(":");
  return i === -1 ? key : key.slice(0, i);
}

/**
 * Zero-infra cache-aside store: an in-process Map with TTL + ETag. No Redis — Render's free
 * tier is single-instance anyway, so there's no cross-instance state to lose. Swap for a real
 * Redis-backed implementation later (same get/set/invalidatePrefix shape) if the app ever scales
 * past one instance; controllers that use this service wouldn't need to change.
 */
@Injectable()
export class MemoryCacheService {
  private readonly store = new Map<string, CacheEntry>();
  private readonly stats = new Map<string, CategoryStats>();

  private recordStat(key: string, hit: boolean): void {
    const category = categoryOf(key);
    const s = this.stats.get(category) ?? { hits: 0, misses: 0 };
    if (hit) s.hits++;
    else s.misses++;
    this.stats.set(category, s);
  }

  get(key: string): { etag: string; data: unknown } | undefined {
    const entry = this.store.get(key);
    const hit = Boolean(entry && entry.expiresAt > Date.now());
    this.recordStat(key, hit);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return { etag: entry.etag, data: entry.data };
  }

  set(key: string, data: unknown, ttlSeconds: number): string {
    const etag = randomUUID();
    this.store.set(key, { etag, data, expiresAt: Date.now() + ttlSeconds * 1000 });
    return etag;
  }

  /** Deletes every key starting with `prefix` — used to bust all variants (date ranges, requesters) for an org at once. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  getStats(): { entries: number; categories: Record<string, CategoryStats & { hitRate: number }> } {
    const categories: Record<string, CategoryStats & { hitRate: number }> = {};
    for (const [category, s] of this.stats) {
      const total = s.hits + s.misses;
      categories[category] = { ...s, hitRate: total > 0 ? s.hits / total : 0 };
    }
    return { entries: this.store.size, categories };
  }

  /** True if any hit/miss has been recorded since the process started — used to skip empty periodic logs. */
  hasActivity(): boolean {
    for (const s of this.stats.values()) {
      if (s.hits + s.misses > 0) return true;
    }
    return false;
  }
}
