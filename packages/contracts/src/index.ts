import { z } from "zod";

export const orgRoleSchema = z.enum(["owner", "manager", "member"]);
export const taskStatusSchema = z.enum(["open", "in_progress", "done"]);
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
  newDueAt: z.string().datetime(),
  reason: z.string().min(1).max(4000),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

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
