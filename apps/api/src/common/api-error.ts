import { HttpException } from "@nestjs/common";
import type { ApiErrorBody, ApiErrorCode } from "@work-ledger/contracts";

/**
 * An HTTP error that carries a machine-readable {@link ApiErrorCode}. Throw this wherever a client
 * needs to *decide* something from the failure (refresh a token, stop retrying, back off); plain
 * Nest exceptions still work and get a status-derived code from {@link ApiExceptionFilter}.
 */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode, message: string, extra?: Partial<ApiErrorBody>) {
    super({ statusCode: status, code, message, ...extra } satisfies ApiErrorBody, status);
  }
}

export const tokenMissing = () => new ApiException(401, "TOKEN_MISSING", "Missing bearer token");
export const tokenExpired = () => new ApiException(401, "TOKEN_EXPIRED", "Token has expired");
export const tokenInvalid = (message = "Invalid token") => new ApiException(401, "TOKEN_INVALID", message);
export const notAMember = () => new ApiException(403, "NOT_A_MEMBER", "Not a member of this organization");
