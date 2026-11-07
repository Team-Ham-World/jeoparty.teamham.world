import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { Duplex } from "node:stream";
import { randomInt, randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { type EngineApi } from "@/features/engine/contract";
import {
  CSRF_HEADER,
  PROTOCOL_VERSION,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_PATTERN,
  WS_CLOSE,
  type ConnectionRole,
  type ServerMessage,
} from "@/features/network/protocol";
import {
  AuthService,
  clearedSessionCookie,
  type Identity,
  type SessionRow,
} from "./auth";
import type { Config } from "./config";
import { Database } from "./db";
import { randomToken, sha256Hex, timingSafeEqualText } from "./crypto";
import { createHamClient } from "./ham/client";
import { createHamFixture } from "./ham/fixture";
import {
  HttpError,
  clientIp,
  securityHeaders,
  parseCookies,
  readJson,
  redirect,
  sendFetchResponse,
  sendJson,
  toFetchRequest,
} from "./http";
import { Packs } from "./packs";
import {
  Room,
  type Connection,
  type RoomRow,
  type RoomDeps,
} from "./rooms/room";
import { parseClientMessage } from "./validation";
import { RateLimiter } from "./rate-limit";

const ROOM_IDLE_MS = 12 * 3_600_000;
const grantName = (config: Config, code: string) =>
  `${config.publicOrigin.startsWith("https:") ? "__Host-" : ""}quiz_display_${code}`;
const claimSchema = z
  .object({
    code: z.string().regex(ROOM_CODE_PATTERN),
    key: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
const createSchema = z
  .object({ packId: z.string().min(1).max(128).optional() })
  .strict();
const saveSchema = z
  .object({ pack: z.unknown().refine((value) => value !== undefined) })
  .strict();
interface Options {
  engine: EngineApi;
  now?: () => number;
  fallback?: (
    req: IncomingMessage,
    res: ServerResponse,
  ) => void | Promise<void>;
  upgradeFallback?: (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void | Promise<void>;
  timers?: boolean;
}
export async function createApp(config: Config, options: Options) {
  const now = options.now ?? Date.now;
  let stopped = false;
  const pendingRequests = new Set<Promise<unknown>>();
  function track(task: Promise<unknown>) {
    pendingRequests.add(task);
    void task.finally(() => pendingRequests.delete(task));
  }
  const db = new Database(config.databasePath);
  const packs = new Packs(db);
  const rooms = new Map<string, Room>();
  const memberRooms = new Map<string, Set<string>>();
  const sessionConnections = new Map<string, Set<Connection>>();
  const fixture =
    config.ham.mode === "fixture"
      ? createHamFixture(db, config.ham, now)
      : null;
  const ham = createHamClient(
    config.ham,
    fixture
      ? (request) => fixture.handle(request)
      : (request) => fetch(request),
    now,
  );
  const auth = new AuthService(
    db,
    config,
    ham,
    {
      onSessionEnded(hash, reason) {
        for (const c of sessionConnections.get(hash) ?? []) {
          c.send({
            t: "closing",
            reason:
              reason === "superseded"
                ? "signedInElsewhere"
                : reason === "logout"
                  ? "signedOut"
                  : "authExpired",
          });
          c.close(WS_CLOSE.intentional);
        }
      },
    },
    now,
  );
  async function verify(
    hash: string,
    fresh: boolean,
  ): Promise<"active" | "inactive" | "unavailable"> {
    const result = await auth.verify(hash, { fresh });
    if (result.status === "active") {
      for (const c of sessionConnections.get(hash) ?? [])
        c.authorizedUntil = result.until;
      return "active";
    }
    return result.status === "unavailable" ? "unavailable" : "inactive";
  }
  const deps: RoomDeps = {
    db,
    engine: options.engine,
    packs,
    now,
    verify,
    onMembersChanged(code, previous, current) {
      for (const id of previous) {
        if (current.has(id)) continue;
        const codes = memberRooms.get(id);
        codes?.delete(code);
        if (!codes?.size) memberRooms.delete(id);
      }
      for (const id of current) {
        let codes = memberRooms.get(id);
        if (!codes) memberRooms.set(id, (codes = new Set()));
        codes.add(code);
      }
    },
    onClosed: (code) => {
      rooms.delete(code);
    },
  };
  for (const row of db.all<RoomRow>("SELECT * FROM rooms")) {
    if (row.updated_at + ROOM_IDLE_MS <= now()) {
      db.run("DELETE FROM rooms WHERE code = ?", row.code);
      continue;
    }
    let room: Room | null;
    try {
      room = Room.restore(row, deps);
    } catch {
      room = null;
    }
    if (!room) {
      db.transaction(() => {
        db.run(
          "INSERT OR REPLACE INTO quarantined_rooms(code, host_id, state_json, recent_json, updated_at) VALUES (?, ?, ?, ?, ?)",
          row.code,
          row.host_id,
          row.state_json,
          row.recent_json,
          row.updated_at,
        );
        db.run("DELETE FROM rooms WHERE code = ?", row.code);
      });
      console.error("Unrestorable room:", row.code);
      continue;
    }
    rooms.set(row.code, room);
    await room.system({ type: "restored" });
  }
  const limiter = new RateLimiter(now);
  function limit(key: string, max: number, windowMs = 60_000) {
    if (!limiter.take("request", key, max, windowMs))
      throw new HttpError(
        429,
        "rateLimited",
        "Too many requests. Try again shortly.",
      );
  }
  function origin(req: IncomingMessage): void {
    if (req.headers.origin !== config.publicOrigin)
      throw new HttpError(403, "csrf", "Origin does not match.");
  }
  async function identity(req: IncomingMessage): Promise<Identity> {
    const session = auth.sessionFromCookieHeader(req.headers.cookie);
    const user = auth.identityFor(session);
    if (!user || !session)
      throw new HttpError(401, "unauthorized", "Sign in with HAM.");
    const result = await verify(session.session_hash, true);
    if (result !== "active")
      throw new HttpError(
        result === "unavailable" ? 503 : 401,
        result === "unavailable" ? "authUnavailable" : "unauthorized",
        "HAM authorization could not be verified.",
      );
    const current = auth.identityFor(session);
    if (!current) throw new HttpError(401, "unauthorized", "Sign in with HAM.");
    // HAM username is display data. Synchronize it through the engine, never patch its state.
    for (const code of memberRooms.get(current.account.public_id) ?? []) {
      const room = rooms.get(code)!;
      const view = options.engine.playerView(
        room.state,
        current.account.public_id,
        now(),
      );
      if (view && view.me.name !== current.displayName)
        await room.system({
          type: "renamePlayer",
          playerId: current.account.public_id,
          name: current.displayName,
        });
    }
    return current;
  }
  async function mutation(req: IncomingMessage): Promise<Identity> {
    origin(req);
    // Reject CSRF before making a provider request or synchronizing display names.
    const session = auth.sessionFromCookieHeader(req.headers.cookie);
    const supplied = req.headers[CSRF_HEADER];
    if (
      !session ||
      typeof supplied !== "string" ||
      !timingSafeEqualText(supplied, session.csrf_token)
    )
      throw new HttpError(403, "csrf", "CSRF token does not match.");
    const user = await identity(req);
    return user;
  }
  function getRoom(code: string): Room {
    const room = ROOM_CODE_PATTERN.test(code) ? rooms.get(code) : undefined;
    if (!room) throw new HttpError(404, "notFound", "Room not found.");
    return room;
  }
  function host(room: Room, user: Identity) {
    if (room.hostId !== user.account.account_id)
      throw new HttpError(403, "forbidden", "Only the host can do that.");
  }
  const parse = <T>(schema: z.ZodType<T>, raw: unknown): T => {
    const value = schema.safeParse(raw);
    if (!value.success)
      throw new HttpError(400, "badRequest", "Invalid request body.");
    return value.data;
  };
  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (stopped) throw new HttpError(503, "internal", "Server is stopping.");
    const url = new URL(req.url ?? "/", config.publicOrigin);
    const route = url.pathname,
      method = req.method;
    const ip = clientIp(req, config.trustProxy);
    if (route.startsWith("/__ham/")) {
      if (!fixture) throw new HttpError(404, "notFound", "Not found.");
      if (method !== "GET" && method !== "HEAD") origin(req);
      limit(`fixture:${ip}`, 120);
      await sendFetchResponse(
        res,
        await fixture.handle(await toFetchRequest(req, config.publicOrigin)),
      );
      return;
    }
    if (!route.startsWith("/api/")) {
      if (options.fallback) {
        await options.fallback(req, res);
        return;
      }
      throw new HttpError(404, "notFound", "Not found.");
    }
    limit(`api:${ip}`, 600);
    const knownMethods =
      route === "/api/health" ||
      route === "/api/session" ||
      route === "/api/auth/login" ||
      route === "/api/auth/callback"
        ? ["GET"]
        : route === "/api/auth/logout" || route === "/api/display/claim"
          ? ["POST"]
          : route === "/api/rooms"
            ? ["POST"]
            : /^\/api\/rooms\/[^/]+$/.test(route)
              ? ["GET"]
              : /^\/api\/rooms\/[^/]+\/(join|leave|display-link)$/.test(route)
                ? ["POST"]
                : null;
    if (knownMethods && !knownMethods.includes(method ?? ""))
      throw new HttpError(405, "badRequest", "Method not allowed.");

    const rawBody = ["POST", "PUT", "DELETE"].includes(method ?? "")
      ? await readJson(
          req,
          /^\/api\/packs(?:\/|$)/.test(route) ? 1024 * 1024 : 4096,
        )
      : undefined;

    if (route === "/api/health" && method === "GET") {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (route === "/api/session" && method === "GET") {
      const session = auth.sessionFromCookieHeader(req.headers.cookie);
      if (!auth.identityFor(session)) {
        sendJson(res, 200, { signedIn: false, authMode: config.ham.mode });
        return;
      }
      const user = await identity(req);
      sendJson(res, 200, {
        signedIn: true,
        authMode: config.ham.mode,
        user: { id: user.account.public_id, name: user.displayName },
        csrfToken: user.csrf,
      });
      return;
    }
    if (route === "/api/auth/login" && method === "GET") {
      limit(`login:${ip}`, 20);
      if (url.searchParams.getAll("return_to").length > 1)
        throw new HttpError(400, "badRequest", "Duplicate parameter.");
      const result = auth.startLogin(
        auth.sessionFromCookieHeader(req.headers.cookie),
        url.searchParams.get("return_to") ?? "/",
      );
      redirect(
        res,
        result.location,
        result.setCookie ? { "set-cookie": result.setCookie } : {},
      );
      return;
    }
    if (route === "/api/auth/callback" && method === "GET") {
      limit(`callback:${ip}`, 30);
      const result = await auth.handleCallback(
        url.searchParams,
        auth.sessionFromCookieHeader(req.headers.cookie),
      );
      if (result.ok)
        redirect(res, result.returnTo, { "set-cookie": result.setCookie });
      else if (result.error === "unavailable")
        sendJson(res, 503, {
          error: "authUnavailable",
          message: "HAM is unavailable. Start sign-in again shortly.",
        });
      else redirect(res, `${result.returnTo}?auth_error=${result.error}`);
      return;
    }
    if (route === "/api/auth/logout" && method === "POST") {
      origin(req);
      const session = auth.sessionFromCookieHeader(req.headers.cookie);
      if (
        !session ||
        typeof req.headers[CSRF_HEADER] !== "string" ||
        !timingSafeEqualText(
          String(req.headers[CSRF_HEADER]),
          session.csrf_token,
        )
      )
        throw new HttpError(403, "csrf", "Invalid CSRF token.");
      await identity(req);
      await auth.logout(session);
      sendJson(res, 204, null, { "set-cookie": clearedSessionCookie(config) });
      return;
    }
    if (route === "/api/display/claim" && method === "POST") {
      origin(req);
      limit(`claim:${ip}`, 30);
      const request = parse(claimSchema, rawBody),
        room = getRoom(request.code);
      const cookie = await room.run(() => {
        const row = db.get<RoomRow>(
          "SELECT * FROM rooms WHERE code = ?",
          room.code,
        );
        if (
          !row?.display_key_hash ||
          !timingSafeEqualText(sha256Hex(request.key), row.display_key_hash)
        )
          throw new HttpError(403, "forbidden", "Invalid display link.");
        const grant = randomToken();
        db.run(
          "INSERT INTO display_grants(grant_hash, room_code, generation, expires_at) VALUES (?, ?, ?, ?)",
          sha256Hex(grant),
          room.code,
          row.display_generation,
          now() + ROOM_IDLE_MS,
        );
        return `${grantName(config, room.code)}=${grant}; Path=/; ${config.publicOrigin.startsWith("https:") ? "Secure; " : ""}HttpOnly; SameSite=Strict; Max-Age=43200`;
      });
      sendJson(res, 204, null, { "set-cookie": cookie });
      return;
    }
    if (route === "/api/rooms" && method === "POST") {
      const user = await mutation(req);
      limit(`create:${user.account.account_id}`, 6);
      const request = parse(createSchema, rawBody);
      if (rooms.size >= 500)
        throw new HttpError(
          429,
          "rateLimited",
          "The server has reached its limit of 500 open rooms. Try again later.",
        );
      if (
        [...rooms.values()].filter(
          (room) => room.hostId === user.account.account_id,
        ).length >= 3
      )
        throw new HttpError(
          409,
          "conflict",
          "A host can have at most 3 open rooms. Close a room first.",
        );
      let code = "";
      do {
        code = Array.from(
          { length: 5 },
          () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
        ).join("");
      } while (rooms.has(code));
      let state = options.engine.createGame({
        roomCode: code,
        seed: randomInt(0x1_0000_0000),
        now: now(),
      });
      const result = options.engine.apply(
        state,
        { kind: "host" },
        {
          type: "setPack",
          pack: packs.resolve(request.packId, user.account.account_id),
        },
        now(),
      );
      if (!result.ok)
        throw new HttpError(400, "badRequest", result.rejection.message);
      state = result.state;
      const room = new Room(
        code,
        user.account.account_id,
        state,
        [],
        now(),
        deps,
      );
      room.saveInitial();
      rooms.set(code, room);
      sendJson(res, 201, { code });
      return;
    }
    const roomMatch =
      /^\/api\/rooms\/([^/]+)(?:\/(join|leave|display-link))?$/.exec(route);
    if (roomMatch) {
      const [, code, action] = roomMatch;
      const user =
        method === "POST" ? await mutation(req) : await identity(req);
      const room = getRoom(code);
      if (method === "GET" && !action) {
        sendJson(res, 200, room.summary(user));
        return;
      }
      if (method === "POST" && action === "join") {
        limit(`join:${user.account.account_id}`, 30);
        sendJson(res, 200, { role: await room.join(user) });
        return;
      }
      if (method === "POST" && action === "leave") {
        await room.leave(user);
        sendJson(res, 204, null);
        return;
      }
      if (method === "POST" && action === "display-link") {
        host(room, user);
        const key = randomToken();
        await room.run(() => {
          db.transaction(() => {
            db.run(
              "UPDATE rooms SET display_key_hash = ?, display_generation = display_generation + 1 WHERE code = ?",
              sha256Hex(key),
              code,
            );
            db.run("DELETE FROM display_grants WHERE room_code = ?", code);
          });
          room.closeWhere((c) => c.role === "display", "displayRevoked");
        });
        sendJson(res, 200, {
          url: `${config.publicOrigin}/display/${code}#key=${key}`,
        });
        return;
      }
      throw new HttpError(405, "badRequest", "Method not allowed.");
    }
    const packMatch = /^\/api\/packs(?:\/([^/]+)(?:\/(duplicate))?)?$/.exec(
      route,
    );
    if (packMatch) {
      const [, id, duplicate] = packMatch;
      const user = method === "GET" ? await identity(req) : await mutation(req);
      const owner = user.account.account_id;
      if (!id && method === "GET") {
        sendJson(res, 200, packs.list(owner));
        return;
      }
      if (id && !duplicate && method === "GET") {
        sendJson(res, 200, packs.document(id, owner));
        return;
      }
      if (id && duplicate && method === "POST") {
        sendJson(res, 201, packs.save(packs.resolve(id, owner), owner));
        return;
      }
      if (
        (!id && method === "POST") ||
        (id && !duplicate && method === "PUT")
      ) {
        const request = parse(saveSchema, rawBody);
        sendJson(res, id ? 200 : 201, packs.save(request.pack, owner, id));
        return;
      }
      if (id && !duplicate && method === "DELETE") {
        packs.delete(id, owner);
        sendJson(res, 204, null);
        return;
      }
      throw new HttpError(405, "badRequest", "Method not allowed.");
    }
    throw new HttpError(404, "notFound", "Not found.");
  }
  const server = createServer((req, res) => {
    for (const [name, value] of Object.entries(securityHeaders(config)))
      res.setHeader(name, value);
    track(
      handle(req, res).catch((error: unknown) => {
        if (res.headersSent) {
          res.destroy();
          return;
        }
        if (error instanceof HttpError)
          sendJson(res, error.status, {
            error: error.code,
            message: error.message,
            ...error.extra,
          });
        else
          sendJson(res, 500, {
            error: "internal",
            message: "The request could not be completed.",
          });
      }),
    );
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const alive = new WeakMap<WebSocket, boolean>();
  function refuse(socket: Duplex, status: number) {
    if (socket.writable)
      socket.end(
        `HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
    socket.destroy();
  }
  server.on("upgrade", (req, socket, head) => {
    socket.on("error", () => socket.destroy());
    track(
      (async () => {
        if (stopped) {
          refuse(socket, 503);
          return;
        }
        const url = new URL(req.url ?? "/", config.publicOrigin);
        if (url.pathname !== "/ws") {
          if (options.upgradeFallback)
            await options.upgradeFallback(req, socket, head);
          else refuse(socket, 404);
          return;
        }
        origin(req);
        limit(`ws:${clientIp(req, config.trustProxy)}`, 60);
        if (
          [...url.searchParams.keys()].some(
            (key) =>
              url.searchParams.getAll(key).length !== 1 ||
              !["room", "role"].includes(key),
          )
        )
          throw new HttpError(400, "badRequest", "Invalid query.");
        const code = url.searchParams.get("room") ?? "",
          requested = url.searchParams.get("role");
        if (
          requested !== "host" &&
          requested !== "player" &&
          requested !== "display"
        )
          throw new HttpError(403, "forbidden", "Invalid role.");
        const role: ConnectionRole = requested,
          room = getRoom(code);
        let publicId = "",
          sessionHash: string | undefined,
          grantHash: string | undefined,
          authorizedUntil = now() + ROOM_IDLE_MS;
        if (role === "display") {
          const values = parseCookies(req.headers.cookie).get(
            grantName(config, code),
          );
          if (values?.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0]))
            throw new HttpError(401, "unauthorized", "Display grant required.");
          grantHash = sha256Hex(values[0]);
          const grant = db.get<{ expires_at: number }>(
            "SELECT g.expires_at FROM display_grants g JOIN rooms r ON r.code = g.room_code AND r.display_generation = g.generation WHERE g.grant_hash = ? AND g.room_code = ?",
            grantHash,
            code,
          );
          if (!grant || grant.expires_at <= now())
            throw new HttpError(401, "unauthorized", "Display grant expired.");
          publicId = grantHash;
          authorizedUntil = grant.expires_at;
        } else {
          const user = await identity(req);
          if (socket.destroyed || !socket.writable) return;
          if (role === "host") host(room, user);
          if (
            role === "player" &&
            (user.account.account_id === room.hostId ||
              !options.engine.playerView(
                room.state,
                user.account.public_id,
                now(),
              ))
          )
            throw new HttpError(
              403,
              "forbidden",
              "Join the room as a player first.",
            );
          publicId = user.account.public_id;
          sessionHash = user.sessionHash;
          const result = await auth.verify(sessionHash);
          if (result.status !== "active")
            throw new HttpError(401, "unauthorized", "Session expired.");
          authorizedUntil = result.until;
        }
        // Recheck membership/grants inside the room queue, including rotation/leave races during introspection.
        await room.run(() => {
          if (socket.destroyed || !socket.writable) return;
          if (
            sessionHash &&
            !db.get(
              "SELECT 1 FROM sessions WHERE session_hash = ? AND revoked_at IS NULL AND expires_at > ?",
              sessionHash,
              now(),
            )
          )
            throw new HttpError(401, "unauthorized", "Session expired.");
          if (rooms.get(code) !== room)
            throw new HttpError(404, "notFound", "Room closed.");
          if (
            role === "player" &&
            !options.engine.playerView(room.state, publicId, now())
          )
            throw new HttpError(403, "forbidden", "Membership ended.");
          if (
            grantHash &&
            !db.get(
              "SELECT 1 FROM display_grants WHERE grant_hash = ? AND expires_at > ?",
              grantHash,
              now(),
            )
          )
            throw new HttpError(401, "unauthorized", "Display revoked.");
          wss.handleUpgrade(req, socket, head, (ws) => {
            const c: Connection = {
              role,
              publicId,
              sessionHash,
              grantHash,
              authorizedUntil,
              send(message: ServerMessage) {
                if (ws.readyState !== WebSocket.OPEN) return;
                if (message.t !== "closing" && c.authorizedUntil <= now())
                  return;
                if (ws.bufferedAmount > 512 * 1024) {
                  ws.terminate();
                  return;
                }
                ws.send(JSON.stringify(message));
              },
              close: (code) => {
                ws.close(code);
                setTimeout(() => ws.terminate(), 1000).unref();
              },
            };
            if (sessionHash) {
              let connections = sessionConnections.get(sessionHash);
              if (!connections)
                sessionConnections.set(sessionHash, (connections = new Set()));
              connections.add(c);
            }
            alive.set(ws, true);
            ws.on("pong", () => alive.set(ws, true));
            c.send({
              t: "hello",
              protocol: PROTOCOL_VERSION,
              role,
              serverNow: now(),
            });
            void room.attach(c).catch(() => ws.close(WS_CLOSE.roomNotFound));
            const socketId = randomUUID();
            ws.on("message", (data, binary) => {
              void (async () => {
                try {
                  limit(`socket:${socketId}`, role === "host" ? 60 : 20, 5000);
                } catch {
                  ws.close(WS_CLOSE.rateLimited);
                  return;
                }
                if (binary) {
                  ws.close(1003);
                  return;
                }
                let raw: unknown;
                try {
                  raw = JSON.parse(data.toString());
                } catch {
                  ws.close(1007);
                  return;
                }
                const message = parseClientMessage(raw);
                if (!message) {
                  ws.close(1008);
                  return;
                }
                if (message.t === "cmd")
                  await room.command(c, message.id, message.cmd);
                else if (c.authorizedUntil > now()) {
                  if (message.t === "ping")
                    c.send({ t: "pong", at: message.at, serverNow: now() });
                  else room.sendView(c);
                }
              })().catch(() => ws.close(1011));
            });
            ws.on("close", () => {
              if (sessionHash) {
                const connections = sessionConnections.get(sessionHash);
                connections?.delete(c);
                if (!connections?.size) sessionConnections.delete(sessionHash);
              }
              void room.detach(c).catch(() => undefined);
            });
            ws.on("error", () => ws.terminate());
          });
        });
      })().catch((error) =>
        refuse(socket, error instanceof HttpError ? error.status : 500),
      ),
    );
  });
  let sweepWork: Promise<void> | undefined;
  function tick(): Promise<void> {
    if (stopped) return Promise.resolve();
    // Lease expiry must still remove presence while a slow provider renewal is in flight.
    for (const room of rooms.values())
      for (const c of room.connections) {
        if (room.updatedAt + ROOM_IDLE_MS <= now()) continue; // Room closure takes precedence over lease expiry.
        if (c.role !== "display" && c.authorizedUntil <= now()) {
          c.close(WS_CLOSE.authExpired);
          void room.detach(c).catch(() => undefined);
        }
      }
    if (!sweepWork)
      sweepWork = sweep().finally(() => {
        sweepWork = undefined;
      });
    return sweepWork;
  }
  async function sweep() {
    const hashes = new Set<string>();
    for (const room of rooms.values()) {
      if (room.updatedAt + ROOM_IDLE_MS <= now()) {
        await room.run(() => room.closeRoom());
        continue;
      }
      for (const c of room.connections) {
        if (c.role === "display") {
          if (c.authorizedUntil <= now())
            room.closeWhere((other) => other === c, "displayRevoked");
        } else if (c.sessionHash && c.authorizedUntil - now() < 5000)
          hashes.add(c.sessionHash);
      }
    }
    await Promise.all(
      [...hashes].map(async (hash) => {
        const result = await verify(hash, true);
        if (result === "active") {
          const session = db.get<SessionRow>(
            "SELECT * FROM sessions WHERE session_hash = ?",
            hash,
          );
          const user = auth.identityFor(session ?? null);
          if (user)
            for (const code of memberRooms.get(user.account.public_id) ?? []) {
              const room = rooms.get(code)!;
              const view = options.engine.playerView(
                room.state,
                user.account.public_id,
                now(),
              );
              if (view && view.me.name !== user.displayName)
                await room.system({
                  type: "renamePlayer",
                  playerId: user.account.public_id,
                  name: user.displayName,
                });
            }
        }
        if (result !== "active")
          for (const room of rooms.values())
            for (const c of room.connections)
              if (c.sessionHash === hash && c.authorizedUntil <= now()) {
                c.close(WS_CLOSE.authExpired);
                await room.detach(c);
              }
      }),
    );
  }

  const intervals: ReturnType<typeof setInterval>[] = [];
  if (options.timers !== false) {
    intervals.push(
      setInterval(() => {
        void tick().catch(() => undefined);
      }, 1000),
    );
    intervals.push(
      setInterval(() => {
        for (const ws of wss.clients) {
          if (alive.get(ws) === false) ws.terminate();
          else {
            alive.set(ws, false);
            ws.ping();
          }
        }
      }, 20_000),
    );
    intervals.push(setInterval(() => auth.sweep(), 3_600_000));
    intervals.forEach((timer) => timer.unref());
  }
  return {
    server,
    db,
    auth,
    rooms,
    fixture,
    config,
    tick,
    listen: () =>
      new Promise<number>((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.port, config.host, () => {
          const address = server.address();
          resolve(
            typeof address === "object" && address ? address.port : config.port,
          );
        });
      }),
    async close() {
      if (stopped) return;
      stopped = true;
      intervals.forEach(clearInterval);
      await Promise.all([...rooms.values()].map((room) => room.shutdown()));
      for (const ws of wss.clients)
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(WS_CLOSE.intentional);
          setTimeout(() => ws.terminate(), 1000).unref();
        }
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await Promise.all([...pendingRequests, sweepWork]);
      await Promise.all([...rooms.values()].map((room) => room.shutdown()));
      await Promise.all(
        [...rooms.values()].map((room) => room.run(() => undefined)),
      );
      wss.close();
      db.close();
    },
  };
}
