import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Browser, harness, type Harness } from "./test-harness";
import type { ServerMessage } from "@/features/network/protocol";
import { parseClientMessage } from "./validation";

let h: Harness;
afterEach(async () => {
  vi.useRealTimers();
  await h?.stop();
});
async function setup() {
  h = await harness();
  const host = new Browser(h),
    player = new Browser(h);
  await host.signIn("host");
  await player.signIn("player");
  const code = await host.createRoom();
  await player.mutate(`/api/rooms/${code}/join`);
  return { host, player, code, room: h.app.rooms.get(code)! };
}
async function socket(
  code: string,
  role: string,
  cookie: string,
  origin = "http://127.0.0.1:3101",
) {
  const ws = new WebSocket(
    `${h.base.replace("http:", "ws:")}/ws?room=${code}&role=${role}`,
    { headers: { cookie, origin } },
  );
  const messages: ServerMessage[] = [];
  ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  await vi.waitFor(() =>
    expect(messages.some((m) => m.t === "view")).toBe(true),
  );
  return { ws, messages };
}
async function rejectedSocket(
  code: string,
  role: string,
  cookie: string,
  origin?: string,
) {
  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(
      `${h.base.replace("http:", "ws:")}/ws?room=${code}&role=${role}`,
      { headers: { cookie, origin: origin ?? "http://127.0.0.1:3101" } },
    );
    ws.on("unexpected-response", (_, res) => {
      res.resume();
      ws.terminate();
      resolve(res.statusCode!);
    });
    ws.on("error", () => undefined);
    ws.on("open", () => {
      ws.terminate();
      reject(new Error("Unexpected successful connection"));
    });
  });
}
const ack = (messages: ServerMessage[], id: string) =>
  messages.find((m) => m.t === "ack" && m.id === id);

