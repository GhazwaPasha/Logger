import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { createCommentSchema, editCommentSchema } from "@work-ledger/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { CommentsService } from "./comments.service";

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get("tasks/:taskId/comments")
  list(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.comments.listForTask(user.id, taskId);
  }

  @Post("tasks/:taskId/comments")
  create(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    const parsed = createCommentSchema.parse(body);
    return this.comments.create(user.id, taskId, parsed);
  }

  @Patch("comments/:commentId")
  edit(
    @CurrentUser() user: RequestUser,
    @Param("commentId") commentId: string,
    @Body() body: unknown,
  ) {
    const { body: text } = editCommentSchema.parse(body);
    return this.comments.edit(user.id, commentId, text);
  }

  @Delete("comments/:commentId")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("commentId") commentId: string) {
    return this.comments.remove(user.id, commentId);
  }
}
