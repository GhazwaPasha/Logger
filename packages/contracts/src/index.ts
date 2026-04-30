import { z } from "zod";

export const orgRoleSchema = z.enum(["owner", "manager", "member"]);
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

export const taskPrioritySchema = z.enum(["high", "medium", "low"]);
/** Optional cadence after the due instant (no recurrence engine yet; stored for UX / future use). */
export const taskDueRepeatSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export type TaskDueRepeat = z.infer<typeof taskDueRepeatSchema>;
export const ledgerTypeSchema = z.enum(["ack", "note", "reschedule", "status_change", "archive"]);
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
    departmentId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "manager" && !data.departmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Managers must have a departmentId",
        path: ["departmentId"],
      });
    }
  });

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(256),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(256),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(512),
  listId: z.string().uuid(),
  assigneeUserIds: z.array(z.string().min(1)).optional().default([]),
  dueAt: z.string().datetime().optional().nullable(),
  /** Only meaningful when `dueAt` is set; ignored otherwise. */
  dueRepeat: taskDueRepeatSchema.nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
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
  status: taskStatusInputSchema,
});

export const patchTaskSchema = z
  .object({
    status: taskStatusInputSchema.optional(),
    priority: taskPrioritySchema.optional(),
    title: z.string().min(1).max(512).optional(),
    assigneeUserIds: z.array(z.string().min(1)).optional(),
    /** Same instant semantics as `POST …/reschedule`: ISO datetime or `null` to clear. Requires reschedule capability when changed. */
    dueAt: z.union([z.string().datetime(), z.null()]).optional(),
    dueRepeat: taskDueRepeatSchema.nullable().optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      d.priority !== undefined ||
      d.title !== undefined ||
      d.assigneeUserIds !== undefined ||
      d.dueAt !== undefined ||
      d.dueRepeat !== undefined,
    { message: "Provide at least one field to update" },
  );

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(512),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  done: z.boolean().optional(),
});

export const taskCapabilitiesSchema = z.object({
  canDeleteTask: z.boolean(),
  canReschedule: z.boolean(),
  canAppendLedger: z.boolean(),
});

export type AppendLedgerInput = z.infer<typeof appendLedgerSchema>;
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;
