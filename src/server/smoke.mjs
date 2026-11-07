// Run after npm run build. Exercises the actual npm start entrypoint on localhost.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const directory = mkdtempSync(path.join(os.tmpdir(), "quiz-smoke-"));
const origin = "http://127.0.0.1:3101";
const child = spawn("npm", ["start"], {
  env: {
    ...process.env,
    APP_ENV: "test",
    HAM_MODE: "fixture",
    PUBLIC_ORIGIN: origin,
    HOST: "127.0.0.1",
    PORT: "3101",
    DATABASE_PATH: path.join(directory, "quiz.sqlite"),
  },
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let cookie = "";
async function request(route, init = {}) {
  const res = await fetch(`${origin}${route}`, {
    ...init,
    headers: { cookie, ...init.headers },
    redirect: "manual",
  });
  const next = res.headers.get("set-cookie");
  if (next) cookie = next.split(";")[0];
  return res;
}
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Startup timed out")),
      30000,
    );
    child.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Server exited during startup"));
    });
    child.stdout.on("data", (data) => {
      if (data.toString().includes("HAM Quiz listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  assert.deepEqual(await (await request("/api/health")).json(), { ok: true });
  assert.deepEqual(await (await request("/api/session")).json(), {
    signedIn: false,
    authMode: "fixture",
  });
  const login = await request("/api/auth/login?return_to=/packs");
  const authorize = new URL(login.headers.get("location"));
  const consent = await request(authorize.pathname + authorize.search);
  assert.ok(
    (await consent.text()).includes("This is not HAM"),
    "Fixture consent stamp is missing",
  );
  const form = new URLSearchParams(authorize.searchParams);
  form.set("username", "smoke");
  const decision = await request("/__ham/authorize/decide", {
    method: "POST",
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const callback = new URL(decision.headers.get("location"));
  const returned = await request(callback.pathname + callback.search);
  assert.equal(returned.headers.get("location"), "/packs");
  const session = await (await request("/api/session")).json();
  assert.equal(session.signedIn, true);
  assert.equal(session.user.name, "smoke");
  assert.equal((await request("/")).status, 200);
  const rejected = await new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${origin.replace("http:", "ws:")}/ws?room=BCDFG&role=host`,
      { headers: { cookie, origin: "https://invalid.example" } },
    );
    ws.on("unexpected-response", (_, res) => {
      res.resume();
      ws.terminate();
      resolve(res.statusCode);
    });
    ws.on("error", () => undefined);
    ws.on("open", () => {
      ws.terminate();
      reject(new Error("Wrong-Origin socket was accepted"));
    });
  });
  assert.equal(rejected, 403);
  console.log(
    "Production build smoke passed: health, anonymous session, fixture consent/callback, signed-in session, Next page, WebSocket Origin rejection.",
  );
  console.log(
    "Accepted production room handshake requires the parallel engine implementation; injected-engine WebSocket tests cover acceptance.",
  );
} finally {
  const exit = new Promise((resolve) => child.once("exit", resolve));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* Already stopped. */
  }
  await Promise.race([
    exit,
    new Promise((resolve) => setTimeout(resolve, 5000).unref()),
  ]);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* Normal graceful shutdown. */
  }
  rmSync(directory, { recursive: true, force: true });
}
