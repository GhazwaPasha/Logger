import pino from "pino";

/**
 * Structured JSON log stream (one object per line). Every line is machine-queryable by field —
 * e.g. in Render's log search or any log drain: `"msg":"request"` + `"userId":"…"`.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "logbase-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
});
