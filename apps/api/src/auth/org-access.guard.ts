import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthorizationService, type OrganizationMember } from "../authorization/authorization.service";
import { ApiException, notAMember } from "../common/api-error";
import type { RequestUser } from "./jwt-auth.guard";
import { IS_PUBLIC_KEY } from "./public.decorator";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrgScopedRequest = Request & { user: RequestUser; orgMembership?: OrganizationMember };

/**
 * Runs after {@link JwtAuthGuard} on every HTTP route. Any route with an `:organizationId` param is
 * refused with NOT_A_MEMBER unless the caller belongs to that org — before the controller, and so
 * before any response cache, can run. Individual services may still check roles; they no longer
 * have to remember the membership check itself.
 */
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<OrgScopedRequest>();
    const param = req.params?.organizationId;
    const organizationId = typeof param === "string" ? param : undefined;
    if (!organizationId || !req.user) return true;
    if (!UUID_RE.test(organizationId)) throw new ApiException(404, "NOT_FOUND", "Organization not found");

    const membership = await this.authz.findMembership(req.user.id, organizationId);
    if (!membership) throw notAMember();
    req.orgMembership = membership;
    return true;
  }
}
