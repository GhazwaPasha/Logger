import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  createRoadmapItemSchema,
  generateRoadmapChildrenSchema,
  linkRoadmapTasksSchema,
  updateRoadmapItemSchema,
} from "@work-ledger/contracts";
import { roadmapItems, roadmapItemTasks, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";
import { DepartmentsService } from "../departments/departments.service";
import { CollaborationService } from "../realtime/collaboration.service";
import { computeMonths, computeQuarters, computeWeeks } from "./roadmap-period";

type RoadmapItemRow = typeof roadmapItems.$inferSelect;

const CHILD_PERIOD: Record<RoadmapItemRow["period"], RoadmapItemRow["period"] | null> = {
  yearly: "quarterly",
  quarterly: "monthly",
  monthly: "weekly",
  weekly: null,
};

@Injectable()
export class RoadmapService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
    private readonly departments: DepartmentsService,
    private readonly collaboration: CollaborationService,
  ) {}

  /** Owner: full write. Manager: write only within their managed level(s). Member: read-only. */
  private async assertCanWrite(userId: string, organizationId: string, departmentId: string | null) {
    const member = await this.authz.assertOrgMember(userId, organizationId);
    if (member.role === "owner") return;
    if (member.role === "manager" && departmentId) {
      const managed = await this.authz.managedDepartmentIdsForUser(userId, organizationId);
      if (managed.includes(departmentId)) return;
    }
    throw new ForbiddenException("No write access to this roadmap goal");
  }

  private async getItemOrThrow(organizationId: string, itemId: string): Promise<RoadmapItemRow> {
    const rows = await this.db
      .select()
      .from(roadmapItems)
      .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) throw new NotFoundException("Roadmap goal not found");
    return rows[0]!;
  }

  /** Full tree (flat, client assembles by parentId) + linked task ids + computed rollup progress. Readable by any org member. */
  async getTree(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);

    const items = await this.db
      .select()
      .from(roadmapItems)
      .where(eq(roadmapItems.organizationId, organizationId));

    const itemIds = items.map((i) => i.id);
    const links =
      itemIds.length === 0
        ? []
        : await this.db
            .select({
              roadmapItemId: roadmapItemTasks.roadmapItemId,
              taskId: roadmapItemTasks.taskId,
              status: tasks.status,
              deletedAt: tasks.deletedAt,
            })
            .from(roadmapItemTasks)
            .innerJoin(tasks, eq(roadmapItemTasks.taskId, tasks.id))
            .where(inArray(roadmapItemTasks.roadmapItemId, itemIds));

    const linkedTaskIdsByItem = new Map<string, string[]>();
    const ownCounts = new Map<string, { done: number; total: number }>();
    for (const l of links) {
      if (l.deletedAt) continue;
      const arr = linkedTaskIdsByItem.get(l.roadmapItemId);
      if (arr) arr.push(l.taskId);
      else linkedTaskIdsByItem.set(l.roadmapItemId, [l.taskId]);
      const c = ownCounts.get(l.roadmapItemId) ?? { done: 0, total: 0 };
      c.total += 1;
      if (l.status === "done") c.done += 1;
      ownCounts.set(l.roadmapItemId, c);
    }

    const childrenByParent = new Map<string, string[]>();
    for (const item of items) {
      if (!item.parentId) continue;
      const arr = childrenByParent.get(item.parentId);
      if (arr) arr.push(item.id);
      else childrenByParent.set(item.parentId, [item.id]);
    }

    const rollupCache = new Map<string, { done: number; total: number }>();
    function rollup(itemId: string): { done: number; total: number } {
      const cached = rollupCache.get(itemId);
      if (cached) return cached;
      const own = ownCounts.get(itemId) ?? { done: 0, total: 0 };
      let done = own.done;
      let total = own.total;
      for (const childId of childrenByParent.get(itemId) ?? []) {
        const c = rollup(childId);
        done += c.done;
        total += c.total;
      }
      const result = { done, total };
      rollupCache.set(itemId, result);
      return result;
    }

    return {
      items: items.map((item) => {
        const { done, total } = rollup(item.id);
        return {
          ...item,
          linkedTaskIds: linkedTaskIdsByItem.get(item.id) ?? [],
          progress: { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 },
        };
      }),
    };
  }

  async create(userId: string, organizationId: string, body: unknown) {
    const parsed = createRoadmapItemSchema.parse(body);
    await this.assertCanWrite(userId, organizationId, parsed.departmentId ?? null);

    if (parsed.departmentId) {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    }
    let parent: RoadmapItemRow | null = null;
    if (parsed.parentId) {
      parent = await this.getItemOrThrow(organizationId, parsed.parentId);
    }

    const [row] = await this.db
      .insert(roadmapItems)
      .values({
        organizationId,
        departmentId: parsed.departmentId ?? parent?.departmentId ?? null,
        parentId: parsed.parentId ?? null,
        period: parsed.period,
        title: parsed.title,
        description: parsed.description ?? null,
        periodStart: new Date(parsed.periodStart),
        periodEnd: new Date(parsed.periodEnd),
        ownerId: parsed.ownerId ?? null,
      })
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  async update(userId: string, organizationId: string, itemId: string, body: unknown) {
    const existing = await this.getItemOrThrow(organizationId, itemId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    const parsed = updateRoadmapItemSchema.parse(body);

    if (parsed.departmentId !== undefined && parsed.departmentId) {
      await this.departments.assertDeptInOrg(organizationId, parsed.departmentId);
    }
    if (parsed.parentId !== undefined && parsed.parentId === itemId) {
      throw new BadRequestException("A goal cannot be its own parent");
    }

    const [row] = await this.db
      .update(roadmapItems)
      .set({
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.parentId !== undefined ? { parentId: parsed.parentId } : {}),
        ...(parsed.departmentId !== undefined ? { departmentId: parsed.departmentId } : {}),
        ...(parsed.periodStart !== undefined ? { periodStart: new Date(parsed.periodStart) } : {}),
        ...(parsed.periodEnd !== undefined ? { periodEnd: new Date(parsed.periodEnd) } : {}),
        ...(parsed.ownerId !== undefined ? { ownerId: parsed.ownerId } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.orderIndex !== undefined ? { orderIndex: parsed.orderIndex } : {}),
      })
      .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.organizationId, organizationId)))
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return row!;
  }

  /** Cascades children + task links (FK). */
  async remove(userId: string, organizationId: string, itemId: string) {
    const existing = await this.getItemOrThrow(organizationId, itemId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    await this.db
      .delete(roadmapItems)
      .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.organizationId, organizationId)));
    this.collaboration.notifyOrgChanged(organizationId, null);
  }

  /** Auto-splits a year/quarter/month into its standard next-level children. */
  async generateChildren(userId: string, organizationId: string, itemId: string, body: unknown) {
    const existing = await this.getItemOrThrow(organizationId, itemId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    const parsed = generateRoadmapChildrenSchema.parse(body);

    const expected = CHILD_PERIOD[existing.period];
    if (!expected || expected !== parsed.childPeriod) {
      throw new BadRequestException(`A ${existing.period} goal can only generate ${expected ?? "no"} children`);
    }

    const specs =
      existing.period === "yearly"
        ? computeQuarters(existing.periodStart)
        : existing.period === "quarterly"
          ? computeMonths(existing.periodStart)
          : computeWeeks(existing.periodStart, existing.periodEnd);

    const rows = await this.db
      .insert(roadmapItems)
      .values(
        specs.map((s) => ({
          organizationId,
          departmentId: existing.departmentId,
          parentId: existing.id,
          period: parsed.childPeriod,
          title: s.title,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
        })),
      )
      .returning();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return rows;
  }

  async linkTasks(userId: string, organizationId: string, itemId: string, body: unknown) {
    const parsed = linkRoadmapTasksSchema.parse(body);

    // Independent reads — run concurrently instead of round-tripping to the DB one at a time.
    const [existing, taskRows] = await Promise.all([
      this.getItemOrThrow(organizationId, itemId),
      this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.id, parsed.taskIds), eq(tasks.organizationId, organizationId))),
    ]);
    if (taskRows.length !== parsed.taskIds.length) {
      throw new BadRequestException("One or more tasks do not belong to this organization");
    }
    await this.assertCanWrite(userId, organizationId, existing.departmentId);

    await this.db
      .insert(roadmapItemTasks)
      .values(parsed.taskIds.map((taskId) => ({ roadmapItemId: itemId, taskId })))
      .onConflictDoNothing();
    this.collaboration.notifyOrgChanged(organizationId, null);
    return { linkedTaskIds: parsed.taskIds };
  }

  async unlinkTask(userId: string, organizationId: string, itemId: string, taskId: string) {
    const existing = await this.getItemOrThrow(organizationId, itemId);
    await this.assertCanWrite(userId, organizationId, existing.departmentId);
    await this.db
      .delete(roadmapItemTasks)
      .where(and(eq(roadmapItemTasks.roadmapItemId, itemId), eq(roadmapItemTasks.taskId, taskId)));
    this.collaboration.notifyOrgChanged(organizationId, null);
  }
}
