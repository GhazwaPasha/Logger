import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { WebhooksService } from "./webhooks.service";

const createWebhookSchema = z.object({
  url: z.string().url().max(1000),
  events: z.array(z.string()).min(1).max(10),
  secret: z.string().min(16).max(256).optional(),
});

@Controller("organizations/:orgId/webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param("orgId") orgId: string) {
    return this.webhooks.list(user.id, orgId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Body() body: unknown,
  ) {
    const parsed = createWebhookSchema.parse(body);
    return this.webhooks.create(user.id, orgId, parsed);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    return this.webhooks.remove(user.id, orgId, id);
  }

  @Post(":id/test")
  test(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    return this.webhooks.test(user.id, orgId, id);
  }

  @Get(":id/deliveries")
  deliveries(
    @CurrentUser() user: RequestUser,
    @Param("orgId") orgId: string,
    @Param("id") id: string,
  ) {
    return this.webhooks.listDeliveries(user.id, orgId, id);
  }
}
