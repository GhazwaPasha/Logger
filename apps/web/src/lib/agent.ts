import type { AgentStreamEvent, AskAgentInput } from "@work-ledger/contracts";
import { apiClient } from "@/lib/session";

/**
 * Sends a question to Ask LogBase and calls `onEvent` for each line of the NDJSON stream as it arrives.
 * Errors before the stream starts (budget, permissions, validation) reject as the usual `ApiError`.
 */
export async function streamAsk(
  organizationId: string,
  body: AskAgentInput,
  onEvent: (e: AgentStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await apiClient.raw(`/organizations/${organizationId}/agent/ask`, {
    method: "POST",
    body,
    signal,
    headers: { Accept: "application/x-ndjson" },
  });
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported in this browser.");
  // The transport stops watching `signal` once headers arrive; cancel the body read ourselves.
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener("abort", onAbort);

  const decoder = new TextDecoder();
  let buffered = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, nl).trim();
        buffered = buffered.slice(nl + 1);
        if (line) onEvent(JSON.parse(line) as AgentStreamEvent);
      }
    }
    const tail = buffered.trim();
    if (tail) onEvent(JSON.parse(tail) as AgentStreamEvent);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export const agentKeys = {
  all: ["agent"] as const,
  threads: (organizationId: string) => [...agentKeys.all, organizationId, "threads"] as const,
  thread: (threadId: string) => [...agentKeys.all, "thread", threadId] as const,
};
