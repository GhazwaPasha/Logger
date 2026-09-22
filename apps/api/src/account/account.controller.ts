import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { AccountService } from "./account.service";

@Controller("account")
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Anonymises the signed-in user's account. Body: `{ "confirm": "DELETE" }`. */
  @Post("delete")
  @HttpCode(200)
  deleteAccount(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.accountService.deleteAccount(user.id, body);
  }
}
