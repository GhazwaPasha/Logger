import { BadRequestException } from "@nestjs/common";

/** Longest date range a performance or export request may cover. Wider ranges re-scan all history on every call. */
export const MAX_REPORT_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/** Upper bound on rows in one CSV export. Larger exports should be narrowed by date range. */
export const MAX_EXPORT_ROWS = 10_000;

export function assertReportRange(dateFrom: Date, dateTo: Date): void {
  if (dateTo.getTime() - dateFrom.getTime() > MAX_REPORT_RANGE_MS) {
    throw new BadRequestException("Date range can be at most one month. Pick a shorter range.");
  }
}
