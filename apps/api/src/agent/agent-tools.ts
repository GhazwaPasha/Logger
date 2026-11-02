import { randomUUID } from "node:crypto";
import { HttpException } from "@nestjs/common";
import { formatInTimeZone, zonedPartsToUtc } from "@work-ledger/contracts";
import { z } from "zod";
import type { AgentProposalKind, AgentTaskFormFill } from "@work-ledger/contracts";
import { AuthorizationService } from "../authorization/authorization.service";
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
 * agent can never see or touch more than that user can. Read tools (`risk: "read"`) answer straight away.
 * Write tools (`risk: "write"`) never change anything themselves: they check permissions, work out the
 * before → after, and file a *proposal* the user approves or rejects in the chat (see AgentService).
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
  authz: AuthorizationService;
}

/** What a write tool files for approval. `payload` is what approval executes; `items` is what the card shows. */
export type NewProposal = {
  kind: AgentProposalKind;
  summary: string;
  items: { taskId: string; title: string; from: string | null; to: string }[];
  payload: Record<string, unknown>;
};

export interface AgentToolContext {
  userId: string;
  organizationId: string;
  timeZone: string;
  services: AgentToolServices;
  /** Name lookups loaded once per run and shared by every tool call in it. */
  names: () => Promise<NameIndex>;
  /** Calls already made this run, by tool + arguments — the model sometimes repeats a lookup. */
  memo: Map<string, Promise<ToolOutcome>>;
  /** Files a proposal in the current conversation. Absent where approval isn't possible (e.g. MCP). */
  propose?: (p: NewProposal) => Promise<{ id: string }>;
  /** Sends fields to the task form open on screen. Absent when no form is open. */
  fillForm?: (fill: AgentTaskFormFill) => void;
}

export type NameIndex = {
  people: Map<string, string>;
  roles: Map<string, string>;
  channels: Map<string, { name: string; categoryId: string }>;
  categories: Map<string, string>;
};

export interface AgentTool<Args extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  risk: "read" | "write";
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

/** One task a write tool can act on, or why it can't. */
type Target = { ok: true; id: string; title: string; dueAt: Date | null; status: string } | { ok: false; id: string; reason: string };

/** Loads each task with the caller's permission for this kind of change. Unknown / forbidden tasks come back as reasons. */
async function targets(ctx: AgentToolContext, ids: string[], need: "edit" | "participate" | "archive"): Promise<Target[]> {
  return Promise.all(
    [...new Set(ids)].map(async (id): Promise<Target> => {
      try {
        const access = await ctx.services.authz.getTaskAccess(ctx.userId, id);
        if (access.task.organizationId !== ctx.organizationId) return { ok: false, id, reason: "not in this workspace" };
        const caps = ctx.services.authz.taskCapabilities(access, ctx.userId);
        const allowed = need === "edit" ? caps.canEditFields : need === "archive" ? caps.canArchiveTask : caps.canParticipate;
        if (!allowed) {
          return {
            ok: false,
            id,
            reason:
              need === "participate"
                ? "task is archived"
                : access.task.deletedAt
                  ? "task is already archived"
                  : "only the owner, the category's manager or the task's creator can change this",
          };
        }
        const t = access.task;
        return { ok: true, id, title: t.title, dueAt: t.dueAt, status: t.status };
      } catch (err) {
        return { ok: false, id, reason: err instanceof HttpException ? err.message : "couldn't load the task" };
      }
    }),
  );
}

const STATUS_NAMES: Record<string, string> = { pending: "Pending", open: "Pending", assigned: "Pending", in_progress: "In progress", late: "In progress", done: "Done", cancelled: "Cancelled" };
const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** "YYYY-MM-DDTHH:mm" read as wall-clock time in the workspace zone → UTC instant. */
function localToUtc(local: string, timeZone: string): Date {
  const [d, t] = local.split("T");
  const [year, month, day] = d!.split("-").map(Number);
  const [hour, minute] = t!.split(":").map(Number);
  return zonedPartsToUtc({ year: year!, month: month!, day: day!, hour: hour!, minute: minute! }, timeZone);
}

/** Shared tail of every write tool: file the proposal and tell the model plainly that nothing happened yet. */
async function fileProposal(ctx: AgentToolContext, proposal: NewProposal, skipped: { taskId: string; reason: string }[]) {
  if (!ctx.propose) throw new HttpException("Changes can only be proposed from Ask LogBase.", 400);
  if (!proposal.items.length) return { proposed: false, skipped, note: "Nothing to propose: every task was skipped." };
  const { id } = await ctx.propose(proposal);
  return {
    proposed: true,
    proposalId: id,
    summary: proposal.summary,
    skipped: skipped.length ? skipped : undefined,
    note: "Shown to the user as an approval card. NOT applied yet: it only happens if they approve.",
  };
}