describe("HTTP room and pack boundaries", () => {
  it("creates a host, joins lobby players, prevents host self-join, leaves and waits during play", async () => {
    const { host, player, code, room } = await setup();
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{5}$/);
    expect(
      await (await host.request(`/api/rooms/${code}`)).json(),
    ).toMatchObject({ myRole: "host", playerCount: 1 });
    expect((await host.mutate(`/api/rooms/${code}/join`)).status).toBe(403);
    expect((await player.mutate(`/api/rooms/${code}/leave`)).status).toBe(204);
    await room.system({ type: "restored" });
    const playing = { ...h.engine.read(room.state), phase: "board" as const };
    room.state = h.engine.write(playing);
    expect(
      await (await player.mutate(`/api/rooms/${code}/join`)).json(),
    ).toEqual({ role: "waiting" });
  });
  it("lets the engine enforce capacity", async () => {
    const { code } = await setup();
    for (let i = 0; i < 5; i++) {
      const b = new Browser(h);
      await b.signIn(`p${i}`);
      expect((await b.mutate(`/api/rooms/${code}/join`)).status).toBe(200);
    }
    const extra = new Browser(h);
    await extra.signIn("extra");
    expect((await extra.mutate(`/api/rooms/${code}/join`)).status).toBe(409);
  });
  it.each([
    ["POST", "/api/rooms"],
    ["POST", "/api/rooms/BCDFG/join"],
    ["POST", "/api/rooms/BCDFG/leave"],
    ["POST", "/api/rooms/BCDFG/display-link"],
    ["POST", "/api/auth/logout"],
    ["POST", "/api/packs"],
    ["PUT", "/api/packs/own"],
    ["DELETE", "/api/packs/own"],
    ["POST", "/api/packs/own/duplicate"],
  ])("requires exact Origin and CSRF on %s %s", async (method, route) => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("host");
    expect(
      (await b.mutate(route, {}, method, { origin: "https://evil.invalid" }))
        .status,
    ).toBe(403);
    expect(
      (await b.mutate(route, {}, method, { "x-quiz-csrf": "bad" })).status,
    ).toBe(403);
  });
  it("display claim is the anonymous Origin-only CSRF exception", async () => {
    h = await harness();
    const b = new Browser(h);
    expect(
      (
        await b.mutate("/api/display/claim", {}, "POST", {
          origin: "https://evil.invalid",
        })
      ).status,
    ).toBe(403);
  });
  it("copies built-ins with new stored ids, enforces ownership, validates updates and fixes a running copy", async () => {
    const { host, player, room } = await setup();
    const built = (await (await host.request("/api/packs")).json())[0];
    expect((await host.request(`/api/packs/${built.id}`)).status).toBe(404);
    const doc = await (
      await host.mutate(`/api/packs/${built.id}/duplicate`)
    ).json();
    expect(doc.id).not.toBe(built.id);
    expect(doc.pack.id).toBe(doc.id);
    expect((await player.request(`/api/packs/${doc.id}`)).status).toBe(404);
    expect((await player.mutate(`/api/packs/${doc.id}/duplicate`)).status).toBe(
      404,
    );
    expect(
      (await host.mutate(`/api/packs/${doc.id}`, { pack: {} }, "PUT")).status,
    ).toBe(400);
    const before = h.engine.read(room.state).pack!.title;
    expect(
      (
        await host.mutate(
          `/api/packs/${doc.id}`,
          { pack: { ...doc.pack, title: "Edited" } },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(h.engine.read(room.state).pack!.title).toBe(before);
    expect(
      (await host.mutate(`/api/packs/${doc.id}`, undefined, "DELETE")).status,
    ).toBe(204);
  });
});

describe("WebSocket and room actor", () => {
  it("requires identity, exact Origin and membership matching the role", async () => {
    const { code, player, host } = await setup();
    expect(await rejectedSocket(code, "host", "")).toBe(401);
    expect(
      await rejectedSocket(code, "host", host.cookie, "https://evil.invalid"),
    ).toBe(403);
    expect(await rejectedSocket(code, "host", player.cookie)).toBe(403);
    expect(await rejectedSocket(code, "player", host.cookie)).toBe(403);
    expect(await rejectedSocket(code, "display", host.cookie)).toBe(401);
  });
  it("routes private views, rejects player host commands and replays exact ids in strict order", async () => {
    const { code, host, player, room } = await setup();
    const a = await socket(code, "host", host.cookie),
      b = await socket(code, "player", player.cookie);
    expect(a.messages[0]).toMatchObject({
      t: "hello",
      role: "host",
      protocol: 1,
    });
    expect(
      b.messages
        .filter((m) => m.t === "view")
        .every((m) => m.view.audience === "player" && !("settings" in m.view)),
    ).toBe(true);
    const forbidden = randomUUID();
    b.ws.send(
      JSON.stringify({ t: "cmd", id: forbidden, cmd: { type: "startGame" } }),
    );
    await vi.waitFor(() =>
      expect(ack(b.messages, forbidden)).toMatchObject({
        ok: false,
        error: "notAllowed",
      }),
    );
    const id = randomUUID(),
      id2 = randomUUID();
    const before = room.state.revision;
    a.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "pause" } }));
    a.ws.send(JSON.stringify({ t: "cmd", id: id2, cmd: { type: "resume" } }));
    await vi.waitFor(() =>
      expect(ack(a.messages, id2)).toMatchObject({
        ok: true,
        revision: before + 2,
      }),
    );
    a.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "endGame" } }));
    await vi.waitFor(() =>
      expect(
        a.messages.filter((m) => m.t === "ack" && m.id === id),
      ).toHaveLength(2),
    );
    expect(room.state.revision).toBe(before + 2);
    expect(a.messages.filter((m) => m.t === "ack" && m.id === id)[1]).toEqual(
      ack(a.messages, id),
    );
    a.ws.close();
    b.ws.close();
  });
  it("persists before both ack and broadcast, and rolls back in-memory publication on save failure", async () => {
    const { room } = await setup();
    const send = vi.fn((message: ServerMessage) => {
      if (message.t === "ack" || message.t === "view") {
        const row = h.app.db.get<{ state_json: string; recent_json: string }>(
          "SELECT state_json, recent_json FROM rooms WHERE code = ?",
          room.code,
        )!;
        const revision =
          message.t === "ack" && message.ok
            ? message.revision
            : room.state.revision;
        expect(JSON.parse(row.state_json).revision).toBe(revision);
        if (message.t === "ack") expect(row.recent_json).toContain(message.id);
      }
    });
    const c = {
      role: "host" as const,
      publicId: "host",
      sessionHash: h.app.db.get<{ session_hash: string }>(
        "SELECT session_hash FROM sessions WHERE account_id = ?",
        room.hostId,
      )!.session_hash,
      authorizedUntil: Infinity,
      send,
      close: vi.fn(),
    };
    await room.attach(c);
    send.mockClear();
    const id = randomUUID();
    await room.command(c, id, { type: "pause" });
    expect(send.mock.calls[0][0]).toMatchObject({ t: "ack", ok: true });
    const before = room.state.revision,
      spy = vi.spyOn(h.app.db, "run").mockImplementationOnce(() => {
        throw new Error("disk full");
      });
    send.mockClear();
    await expect(
      room.command(c, randomUUID(), { type: "resume" }),
    ).rejects.toThrow("disk full");
    expect(room.state.revision).toBe(before);
    expect(send).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("serializes asynchronous concurrent commands", async () => {
    const { room } = await setup();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = room.run(async () => {
      order.push("first-start");
      await gate;
      order.push("first-end");
    });
    const second = room.run(() => {
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
  it("rotates display keys, revokes old grants and rejects all display commands", async () => {
    const { code, host, player } = await setup();
    expect(
      (await player.mutate(`/api/rooms/${code}/display-link`)).status,
    ).toBe(403);
    const link = await (
        await host.mutate(`/api/rooms/${code}/display-link`)
      ).json(),
      key = new URLSearchParams(new URL(link.url).hash.slice(1)).get("key");
    const display = new Browser(h);
    expect(
      (await display.mutate("/api/display/claim", { code, key })).status,
    ).toBe(204);
    const d = await socket(code, "display", display.cookie);
    expect(d.messages.find((m) => m.t === "view")).toMatchObject({
      view: { audience: "display" },
    });
    const id = randomUUID();
    d.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "pause" } }));
    await vi.waitFor(() =>
      expect(ack(d.messages, id)).toMatchObject({
        ok: false,
        error: "notAllowed",
      }),
    );
    await host.mutate(`/api/rooms/${code}/display-link`);
    await vi.waitFor(() =>
      expect(
        d.messages.some(
          (m) => m.t === "closing" && m.reason === "displayRevoked",
        ),
      ).toBe(true),
    );
    expect(
      (await display.mutate("/api/display/claim", { code, key })).status,
    ).toBe(403);
    expect(await rejectedSocket(code, "display", display.cookie)).toBe(401);
  });
  it("sends signedInElsewhere when a new login supersedes a connected account", async () => {
    const { code, host } = await setup(),
      a = await socket(code, "host", host.cookie);
    const other = new Browser(h);
    await other.signIn("host");
    await vi.waitFor(() =>
      expect(a.messages).toContainEqual({
        t: "closing",
        reason: "signedInElsewhere",
      }),
    );
  });
  it("freshly introspects startGame and blocks outage commands", async () => {
    const { code, host } = await setup(),
      a = await socket(code, "host", host.cookie);
    h.app.fixture!.control.outage = true;
    const id = randomUUID();
    a.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "startGame" } }));
    await vi.waitFor(() =>
      expect(ack(a.messages, id)).toMatchObject({
        ok: false,
        error: "authUnavailable",
      }),
    );
    h.app.fixture!.control.outage = false;
    const revision = h.app.rooms.get(code)!.state.revision;
    a.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "startGame" } }));
    await vi.waitFor(() =>
      expect(
        a.messages.filter((m) => m.t === "ack" && m.id === id),
      ).toHaveLength(2),
    );
    expect(h.app.rooms.get(code)!.state.revision).toBe(revision + 1);
    a.ws.close();
  });
  it("expires idle rooms and closes sockets with roomClosed", async () => {
    const { code, host } = await setup(),
      a = await socket(code, "host", host.cookie);
    h.advance(12 * 3600000 + 1);
    await h.app.tick();
    await vi.waitFor(() =>
      expect(a.messages).toContainEqual({ t: "closing", reason: "roomClosed" }),
    );
    expect(h.app.rooms.has(code)).toBe(false);
  });
  it("fires the engine deadline as timerExpired", async () => {
    const { room } = await setup();
    const timed = {
      ...h.engine.read(room.state),
      deadline: { timerId: "test-timer", at: Date.now() + 10 },
    };
    room.state = h.engine.write(timed);
    room.saveInitial();
    await vi.waitFor(() =>
      expect(h.engine.applied).toContainEqual({
        type: "timerExpired",
        timerId: "test-timer",
      }),
    );
  });
  it("restores durable rooms and replays persisted original acknowledgments after restart", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "quiz-"));
    try {
      h = await harness(path.join(directory, "quiz.sqlite"));
      const host = new Browser(h);
      await host.signIn("host");
      const code = await host.createRoom();
      const first = await socket(code, "host", host.cookie),
        id = randomUUID();
      first.ws.send(JSON.stringify({ t: "cmd", id, cmd: { type: "pause" } }));
      await vi.waitFor(() =>
        expect(ack(first.messages, id)).toMatchObject({ ok: true }),
      );
      const original = ack(first.messages, id);
      await h.stop();
      h = await harness(path.join(directory, "quiz.sqlite"));
      expect(h.engine.applied).toContainEqual({ type: "restored" });
      expect(h.app.rooms.has(code)).toBe(true);
      const second = await socket(code, "host", host.cookie),
        revision = h.app.rooms.get(code)!.state.revision;
      second.ws.send(
        JSON.stringify({ t: "cmd", id, cmd: { type: "endGame" } }),
      );
      await vi.waitFor(() =>
        expect(ack(second.messages, id)).toEqual(original),
      );
      expect(h.app.rooms.get(code)!.state.revision).toBe(revision);
      second.ws.close();
    } finally {
      await h.stop();
      h = undefined as unknown as Harness;
      rmSync(directory, { recursive: true });
    }
  });
  it("changes presence only on first and last sockets of an identity", async () => {
    const { code, host } = await setup(),
      a = await socket(code, "host", host.cookie),
      b = await socket(code, "host", host.cookie);
    const hostPresence = () =>
      h.engine.applied.filter(
        (cmd) => cmd.type === "setPresence" && cmd.target.role === "host",
      );
    expect(hostPresence()).toEqual([
      { type: "setPresence", target: { role: "host" }, connected: true },
    ]);
    a.ws.close();
    await vi.waitFor(() =>
      expect(h.app.rooms.get(code)!.connections.size).toBe(1),
    );
    expect(hostPresence()).toHaveLength(1);
    b.ws.close();
    await vi.waitFor(() => expect(hostPresence()).toHaveLength(2));
    expect(hostPresence().at(-1)).toMatchObject({ connected: false });
  });
  it("revokes connected inactive tokens and renews mutable usernames through system commands", async () => {
    const { code, player } = await setup(),
      a = await socket(code, "player", player.cookie);
    h.app.db.run(
      "UPDATE hamfx_accounts SET username = 'renamed' WHERE username = 'player'",
    );
    h.advance(27000);
    await h.app.tick();
    expect(
      h.engine.applied.some(
        (cmd) => cmd.type === "renamePlayer" && cmd.name === "renamed",
      ),
    ).toBe(true);
    h.app.fixture!.revokeUser("renamed");
    h.advance(27000);
    await h.app.tick();
    await vi.waitFor(() =>
      expect(a.messages).toContainEqual({
        t: "closing",
        reason: "authExpired",
      }),
    );
  });
  it("does not deliver views past a lease or keep presence during provider outage", async () => {
    const { code, player, room } = await setup(),
      a = await socket(code, "player", player.cookie);
    h.app.fixture!.control.outage = true;
    h.advance(30001);
    const before = a.messages.length;
    await room.system({ type: "restored" });
    await h.app.tick();
    await vi.waitFor(() => expect(a.ws.readyState).toBe(WebSocket.CLOSED));
    expect(a.messages.slice(before).some((m) => m.t === "view")).toBe(false);
    expect([...room.connections].some((c) => c.role === "player")).toBe(false);
  });
  it.each([
    { type: "setPack", pack: {} },
    { type: "restored" },
    { type: "timerExpired", timerId: "x" },
    { type: "pause", extra: true },
    { type: "judge", clueId: "x", attemptId: "y", correct: "yes" },
  ])("rejects malformed and privileged client command %#", (cmd) => {
    expect(parseClientMessage({ t: "cmd", id: randomUUID(), cmd })).toBeNull();
  });
});
