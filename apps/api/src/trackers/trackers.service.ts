import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  addDaysToKey,
  applyTrackerFormula,
  computeTrackerStats,
  createTrackerSchema,
  formatZonedDateKey,
  isoWeekday,
  trackerSlotKey,
  updateTrackerSchema,
  upsertTrackerEntrySchema,
  type TrackerDetail,
  type TrackerEntry,
  type TrackerMetric,
  type TrackerRow,
  type TrackerSummary,
} from "@work-ledger/contracts";
import { organizations, trackerEntries, trackerEntryValues, trackerMetrics, trackers } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { CollaborationService } from "../realtime/collaboration.service";

type TrackerDbRow = typeof trackers.$inferSelect;
type MetricDbRow = typeof trackerMetrics.$inferSelect;
type Detail = TrackerDetail & { canManage: boolean };

/** Workspace time zones change rarely; caching them saves a round trip on every request. */
const TZ_TTL_MS = 10 * 60_000;

/**
 * Trackers: one assignee per tracker, targets on its metrics, progress logged by the assignee.
 * Owners and managers set trackers up and see all of them; members see the ones assigned to them.
 *
 * Latency matters here (the assignee logs every day), so each request runs its independent lookups
 * in parallel, writes in as few statements as possible, and answers from data it already holds.
 */
