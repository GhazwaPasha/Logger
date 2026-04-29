import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@work-ledger/db"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
