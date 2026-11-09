import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { chromium, defineConfig } from "@playwright/test";

/*
  End-to-end tests against the real server: `npm run test:e2e`.

  - The web server is tests/e2e/start-server.mjs: it builds the app, then runs
    the production bundle on http://127.0.0.1:3501 with the local HAM sign-in
    fixture and a fresh temporary SQLite database. Set E2E_SKIP_BUILD=1 to
    reuse an existing build while iterating.
  - Every test drives separate browser contexts (host laptop, TV, phones), so
    each one has its own cookies, like separate devices.
  - Tests run one at a time (workers: 1). They share one server, and the
    server rate-limits sign-ins and sockets per IP address.

  Browser: Chromium. If the Chromium build this Playwright version expects is
  not installed (`npx playwright install chromium`), the config falls back to
  the newest Chromium build already in the Playwright cache
  (~/.cache/ms-playwright or PLAYWRIGHT_BROWSERS_PATH), preferring the headless
  shell. PLAYWRIGHT_CHROMIUM_PATH overrides both.
*/

const PORT = Number(process.env.E2E_PORT ?? 3501);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function cachedChromium(): string | undefined {
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(root)) return undefined;
  const builds = readdirSync(root)
    .map((name) => /^(chromium_headless_shell|chromium)-(\d+)$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    // Newest revision first; at the same revision prefer the headless shell.
    .sort((a, b) => Number(b[2]) - Number(a[2]) || (a[1] === "chromium_headless_shell" ? -1 : 1));
  for (const [dir, kind] of builds) {
    const base = path.join(root, dir);
    const candidates =
      kind === "chromium_headless_shell"
        ? readdirSync(base).map((sub) => path.join(base, sub, "chrome-headless-shell"))
        : readdirSync(base).flatMap((sub) => [
            path.join(base, sub, "chrome"),
            path.join(base, sub, "Chromium.app", "Contents", "MacOS", "Chromium"),
          ]);
    const found = candidates.find((file) => existsSync(file));
    if (found) return found;
  }
  return undefined;
}

function chromiumExecutable(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  try {
    if (existsSync(chromium.executablePath())) return undefined; // Playwright's own build is installed.
  } catch {
    // Unknown platform: fall through to the cache.
  }
  return cachedChromium();
}

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "test-results/e2e-report" }]]
    : [["list"]],
  outputDir: "test-results/e2e",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    launchOptions: { executablePath: chromiumExecutable() },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/e2e/start-server.mjs",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
