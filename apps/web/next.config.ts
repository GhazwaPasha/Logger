import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@work-ledger/db"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