function writeTool<S extends z.ZodObject<z.ZodRawShape>>(def: {
  name: string;
  description: string;
  input: S;
  run: (ctx: AgentToolContext, args: z.infer<S>) => Promise<unknown>;
  label: (args: z.infer<S>, result: unknown) => string;
}): AgentTool {
  return { ...def, risk: "write" } as unknown as AgentTool;
}

const proposedLabel = (r: unknown) => {
  const out = r as { proposed?: boolean; summary?: string };
  return out.proposed ? `Proposed: ${out.summary}` : "Couldn't propose that change";
};

const WRITE_TOOLS: AgentTool[] = [
  writeTool({
    name: "propose_reschedule",
    description:
      "Propose new due dates/times for one or more tasks (each can differ, e.g. 'push each by a day'). Files an approval " +
      "card; nothing changes until the user approves. Due must be in the future.",
    input: z.object({
      changes: z
        .array(
          z.object({
            taskId: z.string().uuid(),
            due: z.string().regex(LOCAL_DT_RE).describe("New due, YYYY-MM-DDTHH:mm in the workspace time zone."),
          }),
        )
        .min(1)
        .max(25),
      reason: z.string().min(1).max(300).describe("Short reason, recorded in the task history."),
    }),
    run: async (ctx, a) => {
      const now = Date.now();
      const found = await targets(ctx, a.changes.map((c) => c.taskId), "edit");
      const skipped: { taskId: string; reason: string }[] = [];
      const items: NewProposal["items"] = [];
      const payload: { taskId: string; newDueAt: string }[] = [];
      for (const c of a.changes) {
        const t = found.find((x) => x.id === c.taskId);
        if (!t || !t.ok) {
          skipped.push({ taskId: c.taskId, reason: t && !t.ok ? t.reason : "not found" });
          continue;
        }
        const due = localToUtc(c.due, ctx.timeZone);
        if (due.getTime() <= now) {
          skipped.push({ taskId: c.taskId, reason: "new due date is in the past" });
          continue;
        }
        items.push({ taskId: t.id, title: t.title, from: when(t.dueAt, ctx.timeZone), to: when(due, ctx.timeZone)! });
        payload.push({ taskId: t.id, newDueAt: due.toISOString() });
      }
      return fileProposal(
        ctx,
        { kind: "reschedule", summary: items.length === 1 ? "Reschedule 1 task" : `Reschedule ${items.length} tasks`, items, payload: { changes: payload, reason: a.reason } },
        skipped,
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "propose_assign",
    description: "Propose giving one or more tasks to a person (replaces the current assignee). Files an approval card.",
    input: z.object({
      taskIds: z.array(z.string().uuid()).min(1).max(25),
      assigneeUserId: z.string().min(1).describe("userId from the context block or list_people."),
    }),
    run: async (ctx, a) => {
      const names = await ctx.names();
      const to = names.people.get(a.assigneeUserId);
      if (!to) throw new HttpException("That person isn't a member of this workspace.", 400);
      const found = await targets(ctx, a.taskIds, "edit");
      const skipped = found.filter((t) => !t.ok).map((t) => ({ taskId: t.id, reason: (t as { reason: string }).reason }));
      const ok = found.filter((t): t is Extract<Target, { ok: true }> => t.ok);
      const current = await Promise.all(
        ok.map((t) => ctx.services.tasks.getDetail(ctx.userId, t.id).then((d) => d.assigneeUserIds).catch(() => [] as string[])),
      );
      const items = ok.map((t, i) => ({
        taskId: t.id,
        title: t.title,
        from: current[i]!.length ? current[i]!.map((id) => names.people.get(id) ?? "Someone").join(", ") : "Unassigned",
        to,
      }));
      return fileProposal(
        ctx,
        {
          kind: "assign",
          summary: items.length === 1 ? `Assign 1 task to ${to}` : `Assign ${items.length} tasks to ${to}`,
          items,
          payload: { taskIds: ok.map((t) => t.id), assigneeUserId: a.assigneeUserId },
        },
        skipped,
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "propose_status",
    description: "Propose moving one or more tasks to a status (pending, in_progress, done, cancelled). Files an approval card.",
    input: z.object({
      taskIds: z.array(z.string().uuid()).min(1).max(25),
      status: z.enum(STATUS_VALUES),
    }),
    run: async (ctx, a) => {
      const found = await targets(ctx, a.taskIds, "participate");
      const skipped = found.filter((t) => !t.ok).map((t) => ({ taskId: t.id, reason: (t as { reason: string }).reason }));
      const ok = found.filter((t): t is Extract<Target, { ok: true }> => t.ok && STATUS_NAMES[t.status] !== STATUS_NAMES[a.status]);
      for (const t of found) if (t.ok && !ok.includes(t)) skipped.push({ taskId: t.id, reason: `already ${STATUS_NAMES[a.status]}` });
      const items = ok.map((t) => ({ taskId: t.id, title: t.title, from: STATUS_NAMES[t.status] ?? t.status, to: STATUS_NAMES[a.status]! }));
      const verb = a.status === "done" ? "Complete" : a.status === "cancelled" ? "Cancel" : `Move to ${STATUS_NAMES[a.status]}:`;
      return fileProposal(
        ctx,
        { kind: "status", summary: `${verb} ${items.length === 1 ? "1 task" : `${items.length} tasks`}`, items, payload: { taskIds: ok.map((t) => t.id), status: a.status } },
        skipped,
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "propose_comment",
    description: "Propose posting a comment on a task (e.g. a reminder or a summary). Files an approval card; the user sees the exact text first.",
    input: z.object({ taskId: z.string().uuid(), body: z.string().min(1).max(1500) }),
    run: async (ctx, a) => {
      const [t] = await targets(ctx, [a.taskId], "participate");
      if (!t!.ok) return fileProposal(ctx, { kind: "comment", summary: "", items: [], payload: {} }, [{ taskId: a.taskId, reason: t!.reason }]);
      return fileProposal(
        ctx,
        { kind: "comment", summary: "Post a comment", items: [{ taskId: t!.id, title: t!.title, from: null, to: a.body }], payload: { taskId: t!.id, body: a.body } },
        [],
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "fill_task_form",
    description:
      "Fill in the task form the user has open (the context block says when one is). Applies on screen right away, with no " +
      "approval card, because they can see and edit it. Pass only the fields to change. Use this, not the propose_* tools, for " +
      "the open task. Only works while a form is open.",
    input: z.object({
      title: z.string().min(1).max(200).optional(),
      subtasks: z.array(z.string().min(1).max(200)).max(20).optional().describe("Checklist lines to add."),
      assigneeUserIds: z.array(z.string()).max(10).optional().describe("Replaces the assignees; an empty list clears them."),
      status: z.enum(STATUS_VALUES).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      due: z.string().regex(LOCAL_DT_RE).optional().describe("YYYY-MM-DDTHH:mm in the workspace time zone; must be in the future."),
      clearDue: z.boolean().optional().describe("Remove the due date (and any repeat)."),
      repeat: z.enum(["daily", "weekly", "monthly", "yearly", "none"]).optional().describe("Needs a due date; none stops repeating."),
    }),
    run: async (ctx, a) => {
      if (!ctx.fillForm) throw new HttpException("No task form is open.", 400);
      const names = await ctx.names();
      const unknown = (a.assigneeUserIds ?? []).filter((id) => !names.people.has(id));
      if (unknown.length) throw new HttpException("Some assignees aren't members of this workspace.", 400);

      const fill: AgentTaskFormFill = {};
      const filled: string[] = [];
      if (a.title) {
        fill.title = a.title;
        filled.push("title");
      }
      if (a.subtasks?.length) {
        fill.subtasks = a.subtasks;
        filled.push("subtasks");
      }
      if (a.assigneeUserIds) {
        fill.assigneeUserIds = a.assigneeUserIds;
        filled.push("assignee");
      }
      if (a.status) {
        fill.status = a.status;
        filled.push("status");
      }
      if (a.priority) {
        fill.priority = a.priority;
        filled.push("priority");
      }
      if (a.due) {
        const due = localToUtc(a.due, ctx.timeZone);
        if (due.getTime() <= Date.now()) throw new HttpException("That due date is in the past.", 400);
        fill.dueLocal = a.due;
        fill.dueAt = due.toISOString();
        filled.push("due date");
      } else if (a.clearDue) {
        fill.dueLocal = "";
        fill.dueAt = null;
        filled.push("due date");
      }
      if (a.repeat) {
        fill.dueRepeat = a.repeat;
        filled.push("repeat");
      }
      if (!filled.length) throw new HttpException("Nothing to fill in.", 400);
      ctx.fillForm(fill);
      return { applied: true, filled, note: "Already on screen in the form, which saves it as usual. Don't ask for approval." };
    },
    label: (_a, r) => `Filled in the form: ${(r as { filled: string[] }).filled.join(", ")}`,
  }),

  writeTool({
    name: "propose_create_tasks",
    description:
      "Propose creating one or more new tasks (e.g. from notes the user pasted). Each needs a title and a channel id from the " +
      "context block; assignee, due, priority and checklist subtasks are optional. Files an approval card.",
    input: z.object({
      tasks: z
        .array(
          z.object({
            title: z.string().min(1).max(200),
            channelId: z.string().uuid().describe("Channel (list) id from the context block or get_workspace."),
            assigneeUserId: z.string().optional(),
            due: z.string().regex(LOCAL_DT_RE).optional().describe("YYYY-MM-DDTHH:mm in the workspace time zone; must be in the future."),
            priority: z.enum(["high", "medium", "low"]).optional(),
            subtasks: z.array(z.string().min(1).max(200)).max(20).optional(),
          }),
        )
        .min(1)
        .max(10),
    }),
    run: async (ctx, a) => {
      const names = await ctx.names();
      const now = Date.now();
      const skipped: { taskId: string; reason: string }[] = [];
      const items: NewProposal["items"] = [];
      const payload: Record<string, unknown>[] = [];
      a.tasks.forEach((t, i) => {
        const channel = names.channels.get(t.channelId);
        const ref = `new task ${i + 1} (${t.title})`;
        if (!channel) return void skipped.push({ taskId: ref, reason: "unknown channel" });
        if (t.assigneeUserId && !names.people.has(t.assigneeUserId)) return void skipped.push({ taskId: ref, reason: "assignee isn't a member" });
        const due = t.due ? localToUtc(t.due, ctx.timeZone) : null;
        if (due && due.getTime() <= now) return void skipped.push({ taskId: ref, reason: "due date is in the past" });
        // The id is chosen now, so after approval the card links straight to the created task.
        const id = randomUUID();
        const bits = [
          `#${channel.name}`,
          t.assigneeUserId ? names.people.get(t.assigneeUserId)! : "Unassigned",
          due ? when(due, ctx.timeZone)! : "No due date",
          t.priority && t.priority !== "medium" ? `${t.priority} priority` : null,
          t.subtasks?.length ? plural(t.subtasks.length, "subtask") : null,
        ].filter(Boolean);
        items.push({ taskId: id, title: t.title, from: null, to: bits.join(" · ") });
        payload.push({
          id,
          title: t.title,
          listId: t.channelId,
          assigneeUserIds: t.assigneeUserId ? [t.assigneeUserId] : [],
          dueAt: due ? due.toISOString() : null,
          priority: t.priority,
          initialSubtasks: (t.subtasks ?? []).map((title) => ({ title })),
        });
      });
      return fileProposal(
        ctx,
        { kind: "create", summary: items.length === 1 ? "Create 1 task" : `Create ${items.length} tasks`, items, payload: { tasks: payload } },
        skipped,
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "propose_archive",
    description:
      "Propose archiving tasks. This is what deleting a task means in LogBase: it leaves the board and can be restored from " +
      "Archived. Permanent deletion isn't available from chat. Files an approval card.",
    input: z.object({ taskIds: z.array(z.string().uuid()).min(1).max(25) }),
    run: async (ctx, a) => {
      const found = await targets(ctx, a.taskIds, "archive");
      const skipped = found.filter((t) => !t.ok).map((t) => ({ taskId: t.id, reason: (t as { reason: string }).reason }));
      const ok = found.filter((t): t is Extract<Target, { ok: true }> => t.ok);
      const items = ok.map((t) => ({ taskId: t.id, title: t.title, from: STATUS_NAMES[t.status] ?? t.status, to: "Archived" }));
      return fileProposal(
        ctx,
        { kind: "archive", summary: items.length === 1 ? "Archive 1 task" : `Archive ${items.length} tasks`, items, payload: { taskIds: ok.map((t) => t.id) } },
        skipped,
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),

  writeTool({
    name: "propose_edit_task",
    description:
      "Propose editing one task: its title, priority, and checklist subtasks (add new ones, rename or remove existing ones — " +
      "get subtask ids from get_task). Files an approval card.",
    input: z.object({
      taskId: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
      addSubtasks: z.array(z.string().min(1).max(200)).max(20).optional(),
      renameSubtasks: z.array(z.object({ subtaskId: z.string().uuid(), title: z.string().min(1).max(200) })).max(20).optional(),
      removeSubtaskIds: z.array(z.string().uuid()).max(20).optional(),
    }),
    run: async (ctx, a) => {
      const [t] = await targets(ctx, [a.taskId], "edit");
      if (!t!.ok) return fileProposal(ctx, { kind: "edit", summary: "", items: [], payload: {} }, [{ taskId: a.taskId, reason: t!.reason }]);
      const detail = await ctx.services.tasks.getDetail(ctx.userId, a.taskId);
      const subtaskTitle = new Map(detail.subtasks.map((s) => [s.id, s.title]));
      const unknown = [...(a.renameSubtasks ?? []).map((r) => r.subtaskId), ...(a.removeSubtaskIds ?? [])].filter((id) => !subtaskTitle.has(id));
      if (unknown.length) throw new HttpException("Some subtask ids don't belong to this task; read it with get_task first.", 400);

      const changes: string[] = [];
      const before: string[] = [];
      if (a.title && a.title !== t!.title) {
        changes.push(`Title: “${a.title}”`);
        before.push(`Title: “${t!.title}”`);
      }
      const currentPriority = (detail.task as { priority?: string }).priority ?? "medium";
      if (a.priority && a.priority !== currentPriority) {
        changes.push(`Priority: ${a.priority}`);
        before.push(`Priority: ${currentPriority}`);
      }
      for (const title of a.addSubtasks ?? []) changes.push(`+ ${title}`);
      for (const r of a.renameSubtasks ?? []) changes.push(`“${subtaskTitle.get(r.subtaskId)}” → “${r.title}”`);
      for (const id of a.removeSubtaskIds ?? []) changes.push(`− ${subtaskTitle.get(id)}`);
      if (!changes.length) return fileProposal(ctx, { kind: "edit", summary: "", items: [], payload: {} }, [{ taskId: a.taskId, reason: "nothing would change" }]);

      return fileProposal(
        ctx,
        {
          kind: "edit",
          summary: `Edit “${t!.title.length > 40 ? `${t!.title.slice(0, 39)}…` : t!.title}”`,
          items: [{ taskId: t!.id, title: t!.title, from: before.length ? before.join(" · ") : null, to: changes.join("\n") }],
          payload: {
            taskId: t!.id,
            title: a.title && a.title !== t!.title ? a.title : undefined,
            priority: a.priority && a.priority !== currentPriority ? a.priority : undefined,
            addSubtasks: a.addSubtasks ?? [],
            renameSubtasks: a.renameSubtasks ?? [],
            removeSubtaskIds: a.removeSubtaskIds ?? [],
          },
        },
        [],
      );
    },
    label: (_a, r) => proposedLabel(r),
  }),
];

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
      "The workspace layout: categories (departments) and the channels (lists) inside each, with ids. Only needed when " +
      "the context block says the workspace is too large to list. " +
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
    description:
      "Members of this workspace with their userId and role. Only needed when the context block doesn't list people.",
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
        subtasks: d.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
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

AGENT_TOOLS.push(...WRITE_TOOLS);

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
    memo: new Map(),
    names: () =>
      (names ??= Promise.all([
        services.organizations.listMembers(userId, organizationId),
        services.lists.list(userId, organizationId),
        services.departments.list(userId, organizationId),
      ]).then(([members, lists, depts]) => ({
        people: new Map(members.map((m) => [m.userId, m.name])),
        roles: new Map(members.map((m) => [m.userId, m.role])),
        channels: new Map(lists.map((l) => [l.id, { name: l.name, categoryId: l.departmentId }])),
        categories: new Map(depts.map((d) => [d.id, d.name])),
      }))),
  };
}

export type ToolOutcome =
  | { ok: true; result: unknown; label: string; repeat?: boolean }
  | { ok: false; error: string; label: string; repeat?: boolean };

/**
 * Runs one tool call; a service's HTTP error (403, 404…) becomes `{ error }` the model can explain, not a crash.
 * An identical call already made this run returns the same result without touching the database again.
 */
export async function runAgentTool(ctx: AgentToolContext, name: string, rawArgs: unknown): Promise<ToolOutcome> {
  const t = AGENT_TOOLS_BY_NAME.get(name);
  if (!t) return { ok: false, error: `Unknown tool ${name}`, label: "Tried an unknown tool" };
  const parsed = t.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments: ${parsed.error.issues.map((i) => i.message).join("; ")}`, label: "Adjusted a lookup" };
  }
  const key = `${name}:${JSON.stringify(parsed.data)}`;
  const seen = ctx.memo.get(key);
  if (seen) return { ...(await seen), repeat: true };
  const outcome = (async (): Promise<ToolOutcome> => {
    try {
      const result = await t.run(ctx, parsed.data);
      return { ok: true, result, label: t.label(parsed.data, result) };
    } catch (err) {
      if (err instanceof HttpException) return { ok: false, error: err.message, label: "A lookup was not allowed" };
      throw err;
    }
  })();
  ctx.memo.set(key, outcome);
  return outcome;
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
