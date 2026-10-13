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
import {
  listTasksQuerySchema,
  seriesOccurrencesQuerySchema,
  seriesSummaryQuerySchema,
  taskCountsQuerySchema,
} from "@work-ledger/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { OrgVersioned } from "../cache/org-versioned";
import { TasksService } from "./tasks.service";

@Controller("organizations/:organizationId/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** Role-scoped (owner: org, manager: managed departments, member: assigned) — cached per requester. */
  @Get()
  @OrgVersioned({ namespace: "tasks" })
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
      archivedOnly: query.archived,
      excludeRecurringSeries: query.excludeRecurringSeries,
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

  /**
   * Pipeline card counts. Deliberately separate from `list()` — the card needs a total per status
   * (however many done/cancelled tasks exist), not a page of rows, so it can show a real number
   * before — and independent of whether — the board has paginated that far.
   */
  @Get("counts")
  @OrgVersioned({ namespace: "taskcounts" })
  counts(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    return this.tasks.counts(user.id, organizationId, taskCountsQuerySchema.parse(rawQuery));
  }

  /** Collapsed-card stats (count + latest + last completion) per recurring chain — see {@link counts} for why this is separate from `list()`. */
  @Get("series-summary")
  @OrgVersioned({ namespace: "seriessummary" })
  seriesSummary(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query = seriesSummaryQuerySchema.parse(rawQuery);
    return this.tasks.seriesSummaries(user.id, organizationId, {
      statuses: query.status,
      listId: query.listId,
      departmentId: query.departmentId,
      assigneeUserId: query.assigneeUserId,
      unassigned: query.unassigned,
      dueDateFrom: query.dueDateFrom,
      dueDateTo: query.dueDateTo,
    });
  }

  /** Full occurrence list for one recurring chain — only called once its RecurringSeriesCard is expanded. */
  @Get("series/:seriesId")
  seriesOccurrences(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Param("seriesId") seriesId: string,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query = seriesOccurrencesQuerySchema.parse(rawQuery);
    return this.tasks.seriesOccurrences(user.id, organizationId, seriesId, {
      status: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
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
