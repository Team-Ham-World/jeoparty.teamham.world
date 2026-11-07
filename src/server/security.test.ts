import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { engine } from "@/features/engine";
import sample from "@/features/content/samples/sample-pack-3x3.json";
import { Browser, harness, type Harness } from "./test-harness";
import { connect, start, table } from "./integration-harness";
import { loadConfig } from "./config";
import { securityHeaders } from "./http";
import { Packs } from "./packs";
import { Database } from "./db";
import { createHamClient } from "./ham/client";

let h: Harness | undefined;
afterEach(async () => {
  await h?.stop();
  h = undefined;
  vi.restoreAllMocks();
});

describe("security review regressions", () => {
  it("keeps the process serving after TCP resets before refusal and during fresh upgrade introspection", async () => {
    const result = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "src/server/upgrade-reset-probe.mts"],
      { timeout: 15000 },
    );
    expect(result.stdout).toContain(
      "Survived wrong-Origin and slow-introspection TCP resets",
    );
  }, 20000);

  it.each([true, false])(
    "keys all IP limits on the trusted right-most peer only when TRUST_PROXY=%s",
    async (trustProxy) => {
      h = await harness(":memory:", { trustProxy });
      const b = new Browser(h);
      const headers = (left: string, peer = "192.0.2.1") => ({
        "x-forwarded-for": `${left}, ${peer}`,
      });
      // Different spoofed prefixes cannot escape a bucket. Different real peers can.
      const cases = [
        { route: "/api/auth/login", max: 20, status: 302 },
        { route: "/api/auth/callback", max: 30, status: 302 },
        { route: "/api/display/claim", max: 30, status: 400 },
        { route: "/api/health", max: 600, status: 200 },
      ];
      for (const item of cases) {
        h.advance(60001);
        for (let i = 0; i < item.max; i++) {
          const response = item.route.endsWith("claim")
            ? await b.mutate(item.route, {}, "POST", headers(String(i)))
            : await b.request(item.route, { headers: headers(String(i)) });
          expect(response.status).toBe(item.status);
        }
        const send = (peer: string) =>
          item.route.endsWith("claim")
            ? b.mutate(item.route, {}, "POST", headers("spoof", peer))
            : b.request(item.route, { headers: headers("spoof", peer) });
        expect((await send("192.0.2.1")).status).toBe(429);
        expect((await send("192.0.2.2")).status).toBe(
          trustProxy ? item.status : 429,
        );
      }
      h.advance(60001);
      async function upgrade(peer: string, prefix: number) {
        return new Promise<number>((resolve, reject) => {
          const ws = new WebSocket(
            `${h!.base.replace("http:", "ws:")}/ws?room=BCDFG&role=host`,
            {
              headers: {
                origin: h!.app.config.publicOrigin,
                ...headers(String(prefix), peer),
              },
            },
          );
          ws.on("error", () => undefined);
          ws.on("unexpected-response", (_, response) => {
            response.resume();
            ws.terminate();
            resolve(response.statusCode!);
          });
          ws.on("open", () => {
            ws.terminate();
            reject(new Error("Unexpected connection"));
          });
        });
      }
      for (let i = 0; i < 60; i++)
        expect(await upgrade("192.0.2.1", i)).toBe(404);
      expect(await upgrade("192.0.2.1", 61)).toBe(429);
      expect(await upgrade("192.0.2.2", 62)).toBe(trustProxy ? 404 : 429);
    },
    20000,
  );

  it("keeps per-account limits even when a client changes its proxy peer address", async () => {
    h = await harness(":memory:", { trustProxy: true });
    const b = new Browser(h);
    await b.signIn("host");
    const code = await b.createRoom();
    for (let i = 0; i < 30; i++)
      expect(
        (
          await b.mutate(`/api/rooms/${code}/join`, {}, "POST", {
            "x-forwarded-for": `192.0.2.${i}`,
          })
        ).status,
      ).toBe(403);
    expect(
      (
        await b.mutate(`/api/rooms/${code}/join`, {}, "POST", {
          "x-forwarded-for": "192.0.2.99",
        })
      ).status,
    ).toBe(429);
  });

  it.each([
    ["GET", "/api/session"],
    ["POST", "/api/rooms"],
    ["GET", "/api/rooms/BCDFG"],
    ["POST", "/api/rooms/BCDFG/join"],
    ["POST", "/api/rooms/BCDFG/leave"],
    ["POST", "/api/rooms/BCDFG/display-link"],
    ["GET", "/api/packs"],
    ["GET", "/api/packs/own"],
    ["POST", "/api/packs"],
    ["PUT", "/api/packs/own"],
    ["DELETE", "/api/packs/own"],
    ["POST", "/api/packs/own/duplicate"],
    ["POST", "/api/auth/logout"],
  ])(
    "freshly introspects protected HTTP %s %s within an existing lease",
    async (method, route) => {
      h = await harness();
      const b = new Browser(h);
      await b.signIn("host");
      const session = h.app.auth.sessionFromCookieHeader(b.cookie)!;
      const verified = h.app.db.get<{ verified_at: number }>(
        "SELECT verified_at FROM sessions WHERE session_hash = ?",
        session.session_hash,
      );
      h.app.fixture!.control.outage = true;
      const response =
        method === "GET"
          ? await b.request(route)
          : await b.mutate(route, {}, method);
      expect(response.status).toBe(503);
      expect(
        h.app.db.get(
          "SELECT verified_at FROM sessions WHERE session_hash = ?",
          session.session_hash,
        ),
      ).toEqual(verified);
      h.app.fixture!.control.outage = false;
      h.app.fixture!.revokeUser("host");
      const inactive =
        method === "GET"
          ? await b.request(route)
          : await b.mutate(route, {}, method);
      expect(inactive.status).toBe(401);
    },
  );

  it("keeps a socket lease for low-latency commands but freshly verifies connect and every startGame retry", async () => {
    h = await harness(":memory:", { engine });
    const { a, code, host } = await table(h);
    await start(a, sample.id);
    const inspect = vi.spyOn(h.app.fixture!, "handle");
    h.app.fixture!.control.outage = true;
    expect(await a.send({ type: "pause" })).toMatchObject({ ok: true });
    expect(inspect).not.toHaveBeenCalled();
    const id = randomUUID();
    expect(await a.send({ type: "startGame" }, id)).toMatchObject({
      error: "authUnavailable",
    });
    expect(await a.send({ type: "startGame" }, id)).toMatchObject({
      error: "authUnavailable",
    });
    expect(
      inspect.mock.calls.filter(([req]) => req.url.endsWith("/introspect")),
    ).toHaveLength(2);
    await expect(connect(h, code, "host", host)).rejects.toThrow("503");
    h.advance(30001);
    await h.app.tick();
    await a.until(() => a.closeCode ?? undefined);
    expect(
      [...h.app.rooms.get(code)!.connections].some((c) => c.role === "host"),
    ).toBe(false);
  });

  it("measures a renewed lease from introspection start, including provider latency", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("host");
    const session = h.app.auth.sessionFromCookieHeader(b.cookie)!;
    const original = h.app.fixture!.handle;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.app.fixture!.handle = async (req) => {
      const response = await original(req);
      if (req.url.endsWith("/introspect")) await gate;
      return response;
    };
    const before = session.verified_at!;
    const pending = h.app.auth.verify(session.session_hash, { fresh: true });
    h.advance(10000);
    release();
    expect(await pending).toEqual({ status: "active", until: before + 30000 });
    h.advance(20001);
    // A result held for more than the lease cannot authorize new work.
    const tooSlow = h.app.auth.verify(session.session_hash, { fresh: true });
    h.advance(30001);
    expect(await tooSlow).toEqual({ status: "unavailable" });
  });

  it("rejects oversized bodies outside packs while pack routes allow up to 1 MiB", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("host");
    const big = { padding: "x".repeat(4096) };
    for (const route of [
      "/api/rooms",
      "/api/display/claim",
      "/api/auth/logout",
      "/api/rooms/BCDFG/leave",
      "/api/rooms/BCDFG/display-link",
    ])
      expect((await b.mutate(route, big)).status).toBe(413);
    expect(
      (
        await b.mutate("/api/packs", {
          pack: { ...sample, extension: "x".repeat(5000) },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await b.mutate("/api/packs", {
          pack: { ...sample, extension: "x".repeat(1024 * 1024) },
        })
      ).status,
    ).toBe(413);
    // Chunked uploads must obey the default limit too, without trusting Content-Length.
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers: {
        origin: h.app.config.publicOrigin,
        "content-type": "application/json",
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(big)));
          controller.close();
        },
      }),
      duplex: "half",
    };
    const response = await fetch(`${h.base}/api/display/claim`, init);
    expect(response.status).toBe(413);
  });

  it("caps pack count and UTF-8 serialized size, permits updates/deletions, and lists stored summaries", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("host");
    const owner = h.app.auth.identityFor(
      h.app.auth.sessionFromCookieHeader(b.cookie),
    )!.account.account_id;
    const packs = new Packs(h.app.db);
    const docs = Array.from({ length: 50 }, () => packs.save(sample, owner));
    const full = await b.mutate(`/api/packs/${sample.id}/duplicate`);
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({
      error: "conflict",
      message: expect.stringContaining("50 packs"),
    });
    const doc = docs[0];
    expect(
      (
        await b.mutate(
          `/api/packs/${doc.id}`,
          { pack: { ...doc.pack, title: "Updated" } },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (await b.mutate(`/api/packs/${doc.id}`, undefined, "DELETE")).status,
    ).toBe(204);
    const tooBig = await b.mutate("/api/packs", {
      pack: { ...sample, extension: "é".repeat(128 * 1024) },
    });
    expect(tooBig.status).toBe(413);
    expect(await tooBig.json()).toMatchObject({
      error: "badRequest",
      message: expect.stringContaining("256 KiB"),
    });
    expect((await b.mutate(`/api/packs/${sample.id}/duplicate`)).status).toBe(
      201,
    );
    // A corrupt answer document cannot affect a summary listing.
    h.app.db.run("UPDATE packs SET pack_json = 'invalid json'");
    const list = await (await b.request("/api/packs")).json();
    expect(list).toHaveLength(52);
    expect(JSON.stringify(list)).not.toContain('"answer"');
  });

  it("backfills pack summaries once when upgrading existing storage", () => {
    const db = new Database(":memory:");
    try {
      db.run(
        "INSERT INTO accounts(account_id, issuer, client_id, subject, public_id, created_at, updated_at) VALUES ('a', 'issuer', 'quiz', 'subject', 'p', 1, 1)",
      );
      db.run(
        "INSERT INTO packs(id, owner_id, pack_json, updated_at) VALUES ('old', 'a', ?, 'date')",
        JSON.stringify(sample),
      );
      const packs = new Packs(db);
      const legacy = { ...sample, title: "x".repeat(121) };
      db.run(
        "INSERT INTO packs(id, owner_id, pack_json, updated_at) VALUES ('legacy', 'a', ?, 'date')",
        JSON.stringify(legacy),
      );
      const upgraded = new Packs(db); // Older packs need not meet the new limits to boot/list.
      expect(
        upgraded.list("a").find((pack) => pack.id === "legacy")?.title,
      ).toBe(legacy.title);
      upgraded.save(sample, "a", "legacy"); // Replacement and deletion still work for invalid old packs.
      db.run(
        "UPDATE packs SET pack_json = ? WHERE id = 'legacy'",
        JSON.stringify(legacy),
      );
      upgraded.delete("legacy", "a");
      db.run("UPDATE packs SET pack_json = 'broken'");
      expect(packs.list("a").find((pack) => pack.id === "old")).toMatchObject({
        title: sample.title,
        source: "mine",
      });
    } finally {
      db.close();
    }
  });

  it("caps hosts at three rooms and the server at 500, releasing capacity on closure", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("host");
    const codes = [
      await b.createRoom(),
      await b.createRoom(),
      await b.createRoom(),
    ];
    const fourth = await b.mutate("/api/rooms", {});
    expect(fourth.status).toBe(409);
    expect(await fourth.json()).toMatchObject({
      error: "conflict",
      message: expect.stringContaining("3 open rooms"),
    });
    await b.mutate(`/api/rooms/${codes[0]}/leave`);
    expect((await b.mutate("/api/rooms", {})).status).toBe(201);
    h.advance(60001);
    const room = h.app.rooms.get(codes[1])!;
    const aliases: string[] = [];
    // Populate capacity without generating 497 provider sessions or unrelated room state.
    while (h.app.rooms.size < 500) {
      const key = `capacity-${h.app.rooms.size}`;
      aliases.push(key);
      h.app.rooms.set(key, room);
    }
    try {
      const full = await b.mutate("/api/rooms", {});
      expect(full.status).toBe(429);
      expect(await full.json()).toMatchObject({
        error: "rateLimited",
        message: expect.stringContaining("500 open rooms"),
      });
    } finally {
      for (const key of aliases) h.app.rooms.delete(key);
    }
  });

  it("indexes memberships on join, leave, host removal and expiry without scanning unrelated rooms", async () => {
    h = await harness();
    const host = new Browser(h),
      player = new Browser(h);
    await host.signIn("host");
    await player.signIn("player");
    const codes = [
      await host.createRoom(),
      await host.createRoom(),
      await host.createRoom(),
    ];
    await player.mutate(`/api/rooms/${codes[0]}/join`);
    await player.mutate(`/api/rooms/${codes[1]}/join`);
    const id = h.app.auth.identityFor(
      h.app.auth.sessionFromCookieHeader(player.cookie),
    )!.account.public_id;
    const spy = vi.spyOn(h.engine.api, "playerView");
    const visited = async () => {
      spy.mockClear();
      expect((await player.request("/api/session")).status).toBe(200);
      return spy.mock.calls
        .map(([state]) => h!.engine.read(state).roomCode)
        .sort();
    };
    expect(await visited()).toEqual(codes.slice(0, 2).sort());
    await player.mutate(`/api/rooms/${codes[0]}/leave`);
    expect(await visited()).toEqual([codes[1]]);
    const wire = await connect(h, codes[1], "host", host);
    await wire.ok({ type: "removePlayer", playerId: id });
    expect(await visited()).toEqual([]);
    await player.mutate(`/api/rooms/${codes[2]}/join`);
    h.advance(12 * 3600000 + 1);
    await h.app.tick();
    expect(await visited()).toEqual([]);
  });

  it("three flooding sockets cannot evict the host's durable score retry with rejected commands", async () => {
    h = await harness(":memory:", { engine });
    const { a, code, browsers, players, d } = await table(h);
    await start(a, sample.id);
    const command = {
      type: "adjustScore",
      playerId: players[0].player.me.id,
      delta: 123,
      reason: "Replay isolation",
    } as const;
    const id = randomUUID();
    const original = await a.ok(command, id);
    const floods = [
      players[0],
      await connect(h, code, "player", browsers[0]),
      d.wire,
    ];
    const row = () =>
      h!.app.db.get<{ recent_json: string }>(
        "SELECT recent_json FROM rooms WHERE code = ?",
        code,
      )!.recent_json;
    const before = row();
    const writes = vi.spyOn(h.app.db, "run");
    for (let i = 0; i < 180; i++) {
      if (i % 15 === 0) h.advance(5001);
      await Promise.all(
        floods.map((wire, index) =>
          wire
            .send(
              index === 0
                ? { type: "buzz", clueId: "missing" } // engine rejection
                : { type: "pause" },
            )
            .then((ack) => expect(ack.ok).toBe(false)),
        ),
      );
    }
    expect(row()).toBe(before);
    expect(
      writes.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO rooms")),
    ).toBe(false);
    expect(await a.send(command, id)).toEqual(original);
    expect(a.host.players.find((p) => p.id === command.playerId)?.score).toBe(
      123,
    );
    expect(a.host.scoreLog).toHaveLength(1);
  }, 20000);

  it("keeps successful replay entries per identity across multiple sockets", async () => {
    h = await harness();
    const { a, players, code, browsers } = await table(h, 1);
    const id = randomUUID();
    const original = await a.ok({ type: "pause" }, id);
    const other = await connect(h, code, "player", browsers[0]);
    for (let i = 0; i < 40; i++) {
      if (i % 15 === 0) h.advance(5001);
      await (i % 2 ? other : players[0]).ok({
        type: "buzz",
        clueId: "fake-engine-accepts",
      });
    }
    const row = h.app.db.get<{ recent_json: string }>(
      "SELECT recent_json FROM rooms WHERE code = ?",
      code,
    )!;
    const recent: { identity: string }[] = JSON.parse(row.recent_json);
    expect(
      recent.filter((entry) => entry.identity.startsWith("player:")),
    ).toHaveLength(32);
    expect(await a.send({ type: "pause" }, id)).toEqual(original);
  });

  it("quarantines malformed JSON, invalid engine state and broken replay JSON while restoring valid rooms", async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "quiz-quarantine-"));
    const file = path.join(directory, "quiz.sqlite");
    try {
      h = await harness(file);
      const host = new Browser(h),
        player = new Browser(h);
      await host.signIn("host");
      await player.signIn("player");
      const valid = await host.createRoom();
      await player.mutate(`/api/rooms/${valid}/join`);
      const row = h.app.db.get<{
        state_json: string;
        recent_json: string;
        host_id: string;
        updated_at: number;
      }>("SELECT * FROM rooms WHERE code = ?", valid)!;
      const invalid = ["BCDFG", "CDFGH", "DFGHJ"].filter(
        (code) => code !== valid,
      );
      for (const [i, code] of invalid.entries())
        h.app.db.run(
          "INSERT INTO rooms(code, host_id, state_json, recent_json, updated_at) VALUES (?, ?, ?, ?, ?)",
          code,
          row.host_id,
          i === 0 ? "{secret broken" : i === 1 ? "{}" : row.state_json,
          i === 2 ? "bad replay json" : "[]",
          row.updated_at,
        );
      await h.stop();
      h = undefined;
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      h = await harness(file);
      expect([...h.app.rooms.keys()]).toEqual([valid]);
      expect(h.app.db.all("SELECT code FROM quarantined_rooms")).toHaveLength(
        invalid.length,
      );
      expect(log.mock.calls).toEqual(
        invalid.map((code) => ["Unrestorable room:", code]),
      );
      expect((await fetch(`${h.base}/api/health`)).status).toBe(200);
      // Restored rooms also repopulate the membership index.
      const restoredPlayer = new Browser(h);
      restoredPlayer.cookie = player.cookie;
      const view = vi.spyOn(h.engine.api, "playerView");
      expect((await restoredPlayer.request("/api/session")).status).toBe(200);
      expect(view).toHaveBeenCalledTimes(1);
    } finally {
      await h?.stop();
      h = undefined;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each(["0.0.0.0", "::", "192.0.2.1"])("rejects fixture HOST=%s", (host) => {
    expect(() => loadConfig({ APP_ENV: "test", HOST: host })).toThrow(
      "loopback HOST",
    );
  });
  it.each(["development", "test", "production"])(
    "requires an encryption key in live %s",
    (environment) => {
      expect(() =>
        loadConfig({
          APP_ENV: environment,
          HAM_MODE: "live",
          HAM_CLIENT_SECRET: `ths_${"a".repeat(43)}`,
          PUBLIC_ORIGIN: "https://quiz.teamham.world",
        }),
      ).toThrow("TOKEN_ENCRYPTION_KEY");
    },
  );
  it.each(["127.0.0.1", "localhost", "::1"])(
    "allows loopback fixture HOST=%s with a random ephemeral encryption key",
    (host) => {
      const first = loadConfig({ APP_ENV: "test", HOST: host });
      expect(first.encryptionKey).not.toEqual(
        loadConfig({ APP_ENV: "test", HOST: host }).encryptionKey,
      );
      expect(first.trustProxy).toBe(false);
    },
  );

  it("accepts extra HAM response fields while validating all required values", async () => {
    const config = loadConfig({ APP_ENV: "test" });
    const token = {
      access_token: `tha_${"a".repeat(43)}`,
      token_type: "Bearer",
      expires_in: 60,
      audience: config.ham.audience,
      sub: "subject",
      scope: "identity",
      future: { extra: true },
    };
    const active = {
      active: true,
      sub: "subject",
      client_id: "quiz",
      aud: config.ham.audience,
      iss: config.ham.issuer,
      exp: Math.floor(Date.now() / 1000) + 60,
      scope: "identity",
      token_type: "Bearer",
      future: true,
    };
    const client = (value: unknown) =>
      createHamClient(config.ham, async () => Response.json(value));
    expect(await client(token).exchangeCode("code", "verifier")).toMatchObject({
      kind: "ok",
    });
    expect(await client(active).introspect(token.access_token)).toMatchObject({
      kind: "active",
    });
    expect(
      await client({ active: false, future: true }).introspect(
        token.access_token,
      ),
    ).toEqual({ kind: "inactive" });
    for (const field of [
      "access_token",
      "token_type",
      "expires_in",
      "audience",
      "sub",
      "scope",
    ])
      expect(
        await client({ ...token, [field]: null }).exchangeCode(
          "code",
          "verifier",
        ),
      ).toEqual({ kind: "unavailable" });
    for (const field of [
      "active",
      "sub",
      "client_id",
      "aud",
      "iss",
      "exp",
      "scope",
      "token_type",
    ])
      expect(
        await client({ ...active, [field]: null }).introspect(
          token.access_token,
        ),
      ).toEqual({ kind: "unavailable" });
  });

  it.each(["inactive", "mismatch", "revokedBrowser", "outage"])(
    "revokes a token issued before callback failure: %s",
    async (mode) => {
      h = await harness();
      const b = new Browser(h);
      const callback = await b.decide(await b.beginLogin());
      const session = h.app.auth.sessionFromCookieHeader(b.cookie)!;
      const original = h.app.fixture!.handle;
      const revokes = vi.fn();
      h.app.fixture!.handle = async (req) => {
        const response = await original(req);
        if (req.url.endsWith("/revoke")) revokes();
        if (!req.url.endsWith("/introspect")) return response;
        if (mode === "inactive") return Response.json({ active: false });
        if (mode === "outage") return new Response(null, { status: 503 });
        if (mode === "mismatch")
          return Response.json({
            ...(await response.json()),
            sub: "different-subject",
          });
        h!.app.db.run(
          "UPDATE sessions SET revoked_at = 1 WHERE session_hash = ?",
          session.session_hash,
        );
        return response;
      };
      const result = await b.callback(callback);
      expect(result.status).toBe(mode === "outage" ? 503 : 302);
      expect(revokes).toHaveBeenCalledTimes(1);
      expect(
        h.app.db.get<{ n: number }>(
          "SELECT count(*) n FROM hamfx_tokens WHERE revoked_at IS NULL",
        )!.n,
      ).toBe(0);
    },
  );

  it("sets HTML headers independently of the proxy, permits Next bootstrap, and reserves HSTS for production", async () => {
    h = await harness(":memory:", {
      fallback: (_, res) => {
        res.setHeader("content-type", "text/html");
        res.end("<!doctype html><title>Next fallback</title>");
      },
    });
    for (const route of ["/", "/display/BCDFG"]) {
      const response = await fetch(`${h.base}${route}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers.has("strict-transport-security")).toBe(false);
    }
    const production = securityHeaders({
      environment: "production",
      publicOrigin: "https://quiz.teamham.world",
    });
    expect(production["strict-transport-security"]).toBe("max-age=31536000");
    expect(production["content-security-policy"]).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(production["content-security-policy"]).not.toContain("unsafe-eval");
    const development = securityHeaders({
      environment: "development",
      publicOrigin: "http://127.0.0.1:3401",
    });
    expect(development["content-security-policy"]).toContain("'unsafe-eval'");
    expect(development["content-security-policy"]).toContain(
      "ws://127.0.0.1:3401",
    );
    expect(development).not.toHaveProperty("strict-transport-security");
  });
});
