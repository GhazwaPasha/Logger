import { Body, Controller, Delete, Get, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { Public } from "../auth/public.decorator";
import { PushNotificationsService } from "./push-notifications.service";

@Controller("push")
export class PushController {
  constructor(private readonly push: PushNotificationsService) {}

  /** Public so the client can subscribe before sending the Bearer token on POST (same-origin API calls still work). */
  @Public()
  @Get("vapid-public-key")
  vapidPublicKey() {
    return { publicKey: this.push.getVapidPublicKey() };
  }

  @Post("subscription")
  subscribe(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.push.saveSubscription(user.id, body);
  }

  @Delete("subscription")
  unsubscribe(@CurrentUser() user: RequestUser, @Body() body: { endpoint?: string }) {
    return this.push.deleteSubscription(user.id, body?.endpoint);
  }
}
