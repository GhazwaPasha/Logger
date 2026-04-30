"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskCapabilitiesSchema = exports.updateSubtaskSchema = exports.createSubtaskSchema = exports.patchTaskSchema = exports.updateTaskStatusSchema = exports.rescheduleTaskSchema = exports.appendLedgerSchema = exports.updateListSchema = exports.createListSchema = exports.createTaskSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = exports.upsertOrganizationMemberSchema = exports.updateOrganizationSchema = exports.createOrganizationSchema = exports.appendableLedgerTypeSchema = exports.ledgerTypeSchema = exports.taskDueRepeatSchema = exports.taskPrioritySchema = exports.taskStatusInputSchema = exports.taskStatusSchema = exports.orgRoleSchema = void 0;
const zod_1 = require("zod");
exports.orgRoleSchema = zod_1.z.enum(["owner", "manager", "member"]);
exports.taskStatusSchema = zod_1.z.enum([
    "pending",
    "assigned",
    "in_progress",
    "done",
    "late",
    "cancelled",
]);
/** Accept legacy `open` from older clients and map to `pending`. */
exports.taskStatusInputSchema = zod_1.z
    .union([exports.taskStatusSchema, zod_1.z.literal("open")])
    .transform((s) => (s === "open" ? "pending" : s));
exports.taskPrioritySchema = zod_1.z.enum(["high", "medium", "low"]);
/** Optional cadence after the due instant (no recurrence engine yet; stored for UX / future use). */
exports.taskDueRepeatSchema = zod_1.z.enum(["daily", "weekly", "monthly", "yearly"]);
exports.ledgerTypeSchema = zod_1.z.enum(["ack", "note", "reschedule", "status_change", "archive"]);
exports.appendableLedgerTypeSchema = zod_1.z.enum(["ack", "note", "status_change"]);
exports.createOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.updateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
/** Invite or upsert membership by email (owner-only). */
exports.upsertOrganizationMemberSchema = zod_1.z
    .object({
    email: zod_1.z.string().email(),
    role: exports.orgRoleSchema,
    departmentId: zod_1.z.string().uuid().optional().nullable(),
})
    .superRefine((data, ctx) => {
    if (data.role === "manager" && !data.departmentId) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Managers must have a departmentId",
            path: ["departmentId"],
        });
    }
});
exports.createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.updateDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    listId: zod_1.z.string().uuid(),
    assigneeUserIds: zod_1.z.array(zod_1.z.string().min(1)).optional().default([]),
    dueAt: zod_1.z.string().datetime().optional().nullable(),
    /** Only meaningful when `dueAt` is set; ignored otherwise. */
    dueRepeat: exports.taskDueRepeatSchema.nullable().optional(),
    status: exports.taskStatusSchema.optional(),
    priority: exports.taskPrioritySchema.optional(),
});
exports.createListSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
    departmentId: zod_1.z.string().uuid(),
});
exports.updateListSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.appendLedgerSchema = zod_1.z.object({
    type: exports.appendableLedgerTypeSchema,
    payload: zod_1.z.record(zod_1.z.unknown()),
    clientMutationId: zod_1.z.string().min(1).max(128).optional(),
});
exports.rescheduleTaskSchema = zod_1.z.object({
    /** ISO datetime or `null` to clear the due date. */
    newDueAt: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.null()]),
    reason: zod_1.z.string().min(1).max(4000),
});
exports.updateTaskStatusSchema = zod_1.z.object({
    status: exports.taskStatusInputSchema,
});
exports.patchTaskSchema = zod_1.z
    .object({
    status: exports.taskStatusInputSchema.optional(),
    priority: exports.taskPrioritySchema.optional(),
    title: zod_1.z.string().min(1).max(512).optional(),
    assigneeUserIds: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    /** Same instant semantics as `POST …/reschedule`: ISO datetime or `null` to clear. Requires reschedule capability when changed. */
    dueAt: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.null()]).optional(),
    dueRepeat: exports.taskDueRepeatSchema.nullable().optional(),
})
    .refine((d) => d.status !== undefined ||
    d.priority !== undefined ||
    d.title !== undefined ||
    d.assigneeUserIds !== undefined ||
    d.dueAt !== undefined ||
    d.dueRepeat !== undefined, { message: "Provide at least one field to update" });
exports.createSubtaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
});
exports.updateSubtaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512).optional(),
    done: zod_1.z.boolean().optional(),
});
exports.taskCapabilitiesSchema = zod_1.z.object({
    canDeleteTask: zod_1.z.boolean(),
    canReschedule: zod_1.z.boolean(),
    canAppendLedger: zod_1.z.boolean(),
});
