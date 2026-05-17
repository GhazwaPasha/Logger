import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { TimeService } from "./time.service";

const logManualSchema = z.object({
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime(),
  note: z.string().max(512).optional(),
});

@Controller()
export class TimeController {
  constructor(private readonly time: TimeService) {}

  @Post("tasks/:taskId/time/start")
  start(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.time.start(user.id, taskId);
  }

  @Post("tasks/:taskId/time/stop")
  stop(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.time.stop(user.id, taskId);
  }

  @Post("tasks/:taskId/time/log")
  logManual(
    @CurrentUser() user: RequestUser,
    @Param("taskId") taskId: string,
    @Body() body: unknown,
  ) {
    const parsed = logManualSchema.parse(body);
    return this.time.logManual(user.id, taskId, {
      startedAt: new Date(parsed.startedAt),
      stoppedAt: new Date(parsed.stoppedAt),
      note: parsed.note,
    });
  }

  @Get("tasks/:taskId/time")
  list(@CurrentUser() user: RequestUser, @Param("taskId") taskId: string) {
    return this.time.listForTask(user.id, taskId);
  }

  @Delete("time/:entryId")
  @HttpCode(204)
  deleteEntry(@CurrentUser() user: RequestUser, @Param("entryId") entryId: string) {
    return this.time.deleteEntry(user.id, entryId);
  }
}
