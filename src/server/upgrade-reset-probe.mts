// Run in a child process: an unhandled upgrade error must fail the process-level regression.
import assert from "node:assert/strict";
import net from "node:net";
import { once } from "node:events";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { engine } from "../features/engine";

const config = loadConfig({
  APP_ENV: "test",
  PORT: "3401",
  PUBLIC_ORIGIN: "http://127.0.0.1:3401",
  DATABASE_PATH: ":memory:",
});
const app = await createApp(config, { engine, timers: false });
const watchdog = setTimeout(() => process.exit(2), 10000);
await app.listen();
let cookie = "";
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${config.publicOrigin}${path}`, {
    ...init,
    redirect: "manual",
    headers: { cookie, ...init.headers },
  });
  cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
  return response;
}
async function reset(origin: string, code: string, during?: Promise<void>) {
  const client = net.connect(config.port, "127.0.0.1");
  client.on("error", () => undefined);
  await once(client, "connect");
  const closed = new Promise<void>((resolve) => client.once("close", () => resolve()));
  await new Promise<void>((resolve) =>
    client.write(
      `GET /ws?room=${code}&role=host HTTP/1.1\r\nHost: localhost\r\nOrigin: ${origin}\r\nCookie: ${cookie}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`,
      () => resolve(),
    ),
  );
  if (during) await during;
  client.resetAndDestroy();
  await closed;
}
try {
  for (let i = 0; i < 4; i++) {
    await reset("https://wrong.invalid", "BCDFG");
    assert.equal((await request("/api/health")).status, 200);
  }
  const login = new URL((await request("/api/auth/login")).headers.get("location")!);
  login.searchParams.set("username", "probe-host");
  const decision = await request("/__ham/authorize/decide", {
    method: "POST",
    headers: {
      origin: config.publicOrigin,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: login.searchParams,
  });
  const callback = new URL(decision.headers.get("location")!);
  assert.equal((await request(callback.pathname + callback.search)).status, 302);
  const { csrfToken } = await (await request("/api/session")).json();
  const { code } = await (
    await request("/api/rooms", {
      method: "POST",
      headers: {
        origin: config.publicOrigin,
        "x-quiz-csrf": csrfToken,
        "content-type": "application/json",
      },
      body: "{}",
    })
  ).json();
  const original = app.fixture!.handle;
  for (const inactive of [false, true]) {
    let entered!: () => void, release!: () => void, socketClosed!: () => void;
    const pending = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const resetSeen = new Promise<void>((resolve) => {
      socketClosed = resolve;
    });
    app.server.once("upgrade", (_, socket) => {
      // Observing close must not install an error listener that would hide the crash.
      socket.once("close", () => socketClosed());
    });
    app.fixture!.handle = async (req) => {
      if (!req.url.endsWith("/introspect")) return original(req);
      const response = await original(req);
      entered();
      await gate;
      return inactive ? Response.json({ active: false }) : response;
    };
    await reset(config.publicOrigin, code, pending);
    await resetSeen; // The peer's RST arrived while fresh introspection was pending.
    release();
    // Drain the upgrade task before checking that it never attached the vanished socket.
    await app.rooms.get(code)!.run(() => undefined);
    assert.equal((await request("/api/health")).status, 200);
    assert.equal(app.rooms.get(code)!.connections.size, 0);
  }
  console.log("Survived wrong-Origin and slow-introspection TCP resets");
} finally {
  clearTimeout(watchdog);
  await app.close();
}
