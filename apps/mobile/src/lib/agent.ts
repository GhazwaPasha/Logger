import { ApiClient } from '@work-ledger/client-core';
import type { AgentStreamEvent, AskAgentInput } from '@work-ledger/contracts';
import { fetch as expoFetch } from 'expo/fetch';

import { tokenManager } from '@/lib/api';
import { API_URL } from '@/lib/config';

/**
 * Ask LogBase transport. Same token engine as `api()`, but on `expo/fetch`, whose response body streams
 * (React Native's own fetch buffers the whole body, which would hide every step until the answer).
 */
const streamingClient = new ApiClient({
  baseUrl: API_URL,
  tokens: tokenManager,
  fetch: expoFetch as unknown as typeof fetch,
});

/** Sends a question and calls `onEvent` per NDJSON line as it arrives. Pre-stream failures reject as `ApiError`. */
export async function streamAsk(
  organizationId: string,
  body: AskAgentInput,
  onEvent: (e: AgentStreamEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await streamingClient.raw(`/organizations/${organizationId}/agent/ask`, {
    method: 'POST',
    body,
    signal,
    headers: { Accept: 'application/x-ndjson' },
  });
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming is not available on this device.');
  // The transport stops watching `signal` once headers arrive; cancel the body read ourselves.
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener('abort', onAbort);

  const decoder = new TextDecoder();
  let buffered = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, nl).trim();
        buffered = buffered.slice(nl + 1);
        if (line) onEvent(JSON.parse(line) as AgentStreamEvent);
      }
    }
    const tail = buffered.trim();
    if (tail) onEvent(JSON.parse(tail) as AgentStreamEvent);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export const agentKeys = {
  all: ['agent'] as const,
  threads: (organizationId: string) => [...agentKeys.all, organizationId, 'threads'] as const,
  thread: (threadId: string) => [...agentKeys.all, 'thread', threadId] as const,
};
