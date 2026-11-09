import { build } from "esbuild";
await build({
  entryPoints: ["src/server/main.ts"],
  outfile: "dist/server.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  packages: "external",
  alias: { "@": "./src" },
});
await build({
  entryPoints: ["next.config.ts"],
  outfile: "dist/next.config.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
});
