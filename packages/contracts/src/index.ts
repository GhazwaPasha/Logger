import { z } from "zod";

export const orgRoleSchema = z.enum(["owner", "manager", "member"]);
/** Stages the client may set via create / PATCH / status endpoint. */
export const taskManualStatusSchema = z.enum(["pending", "in_progress", "done", "cancelled"]);

/** Full persisted enum (`assigned` / `late` are legacy only; API normalizes on read). */
export const taskStatusSchema = z.enum([
  "pending",
  "assigned",
  "in_progress",
  "done",
  "late",
  "cancelled",
]);

/** Accept legacy `open` from older clients and map to `pending`. */
export const taskStatusInputSchema = z
  .union([taskStatusSchema, z.literal("open")])
  .transform((s) => (s === "open" ? "pending" : s));

/** Manual stage input (API writes); `open` → `pending`. */
export const taskManualStatusInputSchema = z
  .union([taskManualStatusSchema, z.literal("open")])
  .transform((s) => (s === "open" ? "pending" : s));

export const taskPrioritySchema = z.enum(["high", "medium", "low"]);
/** Optional cadence after the due instant; marking **done** spawns the next task row (model B) when `dueAt` is set. */
export const taskDueRepeatSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export type TaskDueRepeat = z.infer<typeof taskDueRepeatSchema>;
export const ledgerTypeSchema = z.enum([
  "ack",
  "note",
  "reschedule",
  "status_change",
  "assignee_change",
  "archive",
]);
export const appendableLedgerTypeSchema = z.enum(["ack", "note", "status_change"]);

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(256),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(256),
});

/** Invite or upsert membership by email (owner-only). */
export const upsertOrganizationMemberSchema = z
  .object({
    email: z.string().email(),
    role: orgRoleSchema,
    /** Single level (legacy); ignored when `departmentIds` is non-empty. */
    departmentId: z.string().uuid().optional().nullable(),
    /** One or more levels for `manager`; preferred over `departmentId`. */
    departmentIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "manager") return;
    const raw =
      data.departmentIds && data.departmentIds.length > 0
        ? data.departmentIds
        : data.departmentId
          ? [data.departmentId]
          : [];
    if (raw.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Managers must have at least one level (departmentIds or departmentId)",
        path: ["departmentIds"],
      });
    }
  });

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(256),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(256),
});

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(512),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  done: z.boolean().optional(),
});

/** Max checklist lines accepted on create / PATCH in one request (server-enforced). */
export const MAX_SUBTASKS_PER_TASK_MUTATION = 100;

export const createTaskSchema = z.object({
  /** Client-generated UUID; server uses it as-is when provided. */
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(512),
  listId: z.string().uuid(),
  assigneeUserIds: z.array(z.string().min(1)).optional().default([]),
  dueAt: z.string().datetime().optional().nullable(),
  /** Only meaningful when `dueAt` is set; ignored otherwise. */
  dueRepeat: taskDueRepeatSchema.nullable().optional(),
  status: taskManualStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  /** Created in the same transaction as the task (single round-trip vs N POST subtasks). */
  initialSubtasks: z
    .array(createSubtaskSchema)
    .max(MAX_SUBTASKS_PER_TASK_MUTATION)
    .optional()
    .default([]),
});

export const createListSchema = z.object({
  name: z.string().min(1).max(256),
  departmentId: z.string().uuid(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(256),
});

export const appendLedgerSchema = z.object({
  type: appendableLedgerTypeSchema,
  payload: z.record(z.unknown()),
  clientMutationId: z.string().min(1).max(128).optional(),
});

export const rescheduleTaskSchema = z.object({
  /** ISO datetime or `null` to clear the due date. */
  newDueAt: z.union([z.string().datetime(), z.null()]),
  reason: z.string().min(1).max(4000),
});

export const updateTaskStatusSchema = z.object({
  status: taskManualStatusInputSchema,
});

export const patchTaskSchema = z
  .object({
    status: taskManualStatusInputSchema.optional(),
    priority: taskPrioritySchema.optional(),
    title: z.string().min(1).max(512).optional(),
    assigneeUserIds: z.array(z.string().min(1)).optional(),
    /** Same instant semantics as `POST …/reschedule`: ISO datetime or `null` to clear. Requires reschedule capability when changed. */
    dueAt: z.union([z.string().datetime(), z.null()]).optional(),
    dueRepeat: taskDueRepeatSchema.nullable().optional(),
    /** New checklist lines inserted in the same transaction as task field updates. */
    subtasksToCreate: z.array(createSubtaskSchema).max(MAX_SUBTASKS_PER_TASK_MUTATION).optional(),
    /** Existing subtask title edits applied in the same transaction. */
    subtasksToUpdate: z
      .array(z.object({ id: z.string().uuid(), title: z.string().min(1).max(512) }))
      .max(MAX_SUBTASKS_PER_TASK_MUTATION)
      .optional(),
    /** IDs of existing subtasks to delete in the same transaction. */
    subtasksToDelete: z.array(z.string().uuid()).max(MAX_SUBTASKS_PER_TASK_MUTATION).optional(),
  })
  .refine(
    (d) => {
      const hasSubCreate = (d.subtasksToCreate?.length ?? 0) > 0;
      const hasSubUpdate = (d.subtasksToUpdate?.length ?? 0) > 0;
      const hasSubDelete = (d.subtasksToDelete?.length ?? 0) > 0;
      return (
        d.status !== undefined ||
        d.priority !== undefined ||
        d.title !== undefined ||
        d.assigneeUserIds !== undefined ||
        d.dueAt !== undefined ||
        d.dueRepeat !== undefined ||
        hasSubCreate || hasSubUpdate || hasSubDelete
      );
    },
    { message: "Provide at least one field to update" },
  );

export const taskCapabilitiesSchema = z.object({
  canArchiveTask: z.boolean(),
  canDeleteTask: z.boolean(),
  canReschedule: z.boolean(),
  canAppendLedger: z.boolean(),
});

export const listTasksQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : undefined)),
  listId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  assigneeUserId: z.string().min(1).optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
  includeSubtasks: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type AppendLedgerInput = z.infer<typeof appendLedgerSchema>;
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;

export const createCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  parentCommentId: z.string().uuid().optional(),
});
export const editCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type EditCommentInput = z.infer<typeof editCommentSchema>;

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export const markAllNotificationsReadSchema = z.object({
  orgId: z.string().uuid(),
});
export const listNotificationsQuerySchema = z.object({
  orgId: z.string().uuid(),
  unreadOnly: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
