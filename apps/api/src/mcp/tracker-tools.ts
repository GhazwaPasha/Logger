import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TRACKER_TEMPLATES, type CreateTrackerInput, type UpdateTrackerInput } from "@work-ledger/contracts";
import { z } from "zod";
import { digestEntries, digestTracker, findMetric } from "../trackers/tracker-digest";
import type { McpServices } from "./mcp.server";

type Helpers = {
  registerTool: <Args>(
    server: McpServer,
    name: string,
    config: { description: string; inputSchema?: Record<string, z.ZodTypeAny> },
    handler: (args: Args) => Promise<unknown>,
  ) => void;
  runTool: <T>(fn: () => Promise<T>) => Promise<unknown>;
};

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const unit = z.enum(["count", "number", "currency", "percent"]);
const direction = z.enum(["at_least", "at_most"]);

/** A metric as an AI client describes it: by name, formulas referencing sibling metrics by name. */
const metricSpec = z.object({
  name: z.string().min(1).max(80),
  unit: unit.optional().describe("count (default), number, currency, or percent."),
  target: z.number().nonnegative().optional().describe("Whole-period target. Omit for calculated metrics — it is derived."),
  direction: direction.optional().describe("at_least (default; more is better) or at_most (less is better)."),
  currency: z.string().max(8).optional().describe("ISO code when unit is currency, e.g. PKR."),
  formula: z
    .object({
      op: z.enum(["div", "mul", "add", "sub"]),
      a: z.string().describe("Name of the first metric."),
      b: z.string().describe("Name of the second metric."),
      percent: z.boolean().optional(),
    })
    .optional()
    .describe("Makes this a calculated metric, e.g. { op: 'div', a: 'Revenue', b: 'Orders' } for average order size."),
});
type MetricSpec = z.infer<typeof metricSpec>;

/** Turns name-based metric specs into the API's id-based metrics. */
function toMetrics(specs: MetricSpec[]): CreateTrackerInput["metrics"] {
  const ids = new Map(specs.map((m) => [m.name.trim().toLowerCase(), randomUUID()]));
  const idOf = (name: string) => {
    const id = ids.get(name.trim().toLowerCase());
    if (!id) throw new BadRequestException(`Formula refers to "${name}", which isn't one of this tracker's metrics`);
    return id;
  };
  return specs.map((m) => ({
    id: ids.get(m.name.trim().toLowerCase())!,
    name: m.name.trim(),
    kind: m.formula ? ("formula" as const) : ("input" as const),
    unit: m.unit ?? "count",
    currency: m.currency ?? null,
    formula: m.formula ? { op: m.formula.op, a: idOf(m.formula.a), b: idOf(m.formula.b), percent: m.formula.percent } : null,
    target: m.formula ? null : (m.target ?? null),
    direction: m.direction ?? "at_least",
  }));
}

/**
 * Tracker tools for MCP clients. Reads and writes go through TrackersService, so the same permissions
 * apply as in the app: owners and managers set trackers up; the assignee (or a manager) logs progress.
 */
