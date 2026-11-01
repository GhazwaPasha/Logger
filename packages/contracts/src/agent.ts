import { z } from "zod";

/**
 * LogBase agent ("Ask"): request body, stream events and thread shapes shared by the API, web and mobile.
 *
 * The ask endpoint answers with newline-delimited JSON, one {@link AgentStreamEvent} per line, so a client
 * can show each step as it happens and still read the whole run with a plain line splitter.
 */

export const AGENT_MESSAGE_MAX = 4000;

export const askAgentSchema = z.object({
  message: z.string().trim().min(1).max(AGENT_MESSAGE_MAX),
  /** Continue an existing conversation; omitted = start a new one. */
  threadId: z.string().uuid().optional(),
  /** The task the user is looking at, so "this task" resolves. Only used when starting a thread. */
  taskId: z.string().uuid().optional(),
});
export type AskAgentInput = z.infer<typeof askAgentSchema>;

export const patchAgentThreadSchema = z
  .object({
    pinned: z.boolean().optional(),
    title: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.pinned !== undefined || v.title !== undefined, { message: "Nothing to change" });

export type AgentStep = { label: string };

export type AgentStreamEvent =
  /** First event of every run: which thread the turn landed in (new threads get their title later). */
  | { type: "thread"; threadId: string; title: string }
  /** One line per finished tool call, e.g. "Looked at 12 tasks". */
  | { type: "step"; label: string }
  | { type: "answer"; messageId: string; text: string; title: string }
  | { type: "error"; message: string };

export type AgentThreadSummary = {
  id: string;
  title: string;
  taskId: string | null;
  pinned: boolean;
  createdAt: string;
  lastMessageAt: string;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: AgentStep[] | null;
  createdAt: string;
};

export type AgentThreadDetail = AgentThreadSummary & { messages: AgentMessage[] };

/**
 * Agent answers link tasks as `[Title](task:<uuid>)`. Clients turn these into links to the task;
 * anything else in the answer is plain text with light markdown (paragraphs, `- ` bullets, `**bold**`).
 */
export const AGENT_TASK_LINK_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)/g;
