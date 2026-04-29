import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { tasks } from "@work-ledger/db";
import type { AppDatabase } from "@work-ledger/db";
import { DRIZZLE } from "../db/drizzle.constants";
import type { RequestUser } from "../auth/jwt-auth.guard";

@Injectable()
export class AssignerOnlyGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: AppDatabase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user: RequestUser; params: { taskId: string } }>();
    const userId = req.user.id;
    const taskId = req.params.taskId;
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    const task = rows[0];
    if (!task) throw new NotFoundException("Task not found");
    if (task.deletedAt) throw new ForbiddenException("Task already archived");
    if (task.assignerId !== userId) {
      throw new ForbiddenException("Only the task assigner can archive this task");
    }
    return true;
  }
}
