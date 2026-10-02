import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const contentPath = "src/features/content";
const samplePath = `${contentPath}/samples/sample-pack-3x3.json`;
const nextCli = join(repositoryRoot, "node_modules/next/dist/bin/next");
const nextPackage = JSON.parse(await readFile(join(repositoryRoot, "node_modules/next/package.json"), "utf8"));
const fixture = await mkdtemp("/tmp/opencode/jeoparty-content-boundary-");

function buildFixture() {
  const result = spawnSync(process.execPath, [nextCli, "build"], {
    cwd: fixture,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", TMPDIR: "/tmp/opencode" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 180_000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

try {
  await mkdir(join(fixture, contentPath, "samples"), { recursive: true });
  await mkdir(join(fixture, "app"));
  await symlink(join(repositoryRoot, "node_modules"), join(fixture, "node_modules"), "dir");
  for (const file of ["package.json", "tsconfig.json", samplePath]) {
    await copyFile(join(repositoryRoot, file), join(fixture, file));
  }
  for (const file of ["types.ts", "index.ts", "validate-pack.ts", "load-sample-pack.server.ts"]) {
    await copyFile(join(repositoryRoot, contentPath, file), join(fixture, contentPath, file));
  }
  // Both the external fixture and its dependency symlink must be inside the
  // Turbopack filesystem root. This changes no compiler aliases or import rules.
  await writeFile(join(fixture, "next.config.mjs"), `
export default { turbopack: { root: ${JSON.stringify(parse(repositoryRoot).root)} } };
`);
  await writeFile(join(fixture, "app/layout.tsx"), `
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
`);
  await writeFile(join(fixture, "app/page.tsx"), `
import { loadSamplePack } from "../src/features/content/load-sample-pack.server";

export const dynamic = "force-static";

export default async function Page() {
  const result = await loadSamplePack();
  if (!result.ok) throw new Error("The server fixture failed content validation.");
  const count = result.data.categories.reduce((total, category) => total + category.clues.length, 0);
  return <main>{count}</main>;
}
`);

  console.log(`Checking content boundary with repository Next ${nextPackage.version} (Turbopack).`);
  const serverBuild = buildFixture();
  if (serverBuild.status !== 0) {
    throw new Error(`Server fixture build failed (exit ${serverBuild.status}):\n${serverBuild.output}`);
  }
  const html = await readFile(join(fixture, ".next/server/app/index.html"), "utf8");
  if (!html.includes("<main>9</main>")) {
    throw new Error("The server fixture did not prerender the nine-clue count.");
  }
  console.log("PASS: server page loaded and validated the sample, rendering only the clue count 9.");

  const tracePath = join(fixture, ".next/server/app/page.js.nft.json");
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  const sampleIsTraced = Array.isArray(trace.files) && trace.files.some(
    (file) => typeof file === "string" && resolve(dirname(tracePath), file) === join(fixture, samplePath),
  );
  if (!sampleIsTraced) throw new Error("The server page file trace does not include the sample JSON.");
  console.log("PASS: server page file trace includes the answer-bearing sample JSON.");

  // Use a fresh build directory; no marker mocks or root app edits are involved.
  await rm(join(fixture, ".next"), { recursive: true, force: true });
  await writeFile(join(fixture, "app/page.tsx"), `
"use client";

import { loadSamplePack } from "../src/features/content/load-sample-pack.server";

export default function Page() {
  return <button onClick={() => { void loadSamplePack(); }}>Boundary check</button>;
}
`);
  const clientBuild = buildFixture();
  if (clientBuild.status === 0) throw new Error("Next unexpectedly allowed a client import of the marked loader.");
  if (!/server-only/i.test(clientBuild.output) || !/Client Component/i.test(clientBuild.output)) {
    throw new Error(`Client build failed without the expected boundary diagnostic:\n${clientBuild.output}`);
  }
  console.log("PASS: Next rejected the client import with a server-only / Client Component diagnostic.");
} finally {
  await rm(fixture, { recursive: true, force: true });
  console.log("Removed the isolated temporary Next fixture; repository build output was untouched.");
}
