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

  async verifyBearerJwt(token: string): Promise<JWTPayload> {
    const issuer = this.config.getOrThrow<string>("AUTH_ISSUER");
    const audience = this.config.getOrThrow<string>("AUTH_AUDIENCE");
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
