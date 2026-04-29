import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { AssignerOnlyGuard } from "./assigner-only.guard";
import { TasksService } from "./tasks.service";

@Controller("organizations/:organizationId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
  ) {
    return this.tasks.list(user.id, organizationId);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.create(user.id, organizationId, body);
  }
}

@Controller("tasks")
export class TasksByIdController {
  constructor(private readonly tasks: TasksService) {}

  @Get(":taskId")
  getOne(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.getDetail(user.id, taskId);
  }

  @Post(":taskId/ledger")
  appendLedger(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.appendLedger(user.id, taskId, body);
  }

  @Post(":taskId/reschedule")
  reschedule(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.reschedule(user.id, taskId, body);
  }

  @Post(":taskId/archive")
  @UseGuards(AssignerOnlyGuard)
  archive(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.archive(user.id, taskId);
  }

  @Get(":taskId/report.pdf")
  @Header("Content-Type", "application/pdf")
  async pdf(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Res() res: Response,
  ) {
    const bytes = await this.tasks.buildTaskPdf(user.id, taskId);
    res.setHeader("Content-Disposition", `attachment; filename="task-${taskId}.pdf"`);
    res.send(Buffer.from(bytes));
  }
}
