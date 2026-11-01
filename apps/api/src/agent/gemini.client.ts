import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Minimal Gemini `generateContent` client for the agent loop (REST, like the web's task-fill route).
 * Models are pinned via env rather than discovered, so a loop never silently changes model mid-flight:
 * `GEMINI_MODEL_AGENT` answers questions, `GEMINI_MODEL_FAST` does small chores (thread titles).
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_AGENT_MODEL = "gemini-3.5-flash";
const DEFAULT_FAST_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_DELAY_MS = 1_200;

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; response: Record<string, unknown>; id?: string };
  /** Gemini 3 attaches these to parts it may need back; model turns are replayed verbatim so they survive. */
  thoughtSignature?: string;
  thought?: boolean;
};

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiFunctionDeclaration = { name: string; description: string; parameters?: Record<string, unknown> };

export type GeminiTurn = {
  content: GeminiContent;
  inputTokens: number;
  outputTokens: number;
  finishReason: string | undefined;
};

type GenerateResponse = {
  candidates?: { content?: { role?: string; parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string; status?: string };
};

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly kind: "quota" | "unavailable" | "bad_response",
  ) {
    super(message);
  }
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

  get fastModel(): string {
    return this.config.get<string>("GEMINI_MODEL_FAST")?.trim() || DEFAULT_FAST_MODEL;
  }

  async generate(opts: {
    model: string;
    system: string;
    contents: GeminiContent[];
    tools?: GeminiFunctionDeclaration[];
    /** `NONE` forces a plain-text answer (used when the loop's tool budget is spent). */
    toolMode?: "AUTO" | "NONE";
    maxOutputTokens?: number;
    signal?: AbortSignal;
  }): Promise<GeminiTurn> {
    const key = this.apiKey;
    if (!key) throw new GeminiError("The AI service is not configured.", "unavailable");

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: opts.contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: opts.maxOutputTokens ?? 2048 },
    };
    if (opts.tools?.length) {
      body.tools = [{ functionDeclarations: opts.tools }];
      body.toolConfig = { functionCallingConfig: { mode: opts.toolMode ?? "AUTO" } };
    }

    const signal = opts.signal
      ? AbortSignal.any([opts.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS);

    let res: Response | null = null;
    let data: GenerateResponse = {};
    // One retry for "high demand" 503s / transient 500s, which Gemini returns in short bursts.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        res = await fetch(`${GEMINI_BASE}/${encodeURIComponent(opts.model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
          signal,
        });
      } catch {
        if (signal.aborted) throw new GeminiError("The AI service took too long to answer.", "unavailable");
        throw new GeminiError("Couldn't reach the AI service. Try again in a moment.", "unavailable");
      }
      data = (await res.json().catch(() => ({}))) as GenerateResponse;
      if (res.status !== 503 && res.status !== 500) break;
    }

    if (!res!.ok || data.error) {
      const msg = data.error?.message ?? res!.statusText;
      if (res!.status === 429 || /quota|resource exhausted/i.test(msg)) {
        throw new GeminiError("The AI service is busy right now. Try again in a minute.", "quota");
      }
      if (res!.status === 503) {
        throw new GeminiError("The AI service is overloaded right now. Try again in a moment.", "unavailable");
      }
      throw new GeminiError(`The AI service returned an error (${res!.status}).`, "unavailable");
    }

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    if (!parts.length) throw new GeminiError("The AI service returned an empty answer.", "bad_response");

    const u = data.usageMetadata ?? {};
    return {
      content: { role: "model", parts },
      inputTokens: u.promptTokenCount ?? 0,
      outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
      finishReason: candidate?.finishReason,
    };
  }
}
