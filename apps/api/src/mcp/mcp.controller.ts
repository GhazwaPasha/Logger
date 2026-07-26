import { Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { McpAuthGuard } from "../auth/mcp-auth.guard";
import { Public } from "../auth/public.decorator";
import type { RequestUser } from "../auth/jwt-auth.guard";
import { CommentsService } from "../comments/comments.service";
import { DepartmentsService } from "../departments/departments.service";
import { ListsService } from "../lists/lists.service";
import { GoalsService } from "../roadmap/goals.service";
import { MilestonesService } from "../roadmap/milestones.service";
import { RoadmapService } from "../roadmap/roadmap.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { TasksService } from "../tasks/tasks.service";
import { TimeService } from "../time/time.service";
import { createMcpServer } from "./mcp.server";

@Controller("mcp")
@Public()
@UseGuards(McpAuthGuard)
export class McpController {
  constructor(
    private readonly tasks: TasksService,
    private readonly time: TimeService,
    private readonly comments: CommentsService,
    private readonly organizations: OrganizationsService,
    private readonly departments: DepartmentsService,
    private readonly lists: ListsService,
    private readonly roadmap: RoadmapService,
    private readonly goals: GoalsService,
    private readonly milestones: MilestonesService,
  ) {}

  @Post()
  async handle(@Req() req: Request & { user: RequestUser }, @Res() res: Response) {
    const server = createMcpServer(req.user.id, {
      tasks: this.tasks,
      time: this.time,
      comments: this.comments,
      organizations: this.organizations,
      departments: this.departments,
      lists: this.lists,
      roadmap: this.roadmap,
      goals: this.goals,
      milestones: this.milestones,
    });
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  }
}
