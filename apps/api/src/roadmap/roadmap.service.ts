import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { goals, milestoneTasks, milestones, tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

@Injectable()
export class RoadmapService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  /** Combined goal + milestone tree with rollup progress computed server-side. Readable by any org member. */
  async getTree(userId: string, organizationId: string) {
    await this.authz.assertOrgMember(userId, organizationId);

    const [goalRows, milestoneRows] = await Promise.all([
      this.db.select().from(goals).where(eq(goals.organizationId, organizationId)),
      this.db.select().from(milestones).where(eq(milestones.organizationId, organizationId)),
    ]);

    const milestoneIds = milestoneRows.map((m) => m.id);
    const links =
      milestoneIds.length === 0
        ? []
        : await this.db
            .select({
              milestoneId: milestoneTasks.milestoneId,
              taskId: milestoneTasks.taskId,
              status: tasks.status,
              deletedAt: tasks.deletedAt,
            })
            .from(milestoneTasks)
            .innerJoin(tasks, eq(milestoneTasks.taskId, tasks.id))
            .where(inArray(milestoneTasks.milestoneId, milestoneIds));

    const linkedTaskIdsByMilestone = new Map<string, string[]>();
    const ownCounts = new Map<string, { done: number; total: number }>();
    for (const l of links) {
      if (l.deletedAt) continue;
      const arr = linkedTaskIdsByMilestone.get(l.milestoneId);
      if (arr) arr.push(l.taskId);
      else linkedTaskIdsByMilestone.set(l.milestoneId, [l.taskId]);
      const c = ownCounts.get(l.milestoneId) ?? { done: 0, total: 0 };
      c.total += 1;
      if (l.status === "done") c.done += 1;
      ownCounts.set(l.milestoneId, c);
    }

    const childrenByParent = new Map<string, string[]>();
    for (const m of milestoneRows) {
      if (!m.parentId) continue;
      const arr = childrenByParent.get(m.parentId);
      if (arr) arr.push(m.id);
      else childrenByParent.set(m.parentId, [m.id]);
    }

    const rollupCache = new Map<string, { done: number; total: number }>();
    function rollup(milestoneId: string): { done: number; total: number } {
      const cached = rollupCache.get(milestoneId);
      if (cached) return cached;
      const own = ownCounts.get(milestoneId) ?? { done: 0, total: 0 };
      let done = own.done;
      let total = own.total;
      for (const childId of childrenByParent.get(milestoneId) ?? []) {
        const c = rollup(childId);
        done += c.done;
        total += c.total;
      }
      const result = { done, total };
      rollupCache.set(milestoneId, result);
      return result;
    }

    // Sum only root milestones per goal — a root's rollup already recursively includes its whole subtree.
    const goalRollup = new Map<string, { done: number; total: number }>();
    for (const m of milestoneRows) {
      if (m.parentId) continue;
      const c = rollup(m.id);
      const g = goalRollup.get(m.goalId) ?? { done: 0, total: 0 };
      g.done += c.done;
      g.total += c.total;
      goalRollup.set(m.goalId, g);
    }

    return {
      goals: goalRows.map((g) => {
        const { done, total } = goalRollup.get(g.id) ?? { done: 0, total: 0 };
        return { ...g, progress: { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 } };
      }),
      milestones: milestoneRows.map((m) => {
        const { done, total } = rollup(m.id);
        return {
          ...m,
          linkedTaskIds: linkedTaskIdsByMilestone.get(m.id) ?? [],
          progress: { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 },
        };
      }),
    };
  }
}
