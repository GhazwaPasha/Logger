/**
 * Cursor `stop` hook: append one audit line (no chat transcript available).
 * Stdout must be JSON for Cursor; empty object = continue without follow-up.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const logPath = path.join(
  repoRoot,
  "second-memory",
  "Inbox",
  "_session-log.txt",
);

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

try {
  const obj = input.trim() ? JSON.parse(input) : {};
  const line = `${new Date().toISOString()} status=${obj.status ?? "?"} loop=${obj.loop_count ?? 0} conversation_id=${obj.conversation_id ?? "?"}\n`;
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, line, "utf8");
} catch {
  // Fail open — never block the agent on logging.
}

process.stdout.write("{}");
