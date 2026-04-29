import { z } from "zod";

export const orgRoleSchema = z.enum(["owner", "manager", "member"]);
export const taskStatusSchema = z.enum(["open", "in_progress", "done"]);
export const ledgerTypeSchema = z.enum(["ack", "note", "reschedule", "status_change", "archive"]);
export const appendableLedgerTypeSchema = z.enum(["ack", "note", "status_change"]);

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(256),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(256),
});

export const createTaskSchema = z.object({
  title: z.string().min(1).max(512),
  departmentId: z.string().uuid(),
  assigneeUserIds: z.array(z.string().min(1)).optional().default([]),
  dueAt: z.string().datetime().optional().nullable(),
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

export const taskCapabilitiesSchema = z.object({
  canDeleteTask: z.boolean(),
  canReschedule: z.boolean(),
  canAppendLedger: z.boolean(),
});

export type AppendLedgerInput = z.infer<typeof appendLedgerSchema>;
export type RescheduleTaskInput = z.infer<typeof rescheduleTaskSchema>;
