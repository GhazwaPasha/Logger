import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request accounting, carried implicitly through every await in the request. */
export type RequestContext = {
  requestId: string;
  dbQueries: number;
  dbRows: number;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Attributes a query's result to the current request (no-op outside a request, e.g. crons). */
export function recordDbResult(rows: number): void {
  const ctx = requestContext.getStore();
  if (!ctx) return;
  ctx.dbQueries++;
  ctx.dbRows += rows;
}
