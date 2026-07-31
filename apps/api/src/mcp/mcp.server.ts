import { HttpException } from "@nestjs/common";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createCommentSchema,
  createGoalSchema,
  createMilestoneSchema,
  createTaskSchema,
  listTasksQuerySchema,
  logTimeEntrySchema,
  patchTaskSchema,
} from "@work-ledger/contracts";
import { z } from "zod";
import { CommentsService } from "../comments/comments.service";
import { DepartmentsService } from "../departments/departments.service";
import { DiscordIntegrationService } from "../discord/discord-integration.service";
import { ListsService } from "../lists/lists.service";
import { GoalsService } from "../roadmap/goals.service";
import { MilestonesService } from "../roadmap/milestones.service";
import { RoadmapService } from "../roadmap/roadmap.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { TasksService } from "../tasks/tasks.service";
import { TimeService } from "../time/time.service";

export interface McpServices {
  tasks: TasksService;
  time: TimeService;
  comments: CommentsService;
  organizations: OrganizationsService;
  departments: DepartmentsService;
  discord: DiscordIntegrationService;
  lists: ListsService;
  roadmap: RoadmapService;
  goals: GoalsService;
  milestones: MilestonesService;
}

/** Runs a service call and translates thrown Nest HTTP exceptions into an MCP tool error result instead of a transport-level 500. */
async function runTool<T>(fn: () => Promise<T>) {
  try {
    const result = await fn();
    // Compact (no pretty-print) — every byte here is tokens in the calling agent's context.
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
  } catch (err) {
    if (err instanceof HttpException) {
      return { isError: true, content: [{ type: "text" as const, text: err.message }] };
    }
    throw err;
  }
}

const DEFAULT_LIST_LIMIT = 50;
const HARD_LIST_CAP = 200;

/** Caps an array-shaped tool result. `items` is assumed most-relevant-first. */
function capList<T>(items: T[], limit: number = DEFAULT_LIST_LIMIT): T[] {
  return items.slice(0, Math.min(Math.max(1, limit), HARD_LIST_CAP));
}

const limitSchema = z.number().int().min(1).max(HARD_LIST_CAP).optional().default(DEFAULT_LIST_LIMIT);

/**
 * Thin, deliberately loosely-typed wrapper around `McpServer.registerTool`.
 *
 * The SDK's `registerTool` overload resolves a heavy Zod-version-agnostic generic
 * (`ShapeOutput<Args>`) per call; with 13 tools registered in one file, TypeScript's
 * structural checker degrades into false "not assignable" / "excessively deep" errors
 * (confirmed: even a single-field schema fails once enough calls accumulate). Routing every
 * registration through one cast avoids fighting the compiler per call site — each tool's
 * handler is still explicitly typed against its own Zod schema, so argument types stay checked.
 */
function registerTool<Args>(
  server: McpServer,
  name: string,
  config: { description: string; inputSchema?: Record<string, z.ZodTypeAny> },
  handler: (args: Args) => Promise<{ content: unknown[]; isError?: boolean }>,
) {
  (server.registerTool as (n: string, c: unknown, h: unknown) => void)(name, config, handler);
}

