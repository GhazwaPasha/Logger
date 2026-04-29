import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { createDb } from "./index.js";
import {
  activityLedger,
  departments,
  organizationMembers,
  organizations,
  taskAssignees,
  tasks,
  user,
} from "./schema.js";

/**
 * Creates demo org/dept/task using the first two rows in `user` (from Better Auth sign-up).
 * Run after registering at least one user on the web app.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const db = createDb(databaseUrl);

  const users = await db.select().from(user).limit(2);
  if (users.length === 0) {
    console.error("No users in database. Sign up via the web app first, then re-run npm run db:seed.");
    process.exit(1);
  }

  const owner = users[0]!;
  const assignee = users[1] ?? users[0]!;

  let org = await db.select().from(organizations).limit(1);
  let orgId = org[0]?.id;
  if (!orgId) {
    const [created] = await db.insert(organizations).values({ name: "Acme Corp" }).returning();
    orgId = created.id;
  }

  const existingOwnerMember = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, owner.id),
      ),
    )
    .limit(1);

  if (existingOwnerMember.length === 0) {
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
    });
  }

  let deptRows = await db.select().from(departments).where(eq(departments.organizationId, orgId)).limit(1);
  let deptId = deptRows[0]?.id;
  if (!deptId) {
    const [dept] = await db
      .insert(departments)
      .values({ organizationId: orgId, name: "Operations" })
      .returning();
    deptId = dept.id;
  }

  if (assignee.id !== owner.id) {
    const existingAssigneeMember = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, assignee.id),
        ),
      )
      .limit(1);
    if (existingAssigneeMember.length === 0) {
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId: assignee.id,
        role: "member",
      });
    }
  }

  const existingTasks = await db.select().from(tasks).where(eq(tasks.organizationId, orgId)).limit(1);
  if (existingTasks.length > 0) {
    console.log("Seed skipped: tasks already exist for org", orgId);
    process.exit(0);
  }

  const [task] = await db
    .insert(tasks)
    .values({
      organizationId: orgId,
      departmentId: deptId,
      assignerId: owner.id,
      title: "Sample audit task",
      status: "open",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (assignee.id !== owner.id) {
    await db.insert(taskAssignees).values({ taskId: task.id, userId: assignee.id });
  }

  await db.insert(activityLedger).values({
    taskId: task.id,
    actorId: owner.id,
    type: "note",
    payload: { message: "Task created (seed)." },
  });

  console.log("Seed OK:", { orgId, deptId, taskId: task.id, ownerId: owner.id, assigneeId: assignee.id });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
