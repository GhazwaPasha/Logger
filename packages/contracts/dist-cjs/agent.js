"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGENT_TASK_LINK_RE = exports.patchAgentThreadSchema = exports.askAgentSchema = exports.AGENT_MESSAGE_MAX = void 0;
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
});
exports.patchAgentThreadSchema = zod_1.z
    .object({
    pinned: zod_1.z.boolean().optional(),
    title: zod_1.z.string().trim().min(1).max(120).optional(),
})
    .refine((v) => v.pinned !== undefined || v.title !== undefined, { message: "Nothing to change" });
/**
 * Agent answers link tasks as `[Title](task:<uuid>)`. Clients turn these into links to the task;
 * anything else in the answer is plain text with light markdown (paragraphs, `- ` bullets, `**bold**`).
 */
exports.AGENT_TASK_LINK_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)/g;
