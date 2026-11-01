import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AgentStreamEvent } from "@work-ledger/contracts";
import { CurrentUser } from "../auth/current-user.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { AgentService } from "./agent.service";

@Controller()
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get("organizations/:organizationId/agent/threads")
  listThreads(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Query("taskId") taskId?: string,
  ) {
    return this.agent.listThreads(user.id, organizationId, { taskId: taskId || undefined });
  }

  @Get("agent/threads/:threadId")
  getThread(@CurrentUser() user: RequestUser, @Param("threadId") threadId: string) {
    return this.agent.getThread(user.id, threadId);
  }

  @Patch("agent/threads/:threadId")
  patchThread(@CurrentUser() user: RequestUser, @Param("threadId") threadId: string, @Body() body: unknown) {
    return this.agent.patchThread(user.id, threadId, body);
  }

  @Delete("agent/threads/:threadId")
  @HttpCode(204)
  deleteThread(@CurrentUser() user: RequestUser, @Param("threadId") threadId: string) {
    return this.agent.deleteThread(user.id, threadId);
  }

  /**
   * Streams the run as newline-delimited JSON ({@link AgentStreamEvent} per line). Validation, budget and
   * permission failures throw before the first byte, so they arrive as ordinary JSON errors.
   */
  @Post("organizations/:organizationId/agent/ask")
  async ask(
    @CurrentUser() user: RequestUser,
    @Param("organizationId") organizationId: string,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const { run } = await this.agent.prepareAsk(user.id, organizationId, body);

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    // `no-transform` keeps the compression middleware from buffering the stream; the other two stop proxies doing so.
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Stop spending model calls once the client is gone (closed panel, lost connection).
    const aborted = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) aborted.abort();
    });

    const emit = (e: AgentStreamEvent) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(e)}\n`);
    };
    await run(emit, aborted.signal);
    res.end();
  }
}
