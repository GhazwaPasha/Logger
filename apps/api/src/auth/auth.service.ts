import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from "jose";
import { ApiException, tokenExpired, tokenInvalid } from "../common/api-error";

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: ConfigService) {}

  private getJwks() {
    if (!this.jwks) {
      const url = this.config.getOrThrow<string>("AUTH_JWKS_URL");
      this.jwks = createRemoteJWKSet(new URL(url));
    }
    return this.jwks;
  }

  private getIssuerAndAudience(): { issuer: string | string[]; audience: string | string[] } {
    const parseList = (value?: string): string[] =>
      (value ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    const authIssuers = parseList(this.config.get<string>("AUTH_ISSUER"));
    const fallbackIssuers = parseList(this.config.get<string>("NEXT_PUBLIC_APP_URL"));
    const issuers = authIssuers.length > 0 ? authIssuers : fallbackIssuers;

    const authAudiences = parseList(this.config.get<string>("AUTH_AUDIENCE"));
    const fallbackAudiences = parseList(this.config.get<string>("NEXT_PUBLIC_APP_URL"));
    const audiences = authAudiences.length > 0 ? authAudiences : fallbackAudiences;

    if (issuers.length === 0 || audiences.length === 0) {
      throw new ApiException(500, "SERVER_ERROR", "Server auth config missing issuer/audience");
    }

    return {
      issuer: issuers.length === 1 ? issuers[0]! : issuers,
      audience: audiences.length === 1 ? audiences[0]! : audiences,
    };
  }

  /**
   * Verifies a Better Auth JWT. Failures are classified so clients can react correctly:
   * TOKEN_EXPIRED / TOKEN_INVALID (re-mint once), or SERVER_ERROR when the JWKS endpoint itself is
   * unreachable — a transient outage must never look like a bad credential, or clients would churn tokens.
   */
  async verifyBearerJwt(token: string): Promise<JWTPayload> {
    const { issuer, audience } = this.getIssuerAndAudience();
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer,
        audience,
      });
      if (typeof payload.sub !== "string" || !payload.sub) throw tokenInvalid("Invalid token subject");
      return payload;
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof joseErrors.JWTExpired) throw tokenExpired();
      if (
        err instanceof joseErrors.JWKSTimeout ||
        (err instanceof Error && !(err instanceof joseErrors.JOSEError))
      ) {
        const cause = (err as Error & { cause?: unknown }).cause;
        this.log.error(
          `JWKS unavailable (${err.name}): ${err.message || String(cause ?? "no detail")} url=${this.config.get<string>("AUTH_JWKS_URL")}`,
        );
        throw new ApiException(503, "SERVER_ERROR", "Authentication is temporarily unavailable");
      }
      throw tokenInvalid();
    }
  }
}
