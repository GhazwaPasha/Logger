import { HttpException } from "@nestjs/common";
import { formatInTimeZone, zonedPartsToUtc } from "@work-ledger/contracts";
import { z } from "zod";
import { CommentsService } from "../comments/comments.service";
import { DepartmentsService } from "../departments/departments.service";
import { ListsService } from "../lists/lists.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PerformanceService } from "../performance/performance.service";
import { RoadmapService } from "../roadmap/roadmap.service";
import { SearchService } from "../search/search.service";
import { TasksService } from "../tasks/tasks.service";

/**
 * The agent's tool registry. Every tool runs through the existing services *as the asking user*, so the
 * agent can never see or touch more than that user can. Tools here are read-only (`risk: "read"`); write
 * tools arrive with approval cards and must not be added without that gate.
 *
 * Outputs are deliberately compact and name-resolved (people, channels, categories) — every byte is
 * model input, and resolving ids here saves the model a lookup round per answer.
 */

export interface AgentToolServices {
  tasks: TasksService;
  search: SearchService;
  organizations: OrganizationsService;
  departments: DepartmentsService;
  lists: ListsService;
  comments: CommentsService;
  roadmap: RoadmapService;
  performance: PerformanceService;
}

export interface AgentToolContext {
  userId: string;
  organizationId: string;
  timeZone: string;
  services: AgentToolServices;
  /** Name lookups loaded once per run and shared by every tool call in it. */
  names: () => Promise<NameIndex>;
}

export type NameIndex = {
  people: Map<string, string>;
  channels: Map<string, { name: string; categoryId: string }>;
  categories: Map<string, string>;
};

export interface AgentTool<Args extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  risk: "read";
  input: z.ZodObject<z.ZodRawShape>;
  run: (ctx: AgentToolContext, args: Args) => Promise<unknown>;
  /** The one-line trail entry shown to the user once the call finishes, e.g. "Looked at 12 tasks". */
  label: (args: Args, result: unknown) => string;
}