@Injectable()
export class TrackersService {
  private readonly tzCache = new Map<string, { tz: string; at: number }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly collaboration: CollaborationService,
  ) {}

  /* ───────────── access ───────────── */

  /** Membership is cached by AuthorizationService, so this is usually free. */
  private async role(userId: string, organizationId: string) {
    const m = await this.authz.assertOrgMember(userId, organizationId);
    return { canManage: m.role === "owner" || m.role === "manager" };
  }

  private async assertCanManage(userId: string, organizationId: string) {
    const { canManage } = await this.role(userId, organizationId);
    if (!canManage) throw new ForbiddenException("Only owners and managers can set up trackers");
  }

  private async findTracker(organizationId: string, trackerId: string): Promise<TrackerDbRow> {
    const [row] = await this.db
      .select()
      .from(trackers)
      .where(and(eq(trackers.id, trackerId), eq(trackers.organizationId, organizationId)))
      .limit(1);
    if (!row) throw new NotFoundException("Tracker not found");
    return row;
  }

  /** Managers see everything; anyone else only their own tracker (a 404, not a 403, for the rest). */
  private assertCanView(canManage: boolean, userId: string, t: TrackerDbRow) {
    if (!canManage && t.assigneeId !== userId) throw new NotFoundException("Tracker not found");
  }

  private async assertAssigneeIsMember(organizationId: string, assigneeId: string) {
    const m = await this.authz.findMembership(assigneeId, organizationId);
    if (!m) throw new BadRequestException("The assignee isn't a member of this workspace");
  }

  private async todayKey(organizationId: string): Promise<string> {
    const hit = this.tzCache.get(organizationId);
    let tz = hit && Date.now() - hit.at < TZ_TTL_MS ? hit.tz : null;
    if (!tz) {
      const [org] = await this.db
        .select({ timeZone: organizations.timeZone })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      tz = org?.timeZone ?? "UTC";
      this.tzCache.set(organizationId, { tz, at: Date.now() });
    }
    return formatZonedDateKey(new Date(), tz);
  }

  /* ───────────── reads ───────────── */

  private toRow(t: TrackerDbRow): TrackerRow {
    return {
      id: t.id,
      organizationId: t.organizationId,
      name: t.name,
      assigneeId: t.assigneeId,
      createdBy: t.createdBy,
      periodStart: t.periodStart,
      periodEnd: t.periodEnd,
      split: t.split === "week" ? "week" : "day",
      checkIn: t.checkIn === "weekly" ? "weekly" : "daily",
      workingDays: t.workingDays,
      reminderTime: t.reminderTime,
      archivedAt: t.archivedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toMetric(m: MetricDbRow): TrackerMetric {
    return {
      id: m.id,
      name: m.name,
      kind: m.kind === "formula" ? "formula" : "input",
      unit: (["count", "number", "currency", "percent"].includes(m.unit) ? m.unit : "count") as TrackerMetric["unit"],
      currency: m.currency,
      formula: m.formula ?? null,
      target: m.target,
      direction: m.direction === "at_most" ? "at_most" : "at_least",
      orderIndex: m.orderIndex,
    };
  }

  /** Metrics and entries (with their values) for many trackers: two queries, run side by side. */
  private async loadParts(trackerIds: string[]) {
    const metricsBy = new Map<string, TrackerMetric[]>();
    const entriesBy = new Map<string, TrackerEntry[]>();
    if (trackerIds.length === 0) return { metricsBy, entriesBy };

    const [metricRows, entryRows] = await Promise.all([
      this.db
        .select()
        .from(trackerMetrics)
        .where(inArray(trackerMetrics.trackerId, trackerIds))
        .orderBy(asc(trackerMetrics.orderIndex)),
      this.db
        .select({
          id: trackerEntries.id,
          trackerId: trackerEntries.trackerId,
          entryDate: trackerEntries.entryDate,
          userId: trackerEntries.userId,
          note: trackerEntries.note,
          updatedAt: trackerEntries.updatedAt,
          metricId: trackerEntryValues.metricId,
          value: trackerEntryValues.value,
        })
        .from(trackerEntries)
        .leftJoin(trackerEntryValues, eq(trackerEntryValues.entryId, trackerEntries.id))
        .where(inArray(trackerEntries.trackerId, trackerIds))
        .orderBy(desc(trackerEntries.entryDate)),
    ]);

    for (const m of metricRows) {
      const arr = metricsBy.get(m.trackerId) ?? [];
      arr.push(this.toMetric(m));
      metricsBy.set(m.trackerId, arr);
    }
    const byId = new Map<string, TrackerEntry>();
    for (const r of entryRows) {
      let e = byId.get(r.id);
      if (!e) {
        e = { id: r.id, entryDate: r.entryDate, userId: r.userId, note: r.note, values: {}, updatedAt: r.updatedAt.toISOString() };
        byId.set(r.id, e);
        const arr = entriesBy.get(r.trackerId) ?? [];
        arr.push(e);
        entriesBy.set(r.trackerId, arr);
      }
      if (r.metricId != null && r.value != null) e.values[r.metricId] = r.value;
    }
    return { metricsBy, entriesBy };
  }

  private summarize(t: TrackerDbRow, metrics: TrackerMetric[], entries: TrackerEntry[], today: string): TrackerSummary {
    const row = this.toRow(t);
    const stats = computeTrackerStats(row, metrics, entries, today);
    const dueEntry = stats.dueKey ? (entries.find((e) => e.entryDate === stats.dueKey) ?? null) : null;
    return { ...row, metrics, stats, dueEntry };
  }

  private detail(t: TrackerDbRow, metrics: TrackerMetric[], entries: TrackerEntry[], today: string, canManage: boolean): Detail {
    return { ...this.summarize(t, metrics, entries, today), entries, canManage };
  }

  /** Re-read metrics + entries for one tracker we already hold, and answer with its detail. */
  private async freshDetail(t: TrackerDbRow, today: string, canManage: boolean): Promise<Detail> {
    const { metricsBy, entriesBy } = await this.loadParts([t.id]);
    return this.detail(t, metricsBy.get(t.id) ?? [], entriesBy.get(t.id) ?? [], today, canManage);
  }

  /** `scope=mine` → trackers assigned to the caller; `all` → every tracker (managers only; members fall back to mine). */
  async list(userId: string, organizationId: string, opts: { scope?: string; archived?: boolean }) {
    const [{ canManage }, today] = await Promise.all([this.role(userId, organizationId), this.todayKey(organizationId)]);
    const mine = opts.scope === "mine" || !canManage;
    const rows = await this.db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.organizationId, organizationId),
          mine ? eq(trackers.assigneeId, userId) : undefined,
          opts.archived ? undefined : isNull(trackers.archivedAt),
        ),
      )
      .orderBy(asc(trackers.name))
      .limit(500);
    const { metricsBy, entriesBy } = await this.loadParts(rows.map((r) => r.id));
    return {
      today,
      canManage,
      trackers: rows.map((t) => this.summarize(t, metricsBy.get(t.id) ?? [], entriesBy.get(t.id) ?? [], today)),
    };
  }

  async get(userId: string, organizationId: string, trackerId: string): Promise<Detail> {
    const [t, { canManage }, today, parts] = await Promise.all([
      this.findTracker(organizationId, trackerId),
      this.role(userId, organizationId),
      this.todayKey(organizationId),
      this.loadParts([trackerId]),
    ]);
    this.assertCanView(canManage, userId, t);
    return this.detail(t, parts.metricsBy.get(t.id) ?? [], parts.entriesBy.get(t.id) ?? [], today, canManage);
  }

  /* ───────────── writes ───────────── */

  async create(userId: string, organizationId: string, body: unknown): Promise<Detail> {
    const p = createTrackerSchema.parse(body);
    const [, , today] = await Promise.all([
      this.assertCanManage(userId, organizationId),
      p.assigneeId ? this.assertAssigneeIsMember(organizationId, p.assigneeId) : Promise.resolve(),
      this.todayKey(organizationId),
    ]);

    const { row, metricRows } = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(trackers)
        .values({
          organizationId,
          name: p.name,
          assigneeId: p.assigneeId ?? null,
          createdBy: userId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          split: p.split,
          checkIn: p.checkIn,
          workingDays: p.workingDays,
          reminderTime: p.reminderTime ?? null,
        })
        .returning();
      const metricRows = await tx
        .insert(trackerMetrics)
        .values(p.metrics.map((m, i) => ({ ...metricValues(m, i, p.metrics), id: m.id, trackerId: row!.id })))
        .returning();
      return { row: row!, metricRows };
    });
    this.collaboration.notifyOrgChanged(organizationId);
    // Brand new: no entries yet, so the answer needs no further reads.
    return this.detail(row, metricRows.map((m) => this.toMetric(m)), [], today, true);
  }

  async update(userId: string, organizationId: string, trackerId: string, body: unknown): Promise<Detail> {
    const p = updateTrackerSchema.parse(body);
    const [, existing, today] = await Promise.all([
      this.assertCanManage(userId, organizationId),
      this.findTracker(organizationId, trackerId),
      this.todayKey(organizationId),
      p.assigneeId ? this.assertAssigneeIsMember(organizationId, p.assigneeId) : Promise.resolve(),
    ]);
    const start = p.periodStart ?? existing.periodStart;
    const end = p.periodEnd ?? existing.periodEnd;
    if (end < start) throw new BadRequestException("The period ends before it starts");

    const row = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(trackers)
        .set({
          ...(p.name !== undefined ? { name: p.name } : {}),
          ...(p.assigneeId !== undefined ? { assigneeId: p.assigneeId } : {}),
          ...(p.periodStart !== undefined ? { periodStart: p.periodStart } : {}),
          ...(p.periodEnd !== undefined ? { periodEnd: p.periodEnd } : {}),
          ...(p.split !== undefined ? { split: p.split } : {}),
          ...(p.checkIn !== undefined ? { checkIn: p.checkIn } : {}),
          ...(p.workingDays !== undefined ? { workingDays: p.workingDays } : {}),
          ...(p.reminderTime !== undefined ? { reminderTime: p.reminderTime } : {}),
          ...(p.archived !== undefined ? { archivedAt: p.archived ? new Date() : null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(trackers.id, trackerId))
        .returning();

      if (p.metrics) {
        const keep = p.metrics.map((m) => m.id);
        // Metrics left out are removed (their logged values go with them); the rest upsert in one statement.
        await tx.delete(trackerMetrics).where(and(eq(trackerMetrics.trackerId, trackerId), notInArray(trackerMetrics.id, keep)));
        await tx
          .insert(trackerMetrics)
          .values(p.metrics.map((m, i) => ({ ...metricValues(m, i, p.metrics!), id: m.id, trackerId })))
          .onConflictDoUpdate({
            target: trackerMetrics.id,
            set: {
              name: sql`excluded.name`,
              kind: sql`excluded.kind`,
              unit: sql`excluded.unit`,
              currency: sql`excluded.currency`,
              formula: sql`excluded.formula`,
              target: sql`excluded.target`,
              direction: sql`excluded.direction`,
              orderIndex: sql`excluded.order_index`,
            },
            // Never let a metric id from another tracker be taken over.
            setWhere: eq(trackerMetrics.trackerId, trackerId),
          });
      }
      return row!;
    });
    this.collaboration.notifyOrgChanged(organizationId);
    return this.freshDetail(row, today, true);
  }

  async remove(userId: string, organizationId: string, trackerId: string) {
    await Promise.all([this.assertCanManage(userId, organizationId), this.findTracker(organizationId, trackerId)]);
    await this.db.delete(trackers).where(eq(trackers.id, trackerId));
    this.collaboration.notifyOrgChanged(organizationId);
    return { ok: true };
  }

  /**
   * Log (or correct) progress for the slot containing `date` — the day, or the week's Monday.
   * The assignee logs; owners and managers may correct.
   */
  async upsertEntry(userId: string, organizationId: string, trackerId: string, date: string, body: unknown): Promise<Detail> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException("Use a YYYY-MM-DD date");
    const p = upsertTrackerEntrySchema.parse(body);
    const [t, { canManage }, today, inputRows] = await Promise.all([
      this.findTracker(organizationId, trackerId),
      this.role(userId, organizationId),
      this.todayKey(organizationId),
      this.db
        .select({ id: trackerMetrics.id })
        .from(trackerMetrics)
        .where(and(eq(trackerMetrics.trackerId, trackerId), eq(trackerMetrics.kind, "input"))),
    ]);
    this.assertCanView(canManage, userId, t);
    if (!canManage && t.assigneeId !== userId) throw new ForbiddenException("Only the assignee can log progress");
    // Nobody to log for yet — a manager could log, but the numbers would belong to no one.
    if (!t.assigneeId) throw new BadRequestException("Assign this tracker to someone before logging progress");
    if (t.archivedAt) throw new BadRequestException("This tracker is archived");
    if (date > today) throw new BadRequestException("You can't log a future date");
    const checkIn = t.checkIn === "weekly" ? "weekly" : "daily";
    if (checkIn === "daily" && !t.workingDays.includes(isoWeekday(date))) {
      throw new BadRequestException("That day isn't a working day for this tracker");
    }
    const slot = trackerSlotKey(checkIn, date);
    // A weekly slot counts if any day of its week falls inside the period.
    const slotLastDay = checkIn === "weekly" ? addDaysToKey(slot, 6) : slot;
    if (slotLastDay < t.periodStart || slot > t.periodEnd) throw new BadRequestException("That date is outside the tracker's period");

    const inputIds = new Set(inputRows.map((m) => m.id));
    const values = Object.entries(p.values).filter(([id]) => inputIds.has(id));
    if (values.length === 0) throw new BadRequestException("Enter at least one number");
    const ids = sql.join(values.map(([id]) => sql`${id}`), sql`, `);
    const nums = sql.join(values.map(([, v]) => sql`${v}`), sql`, `);

    // One statement: upsert the entry, drop values for metrics left blank, upsert the rest.
    await this.db.execute(sql`
      WITH e AS (
        INSERT INTO tracker_entries (tracker_id, user_id, entry_date, note)
        VALUES (${trackerId}, ${userId}, ${slot}, ${p.note ?? null})
        ON CONFLICT (tracker_id, entry_date) DO UPDATE SET note = EXCLUDED.note, updated_at = now()
        RETURNING id
      ), dropped AS (
        DELETE FROM tracker_entry_values v USING e
        WHERE v.entry_id = e.id AND NOT (v.metric_id = ANY (ARRAY[${ids}]::uuid[]))
      )
      INSERT INTO tracker_entry_values (entry_id, metric_id, value)
      SELECT e.id, x.metric_id, x.value
      FROM e, unnest(ARRAY[${ids}]::uuid[], ARRAY[${nums}]::float8[]) AS x(metric_id, value)
      ON CONFLICT (entry_id, metric_id) DO UPDATE SET value = EXCLUDED.value
    `);
    this.collaboration.notifyOrgChanged(organizationId);
    return this.freshDetail(t, today, canManage);
  }

  async deleteEntry(userId: string, organizationId: string, trackerId: string, date: string): Promise<Detail> {
    const [t, { canManage }, today] = await Promise.all([
      this.findTracker(organizationId, trackerId),
      this.role(userId, organizationId),
      this.todayKey(organizationId),
    ]);
    this.assertCanView(canManage, userId, t);
    if (!canManage && t.assigneeId !== userId) throw new ForbiddenException("Only the assignee can change logs");
    const slot = trackerSlotKey(t.checkIn === "weekly" ? "weekly" : "daily", date);
    await this.db.delete(trackerEntries).where(and(eq(trackerEntries.trackerId, trackerId), eq(trackerEntries.entryDate, slot)));
    this.collaboration.notifyOrgChanged(organizationId);
    return this.freshDetail(t, today, canManage);
  }
}

