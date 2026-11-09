import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `next dev` from rewriting AGENTS.md/CLAUDE.md; this repo maintains its own.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/og/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
