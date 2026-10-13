import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { log } from "./logger";
import { type RequestContext, requestContext } from "./request-context";
import type { UsageMonitorService } from "./usage-monitor.service";

/**
 * One structured line per request: who (user, org), what (route template, status), and what it cost
 * (duration, response bytes, Postgres queries and rows). Also feeds the egress watchdog.
 */
export function requestTelemetry(monitor: UsageMonitorService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    const ctx: RequestContext = { requestId: randomUUID(), dbQueries: 0, dbRows: 0 };
    res.setHeader("X-Request-Id", ctx.requestId);

    let bytes = 0;
    const write = res.write.bind(res) as (...a: unknown[]) => boolean;
    const end = res.end.bind(res) as (...a: unknown[]) => Response;
    const count = (chunk: unknown) => {
      if (typeof chunk === "string") bytes += Buffer.byteLength(chunk);
      else if (chunk instanceof Uint8Array) bytes += chunk.byteLength;
    };
    (res as { write: (...a: unknown[]) => boolean }).write = (...a: unknown[]) => {
      count(a[0]);
      return write(...a);
    };
    (res as { end: (...a: unknown[]) => Response }).end = (...a: unknown[]) => {
      if (typeof a[0] !== "function") count(a[0]);
      return end(...a);
    };

    res.on("finish", () => {
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      if (route === "/health" || route === "/") return;
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      monitor.record({ userId, route: `${req.method} ${route}`, dbRows: ctx.dbRows, bytes });
      log.info({
        msg: "request",
        requestId: ctx.requestId,
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        bytes,
        dbQueries: ctx.dbQueries,
        dbRows: ctx.dbRows,
        userId,
        orgId: typeof req.params?.organizationId === "string" ? req.params.organizationId : undefined,
        ua: req.headers["user-agent"]?.slice(0, 80),
      });
    });

    requestContext.run(ctx, next);
  };
}
