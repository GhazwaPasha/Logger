import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Minimal streaming Gemini client for the agent loop (REST `streamGenerateContent`, SSE). The model is pinned
 * via `GEMINI_MODEL_AGENT` rather than discovered, so a loop never silently changes model mid-flight.
 *
 * Every round streams: answer text reaches the user as it's written, and a round that turns out to be tool
 * calls costs nothing extra.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_AGENT_MODEL = "gemini-3.5-flash";
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 1_200;

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  /** Gemini 3 attaches these to parts it needs back; model turns are replayed with them intact. */
  thoughtSignature?: string;
  thought?: boolean;
};

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiFunctionDeclaration = { name: string; description: string; parameters?: Record<string, unknown> };

export type GeminiTurn = {
  content: GeminiContent;
  inputTokens: number;
  /** Of `inputTokens`, how many Gemini served from its implicit prefix cache (billed at a discount). */
  cachedTokens: number;
  outputTokens: number;
  finishReason: string | undefined;
};

type StreamChunk = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    cachedContentTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  error?: { message?: string };
};

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: "quota" | "unavailable" | "bad_response",
  ) {
    super(message);
  }
}

/** "Please retry in 8h36m8.7s" → "about 8 hours"; Gemini puts the reset time in its quota errors. */
function retryHint(message: string): string | null {
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(message);
  if (!m) return null;
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Math.ceil(Number(m[3] ?? 0) / 60);
  if (minutes >= 90) return `about ${Math.round(minutes / 60)} hours`;
  if (minutes >= 2) return `about ${minutes} minutes`;
  return "a minute";
}

function errorFor(status: number, message: string): GeminiError {
  if (status === 429 || /quota|resource exhausted/i.test(message)) {
    const daily = /per day|daily/i.test(message);
    const wait = retryHint(message);
    return new GeminiError(
      daily
        ? `LogBase has used up today's AI allowance${wait ? `; it resets in ${wait}` : ""}.`
        : `The AI service is busy right now. Try again in ${wait ?? "a minute"}.`,
      "quota",
    );
  }
  if (status === 503) return new GeminiError("The AI service is overloaded right now. Try again in a moment.", "unavailable");
  return new GeminiError(`The AI service returned an error (${status}).`, "unavailable");
}

/**
 * Folds streamed parts into the turn's final parts: consecutive text joins into one part, function calls
 * stay separate, and a signature that arrives on an empty trailing part attaches to the part before it.
 */
function mergePart(parts: GeminiPart[], incoming: GeminiPart) {
  const last = parts.at(-1);
  if (incoming.functionCall) {
    parts.push(incoming);
    return;
  }
  const isText = typeof incoming.text === "string";
  if (last && !last.functionCall && isText && !!last.thought === !!incoming.thought && typeof last.text === "string") {
    last.text += incoming.text;
    if (incoming.thoughtSignature) last.thoughtSignature = incoming.thoughtSignature;
    return;
  }
  if (!isText && incoming.thoughtSignature && last) {
    last.thoughtSignature = incoming.thoughtSignature;
    return;
  }
  parts.push({ ...incoming });
}

@Injectable()
export class GeminiClient {
  constructor(private readonly config: ConfigService) {}

  get apiKey(): string | null {
    return (this.config.get<string>("GEMINI_API_KEY") ?? this.config.get<string>("GOOGLE_GENERATIVE_AI_API_KEY") ?? "").trim() || null;
  }

  get agentModel(): string {
    return this.config.get<string>("GEMINI_MODEL_AGENT")?.trim() || DEFAULT_AGENT_MODEL;
  }

  /** Optional `minimal` | `low` | `medium` | `high`. Unset = the model's default, which measured best overall. */
  private get thinkingLevel(): string | null {
    return this.config.get<string>("GEMINI_AGENT_THINKING")?.trim() || null;
  }

  async stream(opts: {
    model: string;
    system: string;
    contents: GeminiContent[];
    tools?: GeminiFunctionDeclaration[];
    /** `NONE` forces a plain-text answer (used when the loop's tool budget is spent). */
    toolMode?: "AUTO" | "NONE";
    maxOutputTokens?: number;
    signal?: AbortSignal;
    /** Visible answer text as it arrives (thoughts are never passed through). */
    onText?: (delta: string) => void;
  }): Promise<GeminiTurn> {
    const key = this.apiKey;
    if (!key) throw new GeminiError("The AI service is not configured.", "unavailable");

    const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: opts.maxOutputTokens ?? 2048 };
    if (this.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: this.thinkingLevel };
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.contents,
      generationConfig,
    };
    if (opts.tools?.length) {
      body.tools = [{ functionDeclarations: opts.tools }];
      body.toolConfig = { functionCallingConfig: { mode: opts.toolMode ?? "AUTO" } };
    }

    const signal = opts.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let res: Response | null = null;
    // One retry for "high demand" 503s / transient 500s, which Gemini returns in short bursts. Status arrives
    // before any body, so a retry never duplicates streamed text.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal,
        });
      } catch {
        if (signal.aborted) throw new GeminiError("The AI service took too long to answer.", "unavailable");
        throw new GeminiError("Couldn't reach the AI service. Try again in a moment.", "unavailable");
      }
      if (res.status !== 503 && res.status !== 500) break;
      await res.body?.cancel().catch(() => undefined);
    }
    if (!res!.ok) {
      const data = (await res!.json().catch(() => ({}))) as StreamChunk;
      throw errorFor(res!.status, data.error?.message ?? res!.statusText);
    }

    const parts: GeminiPart[] = [];
    let usage: StreamChunk["usageMetadata"] = {};
    let finishReason: string | undefined;
    const reader = res!.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    const handle = (event: string) => {
      const data = event
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("");
      if (!data) return;
      const chunk = JSON.parse(data) as StreamChunk;
      if (chunk.error) throw errorFor(500, chunk.error.message ?? "stream error");
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (part.text && !part.thought) opts.onText?.(part.text);
        mergePart(parts, part);
      }
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let sep: number;
        while ((sep = buffered.indexOf("\n\n")) >= 0) {
          handle(buffered.slice(0, sep));
          buffered = buffered.slice(sep + 2);
        }
      }
      if (buffered.trim()) handle(buffered);
    } catch (err) {
      if (err instanceof GeminiError) throw err;
      if (signal.aborted) throw new GeminiError("The AI service took too long to answer.", "unavailable");
      throw new GeminiError("The AI service's answer was cut off. Please try again.", "bad_response");
    }

    if (!parts.length) throw new GeminiError("The AI service returned an empty answer.", "bad_response");
    return {
      content: { role: "model", parts },
      inputTokens: usage.promptTokenCount ?? 0,
      cachedTokens: usage.cachedContentTokenCount ?? 0,
      outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      finishReason,
    };
  }
}
