import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { AttachmentsService } from "./attachments.service";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get("tasks/:taskId/attachments")
  list(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.attachments.listForTask(user.id, taskId);
  }

  @Post("tasks/:taskId/attachments/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE } }))
  upload(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded");
    return this.attachments.upload(user.id, taskId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Post("tasks/:taskId/attachments/discord-submit")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_FILE_SIZE } }))
  discordSubmit(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file?.buffer) throw new BadRequestException("No file uploaded");
    return this.attachments.discordSubmit(user.id, taskId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
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
