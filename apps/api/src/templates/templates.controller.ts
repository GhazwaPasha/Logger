import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { TemplatesService } from "./templates.service";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(256),
  defaultTitle: z.string().max(256).optional(),
  defaultPriority: z.enum(["low", "medium", "high"]).optional(),
  defaultDueRepeat: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  defaultListId: z.string().uuid().optional(),
  defaultSubtasks: z.array(z.object({ title: z.string().min(1).max(256) })).optional(),
});

@Controller("organizations/:orgId/templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("orgId") orgId: string) {
    return this.templates.list(user.id, orgId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Body() body: unknown,
  ) {
    const parsed = createTemplateSchema.parse(body);
    return this.templates.create(user.id, orgId, parsed);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    return this.templates.remove(user.id, orgId, id);
  }

  @Get(":id/apply")
  apply(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    return this.templates.apply(user.id, orgId, id);
  }
}
