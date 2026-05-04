import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { extractJsonObjectFromModelText } from "@/lib/task-ai-json";
import {
  GEMINI_TASK_FILL_RESPONSE_SCHEMA,
  TASK_AI_SYSTEM_INSTRUCTION,
  buildTaskFillUserTurn,
} from "@/lib/task-ai-playbook";
import {
  normalizeTaskAiFillPayload,
  parseDueRepeatLoose,
  taskAiFillResultIsEmpty,
  type TaskAiExistingDraft,
  type TaskAiFillRequestBody,
} from "@/lib/task-ai-fill";

const MAX_PROMPT_LEN = 6000;
const MODEL_LIST_CACHE_MS = 20 * 60 * 1000;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

type GeminiPart = { text?: string };
type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string; code?: number; status?: string };
};

function geminiApiKey(): string | null {
  const a = process.env.GEMINI_API_KEY?.trim();
  if (a) return a;
  const b = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return b || null;
}

function apiKeyFingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

type GeminiListModel = {
  name?: string;
  baseModelId?: string;
  supportedGenerationMethods?: string[];
};

type GeminiListModelsResponse = {
  models?: GeminiListModel[];
  nextPageToken?: string;
  error?: { message?: string };
};

function stripModelsPrefix(resourceName: string | undefined): string {
  if (!resourceName) return "";
  return resourceName.startsWith("models/") ? resourceName.slice("models/".length) : resourceName;
}

function modelIdForGenerateContent(m: GeminiListModel): string | null {
  const methods = m.supportedGenerationMethods ?? [];
  if (!methods.includes("generateContent")) return null;
  const id = (m.baseModelId?.trim() || stripModelsPrefix(m.name)).trim();
  if (!id) return null;
  const lower = id.toLowerCase();
  if (!lower.includes("gemini")) return null;
  if (lower.includes("embedding")) return null;
  return id;
}

let discoverCache: { fp: string; model: string; at: number } | null = null;

/**
 * Uses `GEMINI_MODEL` when set. Otherwise asks Google (`models.list`) and picks the first model
 * that advertises `generateContent`, in API list order (no hardcoded model id in this app).
 */
