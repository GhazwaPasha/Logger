import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
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
import { MemoryCacheService } from "../cache/memory-cache.service";
import { TasksService } from "./tasks.service";

/** Task rows are the most frequently mutated data in the app — short TTL keeps cross-user staleness bounded. */
const TASKS_LIST_TTL_SECONDS = 15;

@Controller("organizations/:organizationId/tasks")
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly cache: MemoryCacheService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query() rawQuery: Record<string, string>,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const query = listTasksQuerySchema.parse(rawQuery);
    // Results are role-scoped (owner sees the org, manager sees managed departments, member sees
    // only assigned tasks) — must key by requester, never shared. Filters are baked in too, since
    // each status/cursor/limit combination is effectively a different query.
    const key = `tasks:${organizationId}:${user.id}:${JSON.stringify(query)}`;
    const cached = this.cache.get(key);
    if (cached && cached.etag === ifNoneMatch) {
      res.status(304).end();
      return;
    }
    if (cached) {
      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", "private, no-cache");
      return cached.data;
    }
    const data = await this.tasks.list(user.id, organizationId, {
      includeSubtasks: query.includeSubtasks,
      status: query.status,
      listId: query.listId,
      departmentId: query.departmentId,
      assigneeUserId: query.assigneeUserId,
      dueDateFrom: query.dueDateFrom,
      dueDateTo: query.dueDateTo,
      limit: query.limit,
      cursor: query.cursor,
      archivedOnly: query.archived,
    });
    const etag = this.cache.set(key, data, TASKS_LIST_TTL_SECONDS);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    return data;
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

  @Delete(":taskId/subtasks/:subtaskId")
  deleteSubtask(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Param("subtaskId") subtaskId: string,
  ) {
    return this.tasks.deleteSubtask(user.id, taskId, subtaskId);
  }

  @Delete(":taskId")
  deleteTask(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.purge(user.id, taskId);
  }

  @Post(":taskId/archive")
  archive(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.archive(user.id, taskId);
  }

  @Post(":taskId/restore")
  restore(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.tasks.restore(user.id, taskId);
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
