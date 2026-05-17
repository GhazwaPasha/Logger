import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import { AuthorizationService } from "../authorization/authorization.service";

export type SearchTaskResult = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  listId: string;
};

@Injectable()
export class SearchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: AppDatabase,
    private readonly authz: AuthorizationService,
  ) {}

  async search(userId: string, organizationId: string, query: string): Promise<SearchTaskResult[]> {
    const taskIds = await this.authz.listTaskIdsForUser(userId, organizationId);
    if (taskIds.length === 0) return [];

    const trimmed = query.trim();
    const rows = await this.db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        listId: tasks.listId,
      })
      .from(tasks)
      .where(
        and(
          inArray(tasks.id, taskIds),
          isNull(tasks.deletedAt),
          sql`(
            ${tasks.title} ilike ${"%" + trimmed + "%"}
            OR (
              length(${trimmed}) >= 3
              AND ${tasks.title} @@ plainto_tsquery('english', ${trimmed})
            )
          )`,
        ),
      )
      .limit(20);

    return rows;
  }
}
