import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";
import { log } from "./logger";

type Totals = { requests: number; dbRows: number; bytes: number };

const WINDOW_MINUTES = 15;

/** Budgets per 15-minute window. Normal usage is well under 5% of these (see the Oct 11 incident report). */
const ORG_WIDE_DB_ROWS_BUDGET = Number(process.env.USAGE_DB_ROWS_BUDGET ?? 2_000_000);
const ORG_WIDE_BYTES_BUDGET = Number(process.env.USAGE_BYTES_BUDGET ?? 250 * 1024 * 1024);
const PER_USER_REQUEST_BUDGET = Number(process.env.USAGE_USER_REQUESTS_BUDGET ?? 1_500);
const PER_USER_DB_ROWS_BUDGET = Number(process.env.USAGE_USER_DB_ROWS_BUDGET ?? 500_000);

/**
 * Egress watchdog. Aggregates request telemetry in 15-minute windows and raises an alert (warn log +
 * Sentry event) when the service, or any single user, exceeds budget — so a runaway client is
 * flagged within minutes, with the user, routes and volumes needed to act, instead of being
 * discovered days later on a billing chart.
 */
@Injectable()
export class UsageMonitorService {
  private total: Totals = { requests: 0, dbRows: 0, bytes: 0 };
  private byUser = new Map<string, Totals & { routes: Map<string, number> }>();
  private throttled = new Map<string, number>();

  record(e: { userId?: string; route: string; dbRows: number; bytes: number }): void {
    this.total.requests++;
    this.total.dbRows += e.dbRows;
    this.total.bytes += e.bytes;
    if (!e.userId) return;
    let u = this.byUser.get(e.userId);
    if (!u) {
      u = { requests: 0, dbRows: 0, bytes: 0, routes: new Map() };
      this.byUser.set(e.userId, u);
    }
    u.requests++;
    u.dbRows += e.dbRows;
    u.bytes += e.bytes;
    u.routes.set(e.route, (u.routes.get(e.route) ?? 0) + 1);
  }

  recordThrottle(tracker: string): void {
    this.throttled.set(tracker, (this.throttled.get(tracker) ?? 0) + 1);
  }

  @Cron(`0 */${WINDOW_MINUTES} * * * *`)
  flush(): void {
    const total = this.total;
    const users = [...this.byUser.entries()];
    const throttled = [...this.throttled.entries()];
    this.total = { requests: 0, dbRows: 0, bytes: 0 };
    this.byUser = new Map();
    this.throttled = new Map();
    if (total.requests === 0) return;

    const top = users
      .sort((a, b) => b[1].dbRows - a[1].dbRows)
      .slice(0, 5)
      .map(([userId, t]) => ({
        userId,
        requests: t.requests,
        dbRows: t.dbRows,
        bytes: t.bytes,
        topRoutes: [...t.routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      }));
    log.info({ msg: "usage_window", windowMinutes: WINDOW_MINUTES, ...total, topUsers: top, throttled });

    const alerts: string[] = [];
    if (total.dbRows > ORG_WIDE_DB_ROWS_BUDGET) alerts.push(`service read ${total.dbRows} DB rows`);
    if (total.bytes > ORG_WIDE_BYTES_BUDGET) alerts.push(`service sent ${Math.round(total.bytes / 1048576)} MB`);
    for (const [userId, t] of users) {
      if (t.requests > PER_USER_REQUEST_BUDGET) alerts.push(`user ${userId} made ${t.requests} requests`);
      if (t.dbRows > PER_USER_DB_ROWS_BUDGET) alerts.push(`user ${userId} read ${t.dbRows} DB rows`);
    }
    for (const [tracker, n] of throttled) alerts.push(`${tracker} was rate-limited ${n} times`);
    if (alerts.length === 0) return;

    const message = `Usage budget exceeded in the last ${WINDOW_MINUTES} min: ${alerts.join("; ")}`;
    log.warn({ msg: "usage_alert", alerts, topUsers: top });
    Sentry.captureMessage(message, { level: "warning", extra: { total, topUsers: top } });
  }
}
