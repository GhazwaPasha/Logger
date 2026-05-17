"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotificationsQuerySchema = exports.markAllNotificationsReadSchema = exports.markNotificationsReadSchema = exports.editCommentSchema = exports.createCommentSchema = exports.listTasksQuerySchema = exports.taskCapabilitiesSchema = exports.patchTaskSchema = exports.updateTaskStatusSchema = exports.rescheduleTaskSchema = exports.appendLedgerSchema = exports.updateListSchema = exports.createListSchema = exports.createTaskSchema = exports.MAX_SUBTASKS_PER_TASK_MUTATION = exports.updateSubtaskSchema = exports.createSubtaskSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = exports.upsertOrganizationMemberSchema = exports.updateOrganizationSchema = exports.createOrganizationSchema = exports.appendableLedgerTypeSchema = exports.ledgerTypeSchema = exports.taskDueRepeatSchema = exports.taskPrioritySchema = exports.taskManualStatusInputSchema = exports.taskStatusInputSchema = exports.taskStatusSchema = exports.taskManualStatusSchema = exports.orgRoleSchema = void 0;
const zod_1 = require("zod");
exports.orgRoleSchema = zod_1.z.enum(["owner", "manager", "member"]);
/** Stages the client may set via create / PATCH / status endpoint. */
exports.taskManualStatusSchema = zod_1.z.enum(["pending", "in_progress", "done", "cancelled"]);
/** Full persisted enum (`assigned` / `late` are legacy only; API normalizes on read). */
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
/** Manual stage input (API writes); `open` → `pending`. */
exports.taskManualStatusInputSchema = zod_1.z
    .union([exports.taskManualStatusSchema, zod_1.z.literal("open")])
    .transform((s) => (s === "open" ? "pending" : s));
exports.taskPrioritySchema = zod_1.z.enum(["high", "medium", "low"]);
/** Optional cadence after the due instant; marking **done** spawns the next task row (model B) when `dueAt` is set. */
exports.taskDueRepeatSchema = zod_1.z.enum(["daily", "weekly", "monthly", "yearly"]);
exports.ledgerTypeSchema = zod_1.z.enum([
    "ack",
    "note",
    "reschedule",
    "status_change",
    "assignee_change",
    "archive",
]);
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
    /** Single level (legacy); ignored when `departmentIds` is non-empty. */
    departmentId: zod_1.z.string().uuid().optional().nullable(),
    /** One or more levels for `manager`; preferred over `departmentId`. */
    departmentIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
})
    .superRefine((data, ctx) => {
    if (data.role !== "manager")
        return;
    const raw = data.departmentIds && data.departmentIds.length > 0
        ? data.departmentIds
        : data.departmentId
            ? [data.departmentId]
            : [];
    if (raw.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Managers must have at least one level (departmentIds or departmentId)",
            path: ["departmentIds"],
        });
    }
});
exports.createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.updateDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(256),
});
exports.createSubtaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
});
exports.updateSubtaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512).optional(),
    done: zod_1.z.boolean().optional(),
});
/** Max checklist lines accepted on create / PATCH in one request (server-enforced). */
exports.MAX_SUBTASKS_PER_TASK_MUTATION = 100;
exports.createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(512),
    listId: zod_1.z.string().uuid(),
    assigneeUserIds: zod_1.z.array(zod_1.z.string().min(1)).optional().default([]),
    dueAt: zod_1.z.string().datetime().optional().nullable(),
    /** Only meaningful when `dueAt` is set; ignored otherwise. */
    dueRepeat: exports.taskDueRepeatSchema.nullable().optional(),
    status: exports.taskManualStatusSchema.optional(),
    priority: exports.taskPrioritySchema.optional(),
    /** Created in the same transaction as the task (single round-trip vs N POST subtasks). */
    initialSubtasks: zod_1.z
        .array(exports.createSubtaskSchema)
        .max(exports.MAX_SUBTASKS_PER_TASK_MUTATION)
        .optional()
        .default([]),
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
    status: exports.taskManualStatusInputSchema,
});
exports.patchTaskSchema = zod_1.z
    .object({
    status: exports.taskManualStatusInputSchema.optional(),
    priority: exports.taskPrioritySchema.optional(),
    title: zod_1.z.string().min(1).max(512).optional(),
    assigneeUserIds: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    /** Same instant semantics as `POST …/reschedule`: ISO datetime or `null` to clear. Requires reschedule capability when changed. */
    dueAt: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.null()]).optional(),
    dueRepeat: exports.taskDueRepeatSchema.nullable().optional(),
    /** New checklist lines inserted in the same transaction as task field updates. */
    subtasksToCreate: zod_1.z.array(exports.createSubtaskSchema).max(exports.MAX_SUBTASKS_PER_TASK_MUTATION).optional(),
})
    .refine((d) => {
    const subs = d.subtasksToCreate;
    const hasSubs = subs != null && subs.length > 0;
    return (d.status !== undefined ||
        d.priority !== undefined ||
        d.title !== undefined ||
        d.assigneeUserIds !== undefined ||
        d.dueAt !== undefined ||
        d.dueRepeat !== undefined ||
        hasSubs);
}, { message: "Provide at least one field to update" });
exports.taskCapabilitiesSchema = zod_1.z.object({
    canArchiveTask: zod_1.z.boolean(),
    canDeleteTask: zod_1.z.boolean(),
    canReschedule: zod_1.z.boolean(),
    canAppendLedger: zod_1.z.boolean(),
});
exports.listTasksQuerySchema = zod_1.z.object({
    status: zod_1.z
        .string()
        .optional()
        .transform((s) => (s ? s.split(",").filter(Boolean) : undefined)),
    listId: zod_1.z.string().uuid().optional(),
    departmentId: zod_1.z.string().uuid().optional(),
    assigneeUserId: zod_1.z.string().min(1).optional(),
    dueDateFrom: zod_1.z.string().datetime().optional(),
    dueDateTo: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
    cursor: zod_1.z.string().min(1).optional(),
    includeSubtasks: zod_1.z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v !== "false"),
});
exports.createCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(4000),
    parentCommentId: zod_1.z.string().uuid().optional(),
});
exports.editCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(4000),
});
exports.markNotificationsReadSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
});
exports.markAllNotificationsReadSchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
});
exports.listNotificationsQuerySchema = zod_1.z.object({
    orgId: zod_1.z.string().uuid(),
    unreadOnly: zod_1.z.enum(["true", "false"]).optional().transform((v) => v === "true"),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(50),
});