async function resolveModelForRequest(apiKey: string): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  const pinned = process.env.GEMINI_MODEL?.trim();
  if (pinned) return { ok: true, model: pinned };

  const fp = apiKeyFingerprint(apiKey);
  const now = Date.now();
  if (discoverCache && discoverCache.fp === fp && now - discoverCache.at < MODEL_LIST_CACHE_MS) {
    return { ok: true, model: discoverCache.model };
  }

  const collected: string[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  try {
    for (let page = 0; page < 8; page++) {
      const u = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      u.searchParams.set("key", apiKey);
      u.searchParams.set("pageSize", "100");
      if (pageToken) u.searchParams.set("pageToken", pageToken);

      const res = await fetch(u.toString());
      const raw = await res.text();
      let data: GeminiListModelsResponse;
      try {
        data = JSON.parse(raw) as GeminiListModelsResponse;
      } catch {
        return { ok: false, error: "Could not parse Gemini models list response." };
      }

      if (!res.ok) {
        const msg = data.error?.message || raw.slice(0, 400) || res.statusText;
        return {
          ok: false,
          error: `Could not list models for this API key (${msg}). Set GEMINI_MODEL in the server env to a model id, or verify the key.`,
        };
      }

      for (const m of data.models ?? []) {
        const id = modelIdForGenerateContent(m);
        if (id && !seen.has(id)) {
          seen.add(id);
          collected.push(id);
        }
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  } catch {
    return { ok: false, error: "Could not reach Gemini to list models. Set GEMINI_MODEL or try again later." };
  }

  const first = collected[0];
  if (!first) {
    return {
      ok: false,
      error:
        "No Gemini model with generateContent was returned for this key. Set GEMINI_MODEL explicitly (see Google AI Studio).",
    };
  }

  discoverCache = { fp, model: first, at: now };
  return { ok: true, model: first };
}

/** Google often returns free_tier + limit:0 when the key's GCP project has no allowance for that model, not "RPM used up". */
function enrichGeminiErrorMessage(message: string, model: string): string {
  const lower = message.toLowerCase();
  const isQuota =
    lower.includes("quota") || lower.includes("resource exhausted") || lower.includes("limit: 0");
  if (!isQuota) return message;

  const freeTierZero =
    lower.includes("free_tier") && lower.includes("limit: 0");
  const suffix = freeTierZero
    ? ` [App hint: "limit: 0" on free_tier usually means the Cloud project for this API key has no free-tier allocation for model "${model}"—often fixed by linking billing to that project in Google Cloud (same project as in AI Studio for this key). You can pin a different model with GEMINI_MODEL and restart the server.]`
    : ` [App hint: Quota pages can be per-project; confirm this key's project matches the console you checked. Optionally set GEMINI_MODEL to pin a specific model.]`;

  if (message.includes("[App hint:")) return message;
  return `${message.trimEnd()}${suffix}`;
}

function coerceExistingDraft(raw: unknown): TaskAiExistingDraft | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const out: TaskAiExistingDraft = {};
  if (typeof d.title === "string") out.title = d.title.slice(0, 512);
  if (typeof d.dueLocal === "string") out.dueLocal = d.dueLocal.slice(0, 32);
  if (d.dueRepeat === null) out.dueRepeat = null;
  else if (typeof d.dueRepeat === "string") {
    const r = parseDueRepeatLoose(d.dueRepeat);
    if (r) out.dueRepeat = r;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(req: Request) {
  const key = geminiApiKey();
  if (!key) {
    return Response.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 503 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: TaskAiFillRequestBody;
  try {
    body = (await req.json()) as TaskAiFillRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LEN) {
    return Response.json({ error: `prompt exceeds ${MAX_PROMPT_LEN} characters` }, { status: 400 });
  }

  const ctx = body.context;
  if (!ctx || typeof ctx.timeZone !== "string" || typeof ctx.nowIso !== "string" || !Array.isArray(ctx.members)) {
    return Response.json({ error: "context.timeZone, context.nowIso, and context.members are required" }, { status: 400 });
  }

  const existingDraft = coerceExistingDraft(ctx.existingDraft);

  const allowedIds = new Set(ctx.members.map((m) => m.userId).filter((id) => typeof id === "string" && id.length > 0));

  const resolved = await resolveModelForRequest(key);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 503 });
  }
  const model = resolved.model;
  const url = `${GEMINI_URL.replace("{model}", encodeURIComponent(model))}?key=${encodeURIComponent(key)}`;

  const userId = session.user.id;

  const turnBody: TaskAiFillRequestBody = {
    prompt,
    context: { ...ctx, existingDraft: existingDraft ?? undefined },
  };

  const geminiBody = {
    systemInstruction: { parts: [{ text: TASK_AI_SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: buildTaskFillUserTurn(turnBody, userId) }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: GEMINI_TASK_FILL_RESPONSE_SCHEMA,
    },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch {
    return Response.json({ error: "Could not reach the AI provider." }, { status: 502 });
  }

  const rawText = await geminiRes.text();
  let parsed: GeminiGenerateResponse;
  try {
    parsed = JSON.parse(rawText) as GeminiGenerateResponse;
  } catch {
    return Response.json({ error: "Invalid response from AI provider." }, { status: 502 });
  }

  if (!geminiRes.ok || parsed.error) {
    const rawMsg = parsed.error?.message || rawText.slice(0, 1200) || geminiRes.statusText;
    const msg = enrichGeminiErrorMessage(rawMsg || "AI request failed", model);
    return Response.json({ error: msg }, { status: 502 });
  }

  const candidate = parsed.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("")?.trim() ?? "";
  if (!text) {
    return Response.json({ error: "Empty AI response" }, { status: 502 });
  }

  let data: unknown =
    (() => {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    })();

  if (data === null || typeof data !== "object") {
    data = extractJsonObjectFromModelText(text);
  }

  if (data === null || typeof data !== "object") {
    const tail = text.length > 280 ? `${text.slice(0, 280)}…` : text;
    const fr = candidate?.finishReason ? ` (finishReason=${candidate.finishReason})` : "";
    return Response.json(
      {
        error: `AI did not return parseable JSON.${fr} First part of output: ${JSON.stringify(tail)}`,
      },
      { status: 502 },
    );
  }

  const result = normalizeTaskAiFillPayload(data, allowedIds);
  if (taskAiFillResultIsEmpty(result)) {
    return Response.json({ error: "I failed to understand, please try again!" }, { status: 422 });
  }

  return Response.json({ result });
}
