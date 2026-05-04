/**
 * Pull a single JSON object from model output when `responseMimeType: application/json`
 * still returns prose, markdown fences, or leading/trailing chatter.
 */
export function extractJsonObjectFromModelText(raw: string): unknown | null {
  let s = raw.trim();
  if (!s) return null;

  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\r?\n?/i, "");
    const fenceEnd = s.lastIndexOf("```");
    if (fenceEnd >= 0) s = s.slice(0, fenceEnd).trim();
  }

  const tryParseObject = (text: string): unknown | null => {
    try {
      const v = JSON.parse(text) as unknown;
      return typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };

  const direct = tryParseObject(s);
  if (direct) return direct;

  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        return tryParseObject(s.slice(start, i + 1));
      }
    }
  }

  return null;
}
