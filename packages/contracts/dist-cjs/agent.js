"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_TASK_LINK_RE = exports.AGENT_PROPOSAL_TTL_MS = exports.patchAgentThreadSchema = exports.askAgentSchema = exports.AGENT_MESSAGE_MAX = void 0;
const zod_1 = require("zod");
/**
 * LogBase agent ("Ask"): request body, stream events and thread shapes shared by the API, web and mobile.
 *
 * The ask endpoint answers with newline-delimited JSON, one {@link AgentStreamEvent} per line, so a client
 * can show each step as it happens and still read the whole run with a plain line splitter.
 */
exports.AGENT_MESSAGE_MAX = 4000;
exports.askAgentSchema = zod_1.z.object({
    message: zod_1.z.string().trim().min(1).max(exports.AGENT_MESSAGE_MAX),
    /** Continue an existing conversation; omitted = start a new one. */
    threadId: zod_1.z.string().uuid().optional(),
    /** The task the user is looking at, so "this task" resolves. Only used when starting a thread. */
    taskId: zod_1.z.string().uuid().optional(),
    /** Where the user is in the app right now; questions default to this scope ("what's late?" = late *here*). */
    view: zod_1.z
        .object({
        label: zod_1.z.string().trim().min(1).max(160),
        channelId: zod_1.z.string().uuid().optional(),
        categoryId: zod_1.z.string().uuid().optional(),
    })
        .optional(),
    /** The task form open on screen, as it stands right now (possibly unsaved). The agent can fill it in directly. */
    taskForm: zod_1.z
        .object({
        taskId: zod_1.z.string().uuid(),
        /** Still the untitled draft from "New task". */
        isNew: zod_1.z.boolean(),
        title: zod_1.z.string().max(512),
        status: zod_1.z.string().max(32),
        priority: zod_1.z.string().max(32),
        /** `YYYY-MM-DDTHH:mm` in the workspace time zone, or "" for none. */
        dueLocal: zod_1.z.string().max(32),
        dueRepeat: zod_1.z.string().max(32).nullable(),
        assigneeUserIds: zod_1.z.array(zod_1.z.string().max(128)).max(50),
        subtasks: zod_1.z.array(zod_1.z.string().max(512)).max(100),
    })
        .optional(),
    /** Tasks the user selected on the board before asking ("these"). */
    selection: zod_1.z
        .array(zod_1.z.object({ id: zod_1.z.string().uuid(), title: zod_1.z.string().max(300) }))
        .max(50)
        .optional(),
});
exports.patchAgentThreadSchema = zod_1.z
    .object({
    pinned: zod_1.z.boolean().optional(),
    title: zod_1.z.string().trim().min(1).max(120).optional(),
})
    .refine((v) => v.pinned !== undefined || v.title !== undefined, { message: "Nothing to change" });
/** Pending proposals stop being approvable after this long — the board has likely moved on. */
exports.AGENT_PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Agent answers link tasks as `[Title](task:<uuid>)`. Clients turn these into links to the task;
 * anything else in the answer is plain text with light markdown (paragraphs, `- ` bullets, `**bold**`).
 */
exports.AGENT_TASK_LINK_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)/g;
