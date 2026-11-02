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
  /** Where the user is in the app right now; questions default to this scope ("what's late?" = late *here*). */
  view: z
    .object({
      label: z.string().trim().min(1).max(160),
      channelId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
    })
    .optional(),
  /** Tasks the user selected on the board before asking ("these"). */
  selection: z
    .array(z.object({ id: z.string().uuid(), title: z.string().max(300) }))
    .max(50)
    .optional(),
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
  /** One line per finished tool call, e.g. "Looked at 12 tasks". Discard any `delta` text received before it. */
  | { type: "step"; label: string }
  /** Answer text as it's written. Append to a draft; a later `step` means it was a preamble, so clear the draft. */
  | { type: "delta"; text: string }
  /** The agent proposed a change: show it as an approval card. Nothing has happened yet. */
  | { type: "proposal"; proposal: AgentProposal }
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

export type AgentProposalKind = "reschedule" | "assign" | "status" | "comment" | "create" | "archive" | "edit";
export type AgentProposalStatus = "pending" | "applied" | "partial" | "failed" | "rejected" | "expired";

/** A change the agent proposed; it runs (as the user) only when they approve it. */
export type AgentProposal = {
  id: string;
  kind: AgentProposalKind;
  /** e.g. "Reschedule 3 tasks". */
  summary: string;
  /** One row per task; `from` / `to` are display strings ("Nov 2, 4:00 PM", "Noman Nasim", "Pending"). */
  items: { taskId: string; title: string; from: string | null; to: string }[];
  status: AgentProposalStatus;
  /** Per-task outcome once decided. */
  result: { taskId: string; ok: boolean; error?: string }[] | null;
  createdAt: string;
};

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: AgentStep[] | null;
  /** Changes this answer proposed (assistant messages only). */
  proposals?: AgentProposal[];
  createdAt: string;
};

/** Pending proposals stop being approvable after this long — the board has likely moved on. */
export const AGENT_PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

export type AgentThreadDetail = AgentThreadSummary & { messages: AgentMessage[] };

/**
 * Agent answers link tasks as `[Title](task:<uuid>)`. Clients turn these into links to the task;
 * anything else in the answer is plain text with light markdown (paragraphs, `- ` bullets, `**bold**`).
 */
export const AGENT_TASK_LINK_RE = /\[([^\]]+)\]\(task:([0-9a-f-]{36})\)/g;
