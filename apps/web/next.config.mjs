import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
// Prefer repo root env over inherited OS/user vars (e.g. stale DATABASE_URL on PATH).
loadEnv({ path: path.join(repoRoot, ".env"), override: true });
loadEnv({ path: path.join(repoRoot, ".env.local"), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@work-ledger/db"],
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      {
        source: "/app/w/:workspaceId/add-organization",
        destination: "/:workspaceId/add-workspace",
        permanent: true,
      },
      {
        source: "/app/w/:workspaceId/:path*",
        destination: "/:workspaceId/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Proxy the MCP endpoint through this app's own origin, so the URL anyone connects an AI
    // agent to is the product's domain, not the API's separate Render hosting domain.
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
    return [
      {
        source: "/mcp",
        destination: `${apiBase}/mcp`,
      },
    ];
  },
};

export default nextConfig;
