// Starts the real HAM Quiz server for the Playwright end-to-end tests.
//
// 1. Builds the app (`npm run build`) unless E2E_SKIP_BUILD=1.
// 2. Runs the production bundle (dist/server.cjs) on 127.0.0.1:3501 with the
//    local HAM sign-in fixture and a brand-new SQLite database in a temp folder.
// 3. Deletes that folder when Playwright stops the server.
//
// APP_ENV=test is what allows the fixture with a production build; production
// configuration always refuses it (see docs/DEPLOYMENT.md).
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const port = process.env.E2E_PORT ?? "3501";
const origin = `http://127.0.0.1:${port}`;

if (process.env.E2E_SKIP_BUILD !== "1") {
  const build = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const directory = mkdtempSync(path.join(os.tmpdir(), "ham-quiz-e2e-"));
const server = spawn(process.execPath, ["dist/server.cjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    APP_ENV: "test",
    HAM_MODE: "fixture",
    HOST: "127.0.0.1",
    PORT: port,
    PUBLIC_ORIGIN: origin,
    DATABASE_PATH: path.join(directory, "quiz.sqlite"),
  },
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  server.kill(signal);
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
server.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(code ?? 0);
});
