import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep `next dev` from rewriting AGENTS.md/CLAUDE.md; this repo maintains its own.
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
