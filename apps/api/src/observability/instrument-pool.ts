import type { Pool, PoolClient, QueryResult } from "pg";
import { recordDbResult } from "./request-context";

function rowsOf(result: unknown): number {
  const r = result as QueryResult | QueryResult[] | undefined;
  if (Array.isArray(r)) return r.reduce((n, x) => n + (x?.rows?.length ?? 0), 0);
  return r?.rows?.length ?? 0;
}

type Queryable = Pick<Pool | PoolClient, "query">;

function wrapQuery(target: Queryable): void {
  const original = target.query.bind(target) as (...args: unknown[]) => unknown;
  (target as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
    const last = args[args.length - 1];
    if (typeof last === "function") {
      // Callback form: count in the callback.
      const cb = last as (err: unknown, res: unknown) => void;
      args[args.length - 1] = (err: unknown, res: unknown) => {
        if (!err) recordDbResult(rowsOf(res));
        cb(err, res);
      };
      return original(...args);
    }
    const out = original(...args);
    if (out && typeof (out as Promise<unknown>).then === "function") {
      return (out as Promise<unknown>).then((res) => {
        recordDbResult(rowsOf(res));
        return res;
      });
    }
    return out;
  };
}

/**
 * Attributes every row Postgres returns to the request that asked for it (see `request-context`),
 * so request logs show DB cost per route and per user — the number that drives database egress.
 */
export function instrumentPool(pool: Pool): Pool {
  wrapQuery(pool);
  pool.on("connect", (client) => wrapQuery(client));
  return pool;
}