const ACTIVE_STATUSES = ["pending", "in_progress"];
const STATUS_VALUES = ["pending", "in_progress", "done", "cancelled"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** `YYYY-MM-DD` read as a calendar day in the org's time zone → UTC instant at its start (or end). */
function dayBoundary(day: string, timeZone: string, edge: "start" | "end"): string {
  const [year, month, d] = day.split("-").map(Number);
  const start = zonedPartsToUtc({ year: year!, month: month!, day: d!, hour: 0, minute: 0 }, timeZone);
  return (edge === "start" ? start : new Date(start.getTime() + 86_400_000 - 1)).toISOString();
}

function when(date: Date | string | null | undefined, timeZone: string): string | null {
  if (!date) return null;
  return formatInTimeZone(new Date(date), timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | string | null;
  listId: string;
  completedAt?: Date | string | null;
  assigneeUserIds?: string[];
};

function compactTask(t: TaskRow, names: NameIndex, timeZone: string, now: number) {
  const channel = names.channels.get(t.listId);
  const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
  const open = ACTIVE_STATUSES.includes(t.status);
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due: when(t.dueAt, timeZone),
    overdue: open && due !== null && due < now ? true : undefined,
    channel: channel?.name,
    category: channel ? names.categories.get(channel.categoryId) : undefined,
    assignees: (t.assigneeUserIds ?? []).map((id) => names.people.get(id) ?? "Unknown"),
  };
}

const listTasksInput = z.object({
  status: z
    .array(z.enum(STATUS_VALUES))
    .optional()
    .describe("Only these statuses. Omit for open work (pending + in_progress)."),
  overdue: z.boolean().optional().describe("Only open tasks whose due date has passed."),
  assigneeUserId: z.string().optional().describe("Only tasks assigned to this person (userId from list_people)."),
  channelId: z.string().optional().describe("Only tasks in this channel (id from get_workspace)."),
  categoryId: z.string().optional().describe("Only tasks in this category (id from get_workspace)."),
  dueFrom: z.string().regex(DATE_RE).optional().describe("Due on or after this day, YYYY-MM-DD in the workspace time zone."),
  dueTo: z.string().regex(DATE_RE).optional().describe("Due on or before this day, YYYY-MM-DD in the workspace time zone."),
  limit: z.number().int().min(1).max(50).optional().describe("Max tasks to return (default 25)."),
});

const searchInput = z.object({ query: z.string().min(2).describe("Words from the task title.") });
const taskIdInput = z.object({ taskId: z.string().uuid() });
const getTaskInput = z.object({
  taskId: z.string().uuid(),
  includeHistory: z.boolean().optional().describe("Also return the latest 15 activity entries for this task."),
});
const activityInput = z.object({
  personUserId: z.string().optional().describe("Only activity by this person."),
  limit: z.number().int().min(1).max(40).optional().describe("Max entries (default 25)."),
});
const performanceInput = z.object({
  dateFrom: z.string().regex(DATE_RE).optional().describe("Range start, YYYY-MM-DD. Default: 30 days ago."),
  dateTo: z.string().regex(DATE_RE).optional().describe("Range end, YYYY-MM-DD. Default: today."),
});
const emptyInput = z.object({});

type ListTasksArgs = z.infer<typeof listTasksInput>;

function tool<S extends z.ZodObject<z.ZodRawShape>>(def: {
  name: string;
  description: string;
  input: S;
  run: (ctx: AgentToolContext, args: z.infer<S>) => Promise<unknown>;
  label: (args: z.infer<S>, result: unknown) => string;
}): AgentTool {
  return { ...def, risk: "read" } as unknown as AgentTool;
}

export const AGENT_TOOLS: AgentTool[] = [
  tool({
    name: "get_workspace",
    description:
      "The workspace layout: categories (departments) and the channels (lists) inside each, with ids. " +
      "Use it to turn a category or channel name the user mentions into an id for list_tasks.",
    input: emptyInput,
    run: async (ctx) => {
      const n = await ctx.names();
      return [...n.categories].map(([id, name]) => ({
        id,
        name,
        channels: [...n.channels].filter(([, c]) => c.categoryId === id).map(([cid, c]) => ({ id: cid, name: c.name })),
      }));
    },
    label: (_a, r) => `Read the workspace layout (${plural((r as unknown[]).length, "category", "categories")})`,
  }),

  tool({
    name: "list_people",
    description: "Members of this workspace with their userId and role. Use it to resolve a person's name to a userId.",
    input: emptyInput,
    run: async (ctx) => {
      const rows = await ctx.services.organizations.listMembers(ctx.userId, ctx.organizationId);
      return rows.map((m) => ({ userId: m.userId, name: m.name, role: m.role }));
    },
    label: (_a, r) => `Looked up ${plural((r as unknown[]).length, "person", "people")}`,
  }),

  tool({
    name: "list_tasks",
    description:
      "Tasks the user can see, filtered. Results only include tasks visible to the asking user's role. " +
      "Combine filters for questions like 'what is late in Design' or 'what does Ali have due this week'.",
    input: listTasksInput,
    run: async (ctx, a: ListTasksArgs) => {
      const now = Date.now();
      const status = a.status?.length ? a.status : ACTIVE_STATUSES;
      const result = await ctx.services.tasks.list(ctx.userId, ctx.organizationId, {
        includeSubtasks: false,
        status: a.overdue ? ACTIVE_STATUSES : status,
        listId: a.channelId,
        departmentId: a.categoryId,
        assigneeUserId: a.assigneeUserId,
        dueDateFrom: a.dueFrom ? dayBoundary(a.dueFrom, ctx.timeZone, "start") : undefined,
        dueDateTo: a.overdue ? new Date(now).toISOString() : a.dueTo ? dayBoundary(a.dueTo, ctx.timeZone, "end") : undefined,
        limit: a.limit ?? 25,
      });
      const names = await ctx.names();
      const rows = (result.tasks as TaskRow[]).filter((t) => !a.overdue || (t.dueAt && new Date(t.dueAt).getTime() < now));
      return { total: a.overdue ? rows.length : result.total, tasks: rows.map((t) => compactTask(t, names, ctx.timeZone, now)) };
    },
    label: (_a, r) => `Looked at ${plural((r as { tasks: unknown[] }).tasks.length, "task")}`,
  }),

  tool({
    name: "search_tasks",
    description: "Find tasks by words in their title, across every status. Use when the user names a task.",
    input: searchInput,
    run: async (ctx, a) => {
      const rows = await ctx.services.search.search(ctx.userId, ctx.organizationId, a.query);
      const names = await ctx.names();
      return rows.map((t) => compactTask(t, names, ctx.timeZone, Date.now()));
    },
    label: (a, r) => `Searched for “${a.query}” (${plural((r as unknown[]).length, "match", "matches")})`,
  }),

  tool({
    name: "get_task",
    description: "Full detail of one task: fields, assignees, subtasks, and optionally its recent activity history.",
    input: getTaskInput,
    run: async (ctx, a) => {
      const d = await ctx.services.tasks.getDetail(ctx.userId, a.taskId);
      const names = await ctx.names();
      const t = d.task as unknown as TaskRow & { assignerId: string; createdAt: Date };
      return {
        ...compactTask({ ...t, assigneeUserIds: d.assigneeUserIds }, names, ctx.timeZone, Date.now()),
        createdBy: names.people.get(t.assignerId),
        created: when(t.createdAt, ctx.timeZone),
        completed: when(t.completedAt, ctx.timeZone),
        subtasks: d.subtasks.map((s) => ({ title: s.title, done: s.done })),
        history: a.includeHistory
          ? d.ledger.slice(0, 15).map((l) => ({
              type: l.type,
              by: names.people.get(l.actorId) ?? "Someone",
              at: when(l.createdAt, ctx.timeZone),
              detail: l.payload,
            }))
          : undefined,
      };
    },
    label: (_a, r) => `Opened “${(r as { title: string }).title}”`,
  }),

  tool({
    name: "list_comments",
    description: "The latest 20 comments on a task, oldest first.",
    input: taskIdInput,
    run: async (ctx, a) => {
      const rows = await ctx.services.comments.listForTask(ctx.userId, a.taskId);
      return rows
        .filter((c) => c.body)
        .slice(-20)
        .map((c) => ({ by: c.authorName, at: when(c.createdAt, ctx.timeZone), body: c.body!.slice(0, 600) }));
    },
    label: (_a, r) => `Read ${plural((r as unknown[]).length, "comment")}`,
  }),

  tool({
    name: "get_status_counts",
    description: "How many tasks the user can see in each status, optionally for one category or channel.",
    input: z.object({ categoryId: z.string().optional(), channelId: z.string().optional() }),
    run: (ctx, a) =>
      ctx.services.tasks.counts(ctx.userId, ctx.organizationId, { departmentId: a.categoryId, listId: a.channelId }),
    label: () => "Counted tasks by status",
  }),

  tool({
    name: "get_recent_activity",
    description: "The workspace's latest activity (status changes, comments, reschedules…), newest first.",
    input: activityInput,
    run: async (ctx, a) => {
      const feed = await ctx.services.organizations.activityFeed(ctx.userId, ctx.organizationId, {
        limit: a.limit ?? 25,
        actorId: a.personUserId,
      });
      const names = await ctx.names();
      return feed.entries.map((e) => ({
        type: e.type,
        by: names.people.get(e.actorId) ?? "Someone",
        at: when(e.createdAt, ctx.timeZone),
        task: feed.tasksById[e.taskId]?.title,
        taskId: e.taskId,
        detail: e.payload,
      }));
    },
    label: (_a, r) => `Read ${plural((r as unknown[]).length, "recent update")}`,
  }),

  tool({
    name: "get_roadmap",
    description: "Roadmap goals and milestones with status, target dates and progress.",
    input: emptyInput,
    run: async (ctx) => {
      const tree = await ctx.services.roadmap.getTree(ctx.userId, ctx.organizationId);
      const names = await ctx.names();
      return {
        goals: tree.goals.map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status,
          target: when(g.targetDate, ctx.timeZone),
          owner: g.ownerId ? names.people.get(g.ownerId) : undefined,
          progressPct: g.progress.pct,
        })),
        milestones: tree.milestones.map((m) => ({
          goalId: m.goalId,
          title: m.title,
          status: m.status,
          ends: when(m.periodEnd, ctx.timeZone),
          progress: `${m.progress.done}/${m.progress.total}`,
        })),
      };
    },
    label: () => "Read the roadmap",
  }),

  tool({
    name: "get_team_performance",
    description:
      "Per-person completion stats (completed, on time, late, open) for a date range. Owners and managers only — " +
      "for anyone else this returns an error; tell the user it needs a manager role.",
    input: performanceInput,
    run: async (ctx, a) => {
      const res = await ctx.services.performance.scorecards(ctx.userId, ctx.organizationId, {
        dateFrom: a.dateFrom ? dayBoundary(a.dateFrom, ctx.timeZone, "start") : undefined,
        dateTo: a.dateTo ? dayBoundary(a.dateTo, ctx.timeZone, "end") : undefined,
      });
      return {
        range: { from: res.dateFrom, to: res.dateTo },
        members: res.members.map(({ image: _i, email: _e, ...m }) => m),
      };
    },
    label: (_a, r) => `Checked performance for ${plural((r as { members: unknown[] }).members.length, "person", "people")}`,
  }),
];

