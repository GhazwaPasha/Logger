import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { AttachmentsService } from "./attachments.service";

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get("tasks/:taskId/attachments")
  list(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.attachments.listForTask(user.id, taskId);
  }

  @Post("tasks/:taskId/attachments/presign")
  presign(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: { fileName: string; mimeType: string; fileSize: number },
  ) {
    return this.attachments.presign(user.id, taskId, body);
  }

  @Post("tasks/:taskId/attachments/confirm")
  confirm(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: { storageKey: string; fileName: string; fileSize: number; mimeType: string },
  ) {
    return this.attachments.confirm(user.id, taskId, body);
  }

  @Delete("attachments/:attachmentId")
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param("attachmentId") attachmentId: string) {
    return this.attachments.remove(user.id, attachmentId);
  }
}
