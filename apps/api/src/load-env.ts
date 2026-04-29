import { config as loadEnv } from "dotenv";
import { join } from "path";

const repoRoot = join(__dirname, "..", "..", "..");
loadEnv({ path: join(repoRoot, ".env"), override: true });
loadEnv({ path: join(repoRoot, ".env.local"), override: true });
