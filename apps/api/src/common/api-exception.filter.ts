import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { type ApiErrorBody, apiErrorCodeForStatus, isApiErrorCode } from "@work-ledger/contracts";
import * as Sentry from "@sentry/nestjs";
import type { Response } from "express";

type ZodLikeError = { name: "ZodError"; issues: { path: (string | number)[]; message: string }[] };

function isZodError(err: unknown): err is ZodLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Normalizes every HTTP failure into {@link ApiErrorBody}: a stable `code` clients branch on, a
 * human message, and no stack traces. Schema `.parse()` failures become 400 VALIDATION_FAILED
 * instead of leaking out as 500s.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger("ApiExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") throw exception;
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.log.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
      Sentry.captureException(exception);
    }
    if (body.code === "RATE_LIMITED" && body.retryAfterSeconds) {
      res.setHeader("Retry-After", String(body.retryAfterSeconds));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (isZodError(exception)) {
      const issues = exception.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return {
        statusCode: 400,
        code: "VALIDATION_FAILED",
        message: issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ") || "Invalid request",
        issues,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
      const rawMessage = typeof raw === "string" ? raw : obj.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join(" ")
        : typeof rawMessage === "string" && rawMessage
          ? rawMessage
          : exception.message;
      return {
        ...obj,
        statusCode: status,
        code: isApiErrorCode(obj.code) ? obj.code : apiErrorCodeForStatus(status),
        message,
      } as ApiErrorBody;
    }

    return { statusCode: 500, code: "SERVER_ERROR", message: "Something went wrong" };
  }
}
