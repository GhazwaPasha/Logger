import * as Sentry from "@sentry/nextjs";

/** Server-side error reporting (route handlers, Better Auth). Disabled unless SENTRY_DSN is set. */
export async function register() {
  const dsn = process.env.SENTRY_DSN?.trim();
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