export function registerTrackerTools(server: McpServer, userId: string, services: McpServices, h: Helpers) {
  const memberNames = async (organizationId: string) =>
    new Map(
      (await services.organizations.listMembers(userId, organizationId)).map((m) => [m.userId, m.name || m.email] as const),
    );

  h.registerTool<{ organizationId: string; trackerId: string; recentLogs?: number }>(
    server,
    "get_tracker",
    {
      description:
        "One tracker in detail: status, every metric's value vs target and pace, and its most recent logs " +
        "(values keyed by metric name). Use get_trackers first to find the trackerId.",
      inputSchema: {
        organizationId: z.string().uuid(),
        trackerId: z.string().uuid(),
        recentLogs: z.number().int().min(0).max(60).optional().default(10),
      },
    },
    async ({ organizationId, trackerId, recentLogs }) =>
      h.runTool(async () => {
        const [detail, names] = await Promise.all([
          services.trackers.get(userId, organizationId, trackerId),
          memberNames(organizationId),
        ]);
        return { ...digestTracker(detail, names), today: detail.stats.today, recentLogs: digestEntries(detail, recentLogs ?? 10) };
      }),
  );

  h.registerTool<{
    organizationId: string;
    trackerId: string;
    date?: string;
    values: Record<string, number>;
    note?: string;
  }>(
    server,
    "log_tracker_progress",
    {
      description:
        "Log (or correct) a tracker's numbers for a day — or for a week on weekly trackers (any day in the week). " +
        "`values` maps metric names (or ids) to numbers, e.g. { \"Orders\": 3, \"Revenue\": 18400 }; calculated " +
        "metrics are worked out automatically. Logging the same day again replaces that day's numbers. " +
        "Only the tracker's assignee (or an owner/manager) can log.",
      inputSchema: {
        organizationId: z.string().uuid(),
        trackerId: z.string().uuid(),
        date: dateKey.optional().describe("YYYY-MM-DD in the workspace's time zone. Defaults to today."),
        values: z.record(z.string(), z.number().finite()),
        note: z.string().max(1000).optional(),
      },
    },
    async ({ organizationId, trackerId, date, values, note }) =>
      h.runTool(async () => {
        const current = await services.trackers.get(userId, organizationId, trackerId);
        const byId: Record<string, number> = {};
        const unknown: string[] = [];
        for (const [key, v] of Object.entries(values)) {
          const m = findMetric(current.metrics, key);
          if (!m) unknown.push(key);
          else if (m.kind === "formula") continue; // derived — ignore rather than fail
          else byId[m.id] = v;
        }
        if (unknown.length) {
          throw new BadRequestException(
            `Unknown metric${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}. This tracker logs: ${current.metrics
              .filter((m) => m.kind === "input")
              .map((m) => m.name)
              .join(", ")}`,
          );
        }
        const day = date ?? current.stats.today;
        const next = await services.trackers.upsertEntry(userId, organizationId, trackerId, day, { values: byId, note: note ?? null });
        const names = await memberNames(organizationId);
        return { logged: day, tracker: digestTracker(next, names) };
      }),
  );

  h.registerTool<{
    organizationId: string;
    name: string;
    assigneeUserId?: string;
    periodStart: string;
    periodEnd: string;
    template?: "sales" | "leads" | "clients";
    metrics?: MetricSpec[];
    targets?: Record<string, number>;
    split?: "day" | "week";
    logs?: "daily" | "weekly";
    workingDays?: number[];
    reminderTime?: string | null;
  }>(
    server,
    "create_tracker",
    {
      description:
        "Create a tracker: a set of number targets for ONE person over a period, logged daily or weekly. Owners and " +
        "managers only. Either pass `metrics` (by name; calculated ones via `formula`), or a `template` " +
        "(sales = Orders, Revenue, Avg order size; leads = Leads, Qualified, Qualify rate; clients = Clients signed, " +
        "Contract value, Avg contract) plus `targets` by metric name, e.g. { \"Revenue\": 600000, \"Orders\": 60 }. " +
        "Use list_members for assigneeUserId; leave it out to set the tracker up unassigned and assign it later.",
      inputSchema: {
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(120),
        assigneeUserId: z.string().min(1).optional(),
        periodStart: dateKey,
        periodEnd: dateKey,
        template: z.enum(["sales", "leads", "clients"]).optional(),
        metrics: z.array(metricSpec).min(1).max(12).optional(),
        targets: z.record(z.string(), z.number().nonnegative()).optional().describe("Targets by metric name; fills or overrides."),
        split: z.enum(["day", "week"]).optional().describe("Slice the target per working day (default) or per week."),
        logs: z.enum(["daily", "weekly"]).optional().describe("How often the person logs. Default daily."),
        workingDays: z.array(z.number().int().min(1).max(7)).optional().describe("ISO weekdays, 1 = Monday. Default every day (1–7)."),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional().describe("HH:mm local, or null for none. Default 18:00."),
      },
    },
    async (a) =>
      h.runTool(async () => {
        let specs: MetricSpec[] | undefined = a.metrics;
        if (!specs && a.template) {
          const t = TRACKER_TEMPLATES.find((x) => x.id === a.template)!;
          const nameOf = new Map(t.metrics.map((m) => [m.key, m.name]));
          specs = t.metrics.map((m) => ({
            name: m.name,
            unit: m.unit,
            formula: m.formula
              ? { op: m.formula.op, a: nameOf.get(m.formula.a)!, b: nameOf.get(m.formula.b)!, percent: m.formula.percent }
              : undefined,
          }));
        }
        if (!specs) throw new BadRequestException("Pass `metrics`, or a `template` with `targets`.");
        if (a.targets) {
          specs = specs.map((m) => {
            const hit = Object.entries(a.targets!).find(([k]) => k.trim().toLowerCase() === m.name.trim().toLowerCase());
            return hit ? { ...m, target: hit[1] } : m;
          });
        }
        const input: CreateTrackerInput = {
          name: a.name,
          assigneeId: a.assigneeUserId ?? null,
          periodStart: a.periodStart,
          periodEnd: a.periodEnd,
          split: a.split,
          checkIn: a.logs,
          workingDays: a.workingDays,
          reminderTime: a.reminderTime === undefined ? "18:00" : a.reminderTime,
          metrics: toMetrics(specs),
        };
        const created = await services.trackers.create(userId, a.organizationId, input);
        return digestTracker(created, await memberNames(a.organizationId));
      }),
  );

  h.registerTool<{
    organizationId: string;
    trackerId: string;
    name?: string;
    assigneeUserId?: string | null;
    periodStart?: string;
    periodEnd?: string;
    split?: "day" | "week";
    logs?: "daily" | "weekly";
    workingDays?: number[];
    reminderTime?: string | null;
    targets?: Record<string, number | null>;
    archived?: boolean;
  }>(
    server,
    "update_tracker",
    {
      description:
        "Change a tracker: rename, reassign (still one person), move the period, change how it's split or logged, " +
        "set the reminder, change targets by metric name ({ \"Revenue\": 750000 }; null clears a target), or archive " +
        "it (archived: true; false restores). Calculated targets update by themselves. Owners and managers only. " +
        "Logged numbers are kept.",
      inputSchema: {
        organizationId: z.string().uuid(),
        trackerId: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        assigneeUserId: z.string().min(1).nullable().optional().describe("null unassigns."),
        periodStart: dateKey.optional(),
        periodEnd: dateKey.optional(),
        split: z.enum(["day", "week"]).optional(),
        logs: z.enum(["daily", "weekly"]).optional(),
        workingDays: z.array(z.number().int().min(1).max(7)).optional(),
        reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
        targets: z.record(z.string(), z.number().nonnegative().nullable()).optional(),
        archived: z.boolean().optional(),
      },
    },
    async (a) =>
      h.runTool(async () => {
        const patch: UpdateTrackerInput = {
          name: a.name,
          assigneeId: a.assigneeUserId,
          periodStart: a.periodStart,
          periodEnd: a.periodEnd,
          split: a.split,
          checkIn: a.logs,
          workingDays: a.workingDays,
          reminderTime: a.reminderTime,
          archived: a.archived,
        };
        if (a.targets) {
          const current = await services.trackers.get(userId, a.organizationId, a.trackerId);
          const changes = new Map<string, number | null>();
          for (const [key, v] of Object.entries(a.targets)) {
            const m = findMetric(current.metrics, key);
            if (!m) throw new BadRequestException(`Unknown metric: ${key}`);
            if (m.kind === "formula") continue; // derived from the others
            changes.set(m.id, v);
          }
          patch.metrics = current.metrics.map((m) => ({
            id: m.id,
            name: m.name,
            kind: m.kind,
            unit: m.unit,
            currency: m.currency,
            formula: m.formula,
            target: changes.has(m.id) ? changes.get(m.id)! : m.target,
            direction: m.direction,
          }));
        }
        const updated = await services.trackers.update(userId, a.organizationId, a.trackerId, patch);
        return digestTracker(updated, await memberNames(a.organizationId));
      }),
  );
}