export const AGENT_TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

/**
 * Registry tools the MCP server exposes too (with an `organizationId` argument). The rest overlap MCP's own
 * older tools (`list_tasks`, `get_task`…), whose names and output shapes external clients already rely on.
 */
export const MCP_SHARED_TOOL_NAMES = ["search_tasks", "get_status_counts", "get_recent_activity", "get_team_performance"];

/** Builds the per-run context: name lookups load lazily on first use and are then shared by every call. */
export function createToolContext(
  services: AgentToolServices,
  userId: string,
  organizationId: string,
  timeZone: string,
): AgentToolContext {
  let names: Promise<NameIndex> | null = null;
  return {
    userId,
    organizationId,
    timeZone,
    services,
    names: () =>
      (names ??= Promise.all([
        services.organizations.listMembers(userId, organizationId),
        services.lists.list(userId, organizationId),
        services.departments.list(userId, organizationId),
      ]).then(([members, lists, depts]) => ({
        people: new Map(members.map((m) => [m.userId, m.name])),
        channels: new Map(lists.map((l) => [l.id, { name: l.name, categoryId: l.departmentId }])),
        categories: new Map(depts.map((d) => [d.id, d.name])),
      }))),
  };
}

/** Runs one tool call; a service's HTTP error (403, 404…) becomes `{ error }` the model can explain, not a crash. */
export async function runAgentTool(
  ctx: AgentToolContext,
  name: string,
  rawArgs: unknown,
): Promise<{ ok: true; result: unknown; label: string } | { ok: false; error: string; label: string }> {
  const t = AGENT_TOOLS_BY_NAME.get(name);
  if (!t) return { ok: false, error: `Unknown tool ${name}`, label: "Tried an unknown tool" };
  const parsed = t.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`, label: "Retried a lookup" };
  }
  try {
    const result = await t.run(ctx, parsed.data);
    return { ok: true, result, label: t.label(parsed.data, result) };
  } catch (err) {
    if (err instanceof HttpException) return { ok: false, error: err.message, label: "A lookup was not allowed" };
    throw err;
  }
}

/** Zod → the OpenAPI-subset schema Gemini's `functionDeclarations.parameters` accepts. Covers the shapes used above. */
export function toGeminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const description = schema.description;
  const withDesc = (s: Record<string, unknown>) => (description ? { ...s, description } : s);

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) {
    const inner = toGeminiSchema(schema._def.innerType as z.ZodTypeAny);
    return description ? { ...inner, description } : inner;
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const keys = Object.keys(shape);
    const required = keys.filter((k) => !shape[k]!.isOptional());
    if (keys.length === 0) return withDesc({ type: "OBJECT", properties: {} });
    return withDesc({
      type: "OBJECT",
      properties: Object.fromEntries(keys.map((k) => [k, toGeminiSchema(shape[k]!)])),
      ...(required.length ? { required } : {}),
    });
  }
  if (schema instanceof z.ZodArray) return withDesc({ type: "ARRAY", items: toGeminiSchema(schema.element) });
  if (schema instanceof z.ZodEnum) return withDesc({ type: "STRING", enum: [...schema.options] });
  if (schema instanceof z.ZodNumber) return withDesc({ type: schema.isInt ? "INTEGER" : "NUMBER" });
  if (schema instanceof z.ZodBoolean) return withDesc({ type: "BOOLEAN" });
  return withDesc({ type: "STRING" });
}
