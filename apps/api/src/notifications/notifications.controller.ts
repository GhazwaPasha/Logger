import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import {
  listNotificationsQuerySchema,
  markAllNotificationsReadSchema,
  markNotificationsReadSchema,
} from "@work-ledger/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query() rawQuery: Record<string, string>) {
    const query = listNotificationsQuerySchema.parse(rawQuery);
    return this.notifications.listForUser(user.id, query.orgId, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
    });
  }

  @Get("count")
  count(@CurrentUser() user: RequestUser, @Query("orgId") orgId: string) {
    return this.notifications.countUnread(user.id, orgId);
  }

  @Post("read")
  markRead(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const parsed = markNotificationsReadSchema.parse(body);
    return this.notifications.markRead(user.id, parsed.ids);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const parsed = markAllNotificationsReadSchema.parse(body);
    return this.notifications.markAllRead(user.id, parsed.orgId);
  }
}
