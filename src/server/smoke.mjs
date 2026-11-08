// Run after npm run build. Plays one real-engine clue through the actual npm start entrypoint.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

const directory = mkdtempSync(path.join(os.tmpdir(), "quiz-smoke-"));
const origin = "http://127.0.0.1:3401";
const child = spawn("npm", ["start"], {
  env: {
    ...process.env,
    APP_ENV: "test",
    HAM_MODE: "fixture",
    PUBLIC_ORIGIN: origin,
    HOST: "127.0.0.1",
    PORT: "3401",
    DATABASE_PATH: path.join(directory, "quiz.sqlite"),
  },
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});
const sockets = [];
class Browser {
  cookie = "";
  csrf = "";
  async request(route, init = {}) {
    const res = await fetch(`${origin}${route}`, {
      ...init,
      headers: { cookie: this.cookie, ...init.headers },
      redirect: "manual",
    });
    const next = res.headers.get("set-cookie");
    if (next) this.cookie = next.split(";")[0];
    return res;
  }
  mutate(route, body) {
    return this.request(route, {
      method: "POST",
      headers: { origin, "x-quiz-csrf": this.csrf, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async signIn(name) {
    const login = await this.request("/api/auth/login?return_to=/packs");
    const authorize = new URL(login.headers.get("location"));
    const consent = await this.request(authorize.pathname + authorize.search);
    assert.ok(
      (await consent.text()).includes("This is not HAM"),
      "Fixture consent stamp is missing",
    );
    const form = new URLSearchParams(authorize.searchParams);
    form.set("username", name);
    const decision = await this.request("/__ham/authorize/decide", {
      method: "POST",
      headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const callback = new URL(decision.headers.get("location"));
    const returned = await this.request(callback.pathname + callback.search);
    assert.equal(returned.headers.get("location"), "/packs");
    const session = await (await this.request("/api/session")).json();
    assert.equal(session.signedIn, true);
    assert.equal(session.user.name, name);
    this.csrf = session.csrfToken;
    return session.user.id;
  }
}
async function socket(code, role, browser) {
  const ws = new WebSocket(`${origin.replace("http:", "ws:")}/ws?room=${code}&role=${role}`, {
    headers: { cookie: browser.cookie, origin },
  });
  sockets.push(ws);
  const messages = [];
  const changed = new Set();
  ws.on("message", (data) => {
    messages.push(JSON.parse(data.toString()));
    changed.forEach((fn) => fn());
  });
  function waitFor(read) {
    const existing = read();
    if (existing !== undefined) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        changed.delete(check);
        reject(new Error("Production socket response timed out"));
      }, 5000);
      const check = () => {
        const value = read();
        if (value === undefined) return;
        changed.delete(check);
        clearTimeout(timeout);
        resolve(value);
      };
      changed.add(check);
    });
  }
  const current = () => messages.findLast((m) => m.t === "view")?.view;
  async function view(predicate) {
    return waitFor(() => (predicate(current()) ? current() : undefined));
  }
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  await view((v) => !!v);
  return {
    messages,
    view,
    async send(cmd) {
      const id = randomUUID();
      ws.send(JSON.stringify({ t: "cmd", id, cmd }));
      const ack = await waitFor(() => messages.find((m) => m.t === "ack" && m.id === id));
      assert.equal(ack.ok, true, `${cmd.type} rejected: ${ack.error}`);
      return view((v) => v?.revision >= ack.revision);
    },
  };
}
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Startup timed out")), 30000);
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
  const host = new Browser();
  assert.deepEqual(await (await host.request("/api/health")).json(), { ok: true });
  assert.deepEqual(await (await host.request("/api/session")).json(), {
    signedIn: false,
    authMode: "fixture",
  });
  // A crawler has no HAM session. Static art and metadata must be public.
  for (const card of ["home", "invite"]) {
    const image = await host.request(`/og/${card}.png`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.headers.get("cache-control"), "public, max-age=86400");
    assert.equal(image.headers.has("cross-origin-resource-policy"), false);
    const bytes = new Uint8Array(await image.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  for (const [route, card] of [
    ["/", "home"],
    ["/r/BCDFG", "invite"],
    ["/r/bcdfg", "invite"],
    ["/r/private-input", "invite"],
    ["/packs", "home"],
    ["/host/BCDFG", "home"],
    ["/display/BCDFG", "home"],
  ]) {
    const page = await host.request(route, { headers: { "user-agent": "Discordbot" } });
    assert.equal(page.status, 200);
    const html = await page.text();
    const head = html.split("</head>")[0];
    // Packs is prerendered at build time; dynamic routes inherit the startup origin.
    const imageOrigin = route === "/packs" ? "https://quiz.teamham.world" : origin;
    assert.ok(
      head.includes(`<meta property="og:image" content="${imageOrigin}/og/${card}.png"`),
      `${route}: expected ${imageOrigin}/og/${card}.png; received ${head.match(/<meta property="og:image"[^>]*>/)?.[0]}`,
    );
    assert.ok(head.includes('<meta name="twitter:card" content="summary_large_image"'));
    if (route === "/r/private-input") assert.ok(!head.includes("private-input"));
    if (route === "/r/BCDFG" || route === "/r/bcdfg") {
      assert.ok(head.includes("Join room BCDFG · HAM Quiz"));
      assert.ok(head.includes(`<meta property="og:url" content="${origin}/r/BCDFG"`));
    }
  }
  await host.signIn("smoke-host");
  for (const route of ["/", "/packs", "/r/BCDFG", "/host/BCDFG", "/display/BCDFG"]) {
    const page = await host.request(route);
    assert.equal(page.status, 200);
    assert.ok(page.headers.get("content-type").includes("text/html"));
    assert.ok(page.headers.get("content-security-policy").includes("frame-ancestors 'none'"));
    assert.equal(page.headers.get("x-frame-options"), "DENY");
    assert.equal(page.headers.get("referrer-policy"), "same-origin");
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    assert.equal(page.headers.has("strict-transport-security"), false);
    await page.text();
  }
  const rejected = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`${origin.replace("http:", "ws:")}/ws?room=BCDFG&role=host`, {
      headers: { cookie: host.cookie, origin: "https://invalid.example" },
    });
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
  const created = await host.mutate("/api/rooms", {});
  assert.equal(created.status, 201);
  const { code } = await created.json();
  const a = await socket(code, "host", host);
  const players = [];
  for (let i = 0; i < 2; i++) {
    const browser = new Browser();
    const id = await browser.signIn(`smoke-player-${i}`);
    assert.equal((await browser.mutate(`/api/rooms/${code}/join`)).status, 200);
    players.push({ id, wire: await socket(code, "player", browser) });
  }
  const link = await (await host.mutate(`/api/rooms/${code}/display-link`)).json();
  const display = new Browser();
  const key = new URLSearchParams(new URL(link.url).hash.slice(1)).get("key");
  assert.equal((await display.mutate("/api/display/claim", { code, key })).status, 204);
  const d = await socket(code, "display", display);
  await a.send({
    type: "updateSettings",
    patch: { wagerClues: [0, 0], timers: { enabled: false } },
  });
  await a.send({ type: "startGame" });
  const board = await a.send({ type: "continue" });
  const cell = board.board.categories[0].cells[0];
  const clue = await a.send({ type: "selectClue", clueId: cell.clueId });
  for (const wire of [d, ...players.map((p) => p.wire)]) {
    const publicView = await wire.view((v) => v?.revision === clue.revision);
    assert.equal(publicView.clue.answer, null);
    assert.ok(!JSON.stringify(publicView).includes(clue.clue.answer));
    assert.ok(
      publicView.board.categories.every((c) => c.cells.every((cell) => !("wager" in cell))),
    );
  }
  await a.send({ type: "openBuzzers", clueId: cell.clueId });
  await players[0].wire.send({ type: "buzz", clueId: cell.clueId });
  const answering = await a.view((v) => v?.clue?.stage === "answering");
  assert.equal(answering.clue.answeringPlayerId, players[0].id);
  const judged = await a.send({
    type: "judge",
    clueId: cell.clueId,
    attemptId: answering.clue.attempts[0].id,
    correct: true,
  });
  assert.equal(judged.players.find((p) => p.id === players[0].id).score, cell.value);
  const revealed = await a.send({ type: "reveal", clueId: cell.clueId });
  for (const wire of [d, ...players.map((p) => p.wire)]) {
    assert.equal(
      (await wire.view((v) => v?.revision === revealed.revision)).clue.answer,
      clue.clue.answer,
    );
  }
  const returned = await a.send({ type: "returnToBoard", clueId: cell.clueId });
  assert.equal(returned.phase, "board");
  assert.equal(returned.board.categories[0].cells[0].state, "completed");
  for (const wire of [d, ...players.map((p) => p.wire)]) {
    const v = await wire.view((v) => v?.revision === returned.revision);
    assert.equal(v.players.find((p) => p.id === players[0].id).score, cell.value);
  }
  console.log(
    "Production build smoke passed: health, session, public social cards and metadata, fixture OAuth, Next pages and security headers, Origin rejection, room/join/display claim, select/open/buzz/judge/reveal/board, public privacy and score convergence.",
  );
} finally {
  sockets.forEach((ws) => ws.close());
  const exit = new Promise((resolve) => child.once("exit", resolve));
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* Already stopped. */
  }
  await Promise.race([exit, new Promise((resolve) => setTimeout(resolve, 5000).unref())]);
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    /* Normal graceful shutdown. */
  }
  rmSync(directory, { recursive: true, force: true });
}
