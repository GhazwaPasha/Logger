"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKeySchema = exports.logTimeEntrySchema = exports.linkMilestoneTasksSchema = exports.updateMilestoneSchema = exports.createMilestoneSchema = exports.updateGoalSchema = exports.createGoalSchema = exports.roadmapStatusSchema = exports.editCommentSchema = exports.createCommentSchema = exports.listTasksQuerySchema = exports.taskCapabilitiesSchema = exports.discordIntegrationConfigSchema = exports.patchTaskSchema = exports.updateTaskStatusSchema = exports.rescheduleTaskSchema = exports.appendLedgerSchema = exports.reorderListsSchema = exports.updateListSchema = exports.createListSchema = exports.createTaskSchema = exports.MAX_SUBTASKS_PER_TASK_MUTATION = exports.updateSubtaskSchema = exports.createSubtaskSchema = exports.reorderDepartmentsSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = exports.upsertOrganizationMemberSchema = exports.updateOrganizationSchema = exports.createOrganizationSchema = exports.appendableLedgerTypeSchema = exports.ledgerTypeSchema = exports.taskDueRepeatSchema = exports.taskPrioritySchema = exports.taskManualStatusInputSchema = exports.taskStatusInputSchema = exports.taskStatusSchema = exports.taskManualStatusSchema = exports.orgRoleSchema = void 0;
const zod_1 = require("zod");
const timezone_js_1 = require("./timezone.js");
__exportStar(require("./timezone.js"), exports);
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
exports.updateOrganizationSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(256).optional(),
    timeZone: zod_1.z
        .string()
        .min(1)
        .max(64)
        .refine(timezone_js_1.isValidTimeZone, { message: "Not a recognized IANA timezone" })
        .optional(),
})
    .refine((v) => v.name !== undefined || v.timeZone !== undefined, { message: "Nothing to update" });
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
/** Full sibling order for an organization's departments; server rejects anything but a permutation of the existing set. */
exports.reorderDepartmentsSchema = zod_1.z.object({
    orderedIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
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
    /** Client-generated UUID; server uses it as-is when provided. */
    id: zod_1.z.string().uuid().optional(),
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
/** Full sibling order for one department's lists; server rejects anything but a permutation of that department's existing set. */
exports.reorderListsSchema = zod_1.z.object({
    departmentId: zod_1.z.string().uuid(),
    orderedIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
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
    /** Moves the task to a different list (and therefore level/department). */
    listId: zod_1.z.string().uuid().optional(),
    assigneeUserIds: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    /** Same instant semantics as `POST …/reschedule`: ISO datetime or `null` to clear. Requires reschedule capability when changed. */
    dueAt: zod_1.z.union([zod_1.z.string().datetime(), zod_1.z.null()]).optional(),
    dueRepeat: exports.taskDueRepeatSchema.nullable().optional(),
    /** New checklist lines inserted in the same transaction as task field updates. */
    subtasksToCreate: zod_1.z.array(exports.createSubtaskSchema).max(exports.MAX_SUBTASKS_PER_TASK_MUTATION).optional(),
    /** Existing subtask title edits applied in the same transaction. */
    subtasksToUpdate: zod_1.z
        .array(zod_1.z.object({ id: zod_1.z.string().uuid(), title: zod_1.z.string().min(1).max(512) }))
        .max(exports.MAX_SUBTASKS_PER_TASK_MUTATION)
        .optional(),
    /** IDs of existing subtasks to delete in the same transaction. */
    subtasksToDelete: zod_1.z.array(zod_1.z.string().uuid()).max(exports.MAX_SUBTASKS_PER_TASK_MUTATION).optional(),
    /** Discord channel snowflake ID attachments should post to; `null` disables Discord posting for this task. */
    discordChannelId: zod_1.z.string().min(1).max(64).nullable().optional(),
    /** When a Discord channel is set, whether a Discord submission is required before the task can be marked done. */
    discordSubmissionRequired: zod_1.z.boolean().optional(),
    /** Requires at least one attachment (any source) before the task can be marked done. */
    attachmentRequired: zod_1.z.boolean().optional(),
    /** Controls whether the time-tracking UI is shown for this task at all. */
    timeTrackingEnabled: zod_1.z.boolean().optional(),
})
    .refine((d) => {
    const hasSubCreate = (d.subtasksToCreate?.length ?? 0) > 0;
    const hasSubUpdate = (d.subtasksToUpdate?.length ?? 0) > 0;
    const hasSubDelete = (d.subtasksToDelete?.length ?? 0) > 0;
    return (d.status !== undefined ||
        d.priority !== undefined ||
        d.title !== undefined ||
        d.assigneeUserIds !== undefined ||
        d.dueAt !== undefined ||
        d.dueRepeat !== undefined ||
        d.discordChannelId !== undefined ||
        d.discordSubmissionRequired !== undefined ||
        d.attachmentRequired !== undefined ||
        d.timeTrackingEnabled !== undefined ||
        hasSubCreate || hasSubUpdate || hasSubDelete);
}, { message: "Provide at least one field to update" });
exports.discordIntegrationConfigSchema = zod_1.z.object({
    guildId: zod_1.z.string().min(1).max(64),
});
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
    /** When "true", returns archived tasks (the Archived page) instead of active ones. */
    archived: zod_1.z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true"),
});
exports.createCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(4000),
    parentCommentId: zod_1.z.string().uuid().optional(),
});
exports.editCommentSchema = zod_1.z.object({
    body: zod_1.z.string().min(1).max(4000),
});
exports.roadmapStatusSchema = zod_1.z.enum(["on_track", "at_risk", "done", "archived"]);
/** An outcome a team is pursuing; not time-boxed. Owns one or more milestones. */
exports.createGoalSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(256),
    description: zod_1.z.string().max(4000).optional().nullable(),
    departmentId: zod_1.z.string().uuid().optional().nullable(),
    ownerId: zod_1.z.string().min(1).optional().nullable(),
    status: exports.roadmapStatusSchema.optional(),
    /** Soft overall deadline; not a structural boundary for its milestones. */
    targetDate: zod_1.z.string().datetime().optional().nullable(),
});
exports.updateGoalSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).max(256).optional(),
    description: zod_1.z.string().max(4000).optional().nullable(),
    departmentId: zod_1.z.string().uuid().optional().nullable(),
    ownerId: zod_1.z.string().min(1).optional().nullable(),
    status: exports.roadmapStatusSchema.optional(),
    targetDate: zod_1.z.string().datetime().optional().nullable(),
})
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
});
/** Time-boxed step serving a goal; free-form dates, no forced period ladder. */
exports.createMilestoneSchema = zod_1.z.object({
    goalId: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1).max(256),
    description: zod_1.z.string().max(4000).optional().nullable(),
    parentId: zod_1.z.string().uuid().optional().nullable(),
    departmentId: zod_1.z.string().uuid().optional().nullable(),
    periodStart: zod_1.z.string().datetime(),
    periodEnd: zod_1.z.string().datetime(),
    ownerId: zod_1.z.string().min(1).optional().nullable(),
});
exports.updateMilestoneSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(1).max(256).optional(),
    description: zod_1.z.string().max(4000).optional().nullable(),
    parentId: zod_1.z.string().uuid().optional().nullable(),
    departmentId: zod_1.z.string().uuid().optional().nullable(),
    periodStart: zod_1.z.string().datetime().optional(),
    periodEnd: zod_1.z.string().datetime().optional(),
    ownerId: zod_1.z.string().min(1).optional().nullable(),
    status: exports.roadmapStatusSchema.optional(),
    orderIndex: zod_1.z.number().int().optional(),
})
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
});
exports.linkMilestoneTasksSchema = zod_1.z.object({
    taskIds: zod_1.z.array(zod_1.z.string().uuid()).min(1).max(100),
});
exports.logTimeEntrySchema = zod_1.z.object({
    startedAt: zod_1.z.string().datetime(),
    stoppedAt: zod_1.z.string().datetime(),
    note: zod_1.z.string().max(512).optional(),
});
exports.createApiKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(128),
});