/** Builds a fresh MCP server for a single request, with every tool closed over the authenticated user's id. */
export function createMcpServer(userId: string, services: McpServices): McpServer {
  const server = new McpServer({ name: "work-ledger", version: "1.0.0" });

  registerTool<Record<string, never>>(
    server,
    "list_organizations",
    { description: "List organizations the current user belongs to." },
    async () => runTool(async () => capList(await services.organizations.listForUser(userId), HARD_LIST_CAP)),
  );

  registerTool<{ organizationId: string }>(
    server,
    "list_departments",
    {
      description: "List departments (org levels) within an organization.",
      inputSchema: { organizationId: z.string().uuid() },
    },
    async ({ organizationId }) =>
      runTool(async () => capList(await services.departments.list(userId, organizationId), HARD_LIST_CAP)),
  );

  registerTool<{ organizationId: string }>(
    server,
    "list_lists",
    {
      description:
        "List lists within an organization (id, name, departmentId) — use this to find the listId needed " +
        "for create_task, or for patch_task's listId to move a task to a different list/level.",
      inputSchema: { organizationId: z.string().uuid() },
    },
    async ({ organizationId }) =>
      runTool(async () => capList(await services.lists.list(userId, organizationId), HARD_LIST_CAP)),
  );

  registerTool<{ organizationId: string }>(
    server,
    "list_members",
    {
      description:
        "List members of an organization (userId, name, email, role, department) — use this to find the " +
        "userId needed for task assigneeUserIds or for @[Name](userId) comment mentions.",
      inputSchema: { organizationId: z.string().uuid() },
    },
    async ({ organizationId }) =>
      runTool(async () => capList(await services.organizations.listMembers(userId, organizationId), HARD_LIST_CAP)),
  );

  registerTool<{ organizationId: string }>(
    server,
    "list_discord_channels",
    {
      description:
        "List the Discord text channels available in an organization's connected server (id, name, position, " +
        "isPrivate) — use this to find the channelId needed for patch_task's discordChannelId. Returns an empty " +
        "list if the organization hasn't connected a Discord server.",
      inputSchema: { organizationId: z.string().uuid() },
    },
    async ({ organizationId }) =>
      runTool(async () => capList(await services.discord.listChannelsForOrg(userId, organizationId), HARD_LIST_CAP)),
  );

  registerTool<{ organizationId: string } & z.infer<typeof listTasksQuerySchema>>(
    server,
    "list_tasks",
    {
      description: "List tasks in an organization, optionally filtered.",
      inputSchema: { organizationId: z.string().uuid(), ...listTasksQuerySchema.shape },
    },
    async ({ organizationId, ...query }) =>
      runTool(() =>
        services.tasks.list(userId, organizationId, {
          includeSubtasks: query.includeSubtasks,
          status: query.status,
          listId: query.listId,
          departmentId: query.departmentId,
          assigneeUserId: query.assigneeUserId,
          dueDateFrom: query.dueDateFrom,
          dueDateTo: query.dueDateTo,
          limit: query.limit,
          cursor: query.cursor,
        }),
      ),
  );

  registerTool<{ taskId: string; includeLedger?: boolean }>(
    server,
    "get_task",
    {
      description:
        "Get detail for a single task (task fields, subtasks, capabilities). Activity ledger is omitted by " +
        "default (only its count is included) — pass includeLedger to fetch the full history.",
      inputSchema: { taskId: z.string().uuid(), includeLedger: z.boolean().optional().default(false) },
    },
    async ({ taskId, includeLedger }) =>
      runTool(async () => {
        const detail = await services.tasks.getDetail(userId, taskId);
        if (includeLedger) return detail;
        const { ledger, ...rest } = detail;
        return { ...rest, ledgerCount: ledger.length };
      }),
  );

  registerTool<{ organizationId: string } & z.infer<typeof createTaskSchema>>(
    server,
    "create_task",
    {
      description: "Create a new task in an organization.",
      inputSchema: { organizationId: z.string().uuid(), ...createTaskSchema.shape },
    },
    async ({ organizationId, ...body }) => runTool(() => services.tasks.create(userId, organizationId, body)),
  );

  registerTool<{ taskId: string } & z.infer<typeof patchTaskSchema>>(
    server,
    "patch_task",
    {
      description:
        "Update fields on an existing task — status, priority, title, due date, assignees, subtasks, etc. " +
        "Also controls Discord: set discordChannelId (use list_discord_channels to find a valid id, or null to " +
        "disable posting for this task) and discordSubmissionRequired (whether a Discord submission is required " +
        "before the task can be marked done — only meaningful once a channel is set). " +
        "Provide at least one field to change besides taskId.",
      inputSchema: { taskId: z.string().uuid(), ...patchTaskSchema._def.schema.shape },
    },
    async ({ taskId, ...body }) => runTool(() => services.tasks.patchTask(userId, taskId, body)),
  );

  registerTool<{ taskId: string } & z.infer<typeof logTimeEntrySchema>>(
    server,
    "log_time",
    {
      description: "Log a manual time entry against a task.",
      inputSchema: { taskId: z.string().uuid(), ...logTimeEntrySchema.shape },
    },
    async ({ taskId, startedAt, stoppedAt, note }) =>
      runTool(() =>
        services.time.logManual(userId, taskId, {
          startedAt: new Date(startedAt),
          stoppedAt: new Date(stoppedAt),
          note,
        }),
      ),
  );

  registerTool<{ taskId: string; limit?: number }>(
    server,
    "list_time_entries",
    {
      description: "List time entries logged against a task, most recent first.",
      inputSchema: { taskId: z.string().uuid(), limit: limitSchema },
    },
    // Service already orders newest-first, so a plain head-slice keeps the most recent entries.
    async ({ taskId, limit }) =>
      runTool(async () => capList(await services.time.listForTask(userId, taskId), limit)),
  );

  registerTool<{ taskId: string; limit?: number }>(
    server,
    "list_comments",
    {
      description: "List comments on a task, most recent first.",
      inputSchema: { taskId: z.string().uuid(), limit: limitSchema },
    },
    // Service orders oldest-first (thread order); reverse then cap to keep the most recent, newest-first.
    async ({ taskId, limit }) =>
      runTool(async () => {
        const comments = await services.comments.listForTask(userId, taskId);
        return capList([...comments].reverse(), limit);
      }),
  );

  registerTool<{ taskId: string } & z.infer<typeof createCommentSchema>>(
    server,
    "create_comment",
    {
      description: "Add a comment to a task.",
      inputSchema: { taskId: z.string().uuid(), ...createCommentSchema.shape },
    },
    async ({ taskId, ...body }) => runTool(() => services.comments.create(userId, taskId, body)),
  );

  registerTool<{ organizationId: string; limit?: number }>(
    server,
    "get_roadmap",
    {
      description: "Get the roadmap (goals and milestones) for an organization.",
      inputSchema: { organizationId: z.string().uuid(), limit: limitSchema },
    },
    async ({ organizationId, limit }) =>
      runTool(async () => {
        const tree = await services.roadmap.getTree(userId, organizationId);
        return { goals: capList(tree.goals, limit), milestones: capList(tree.milestones, limit) };
      }),
  );

  registerTool<{ organizationId: string } & z.infer<typeof createGoalSchema>>(
    server,
    "create_goal",
    {
      description: "Create a roadmap goal in an organization.",
      inputSchema: { organizationId: z.string().uuid(), ...createGoalSchema.shape },
    },
    async ({ organizationId, ...body }) => runTool(() => services.goals.create(userId, organizationId, body)),
  );

  registerTool<{ organizationId: string } & z.infer<typeof createMilestoneSchema>>(
    server,
    "create_milestone",
    {
      description: "Create a milestone under a roadmap goal.",
      inputSchema: { organizationId: z.string().uuid(), ...createMilestoneSchema.shape },
    },
    async ({ organizationId, ...body }) => runTool(() => services.milestones.create(userId, organizationId, body)),
  );

  return server;
}
