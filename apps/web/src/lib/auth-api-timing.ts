/**
 * Optional timing logs for Better Auth routes (local debugging).
 * Set `AUTH_TIMING_LOG=1` in `.env.local` to enable in production builds.
 * In development, logs when unset; set `AUTH_TIMING_LOG=0` to silence.
 */
export function shouldLogAuthTiming(): boolean {
  const flag = process.env.AUTH_TIMING_LOG?.trim();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function authPathLabel(url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.slice(-3).join("/") || url.pathname;
}
