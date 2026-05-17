import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { listTasksQuerySchema } from "@work-ledger/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { TasksService } from "./tasks.service";

@Controller("organizations/:organizationId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query = listTasksQuerySchema.parse(rawQuery);
    return this.tasks.list(user.id, organizationId, {
      includeSubtasks: query.includeSubtasks,
      status: query.status,
      listId: query.listId,
      departmentId: query.departmentId,
      assigneeUserId: query.assigneeUserId,
      dueDateFrom: query.dueDateFrom,
      dueDateTo: query.dueDateTo,
      limit: query.limit,
      cursor: query.cursor,
    });
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

  @Patch(":taskId")
  patchTask(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.patchTask(user.id, taskId, body);
  }

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

  @Post(":taskId/status")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.updateStatus(user.id, taskId, body);
  }

  @Get(":taskId/subtasks")
  listSubtasks(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.listSubtasks(user.id, taskId);
  }

  @Post(":taskId/subtasks")
  createSubtask(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.createSubtask(user.id, taskId, body);
  }

  @Patch(":taskId/subtasks/:subtaskId")
  patchSubtask(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Param("subtaskId") subtaskId: string,
    @Body() body: unknown,
  ) {
    return this.tasks.patchSubtask(user.id, taskId, subtaskId, body);
  }

  @Post(":taskId/archive")
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
