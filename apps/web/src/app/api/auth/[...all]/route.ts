import { auth } from "@/lib/auth";
import { authPathLabel, shouldLogAuthTiming } from "@/lib/auth-api-timing";
import { toNextJsHandler } from "better-auth/next-js";

const inner = toNextJsHandler(auth);

function timed(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    const url = new URL(req.url);
    const coldPath = url.pathname;
    const trace =
      shouldLogAuthTiming() &&
      (coldPath.includes("/get-session") ||
        coldPath.includes("/token") ||
        coldPath.includes("/sign-in"));

    if (!trace) return handler(req);

    const t0 = performance.now();
    let res: Response;
    try {
      res = await handler(req);
    } catch (err) {
      const ms = Math.round(performance.now() - t0);
      console.error(`[auth-timing] ${authPathLabel(url)} error after ${ms}ms`, err);
      throw err;
    }
    const ms = Math.round(performance.now() - t0);
    console.log(`[auth-timing] ${authPathLabel(url)} ${res.status} ${ms}ms`);
    return res;
  };
}

export const GET = timed(inner.GET);
export const POST = timed(inner.POST);
export const PATCH = timed(inner.PATCH);
export const PUT = timed(inner.PUT);
export const DELETE = timed(inner.DELETE);