type MetricInput = {
  id: string;
  name: string;
  kind: "input" | "formula";
  unit: TrackerMetric["unit"];
  currency?: string | null;
  formula?: TrackerMetric["formula"] | null;
  target?: number | null;
  direction: TrackerMetric["direction"];
};

function metricValues(m: MetricInput, i: number, all: MetricInput[]) {
  return {
    name: m.name,
    kind: m.kind,
    unit: m.unit,
    currency: m.unit === "currency" ? (m.currency ?? null) : null,
    formula: m.kind === "formula" ? (m.formula ?? null) : null,
    target: targetOf(m, all),
    direction: m.direction,
    orderIndex: i,
  };
}

/**
 * A calculated metric's target is derived from its inputs' targets (600,000 revenue ÷ 60 orders →
 * 10,000 average order size), never typed — so it can't drift out of step with them.
 */
function targetOf(m: MetricInput, all: MetricInput[]): number | null {
  if (m.kind !== "formula") return m.target ?? null;
  if (!m.formula) return null;
  const a = all.find((x) => x.id === m.formula!.a)?.target;
  const b = all.find((x) => x.id === m.formula!.b)?.target;
  if (a == null || b == null) return null;
  const v = applyTrackerFormula(m.formula, a, b);
  return v != null && Number.isFinite(v) ? v : null;
}
