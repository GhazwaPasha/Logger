import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

@Injectable()
export class AuthService {
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
      throw new UnauthorizedException("Server auth config missing issuer/audience");
    }

    return {
      issuer: issuers.length === 1 ? issuers[0]! : issuers,
      audience: audiences.length === 1 ? audiences[0]! : audiences,
    };
  }

  async verifyBearerJwt(token: string): Promise<JWTPayload> {
    const { issuer, audience } = this.getIssuerAndAudience();
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer,
        audience,
      });
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
