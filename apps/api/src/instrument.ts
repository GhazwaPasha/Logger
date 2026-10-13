import * as Sentry from "@sentry/nestjs";

/**
 * Error and alert reporting. Must be imported before anything else in `main.ts`. Disabled unless
 * SENTRY_DSN is set, so local runs and forks report nothing.
 */
const dsn = process.env.SENTRY_DSN?.trim();
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  release: process.env.RENDER_GIT_COMMIT,
  tracesSampleRate: 0,
});
