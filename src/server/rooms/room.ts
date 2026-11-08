import {
  MAX_PLAYERS,
  type Actor,
  type Command,
  type EngineApi,
  type GameState,
  type SystemCommand,
} from "@/features/engine/contract";
import type {
  ClientCommand,
  CloseReason,
  ConnectionRole,
  ServerMessage,
  RoomSummary,
} from "@/features/network/protocol";
import { WS_CLOSE } from "@/features/network/protocol";
import type { Identity } from "../auth";
import type { SqlDatabase } from "../storage";
import type { Packs } from "../packs";
import { HttpError } from "../http";
import { commandAllowed } from "../validation";
import { Latency } from "./latency";

export type Ack = Extract<ServerMessage, { t: "ack" }>;
interface Recent {
  identity: string;
  ack: Ack;
}
export interface RoomRow {
  code: string;
  host_id: string;
  state_json: string;
  recent_json: string;
  updated_at: number;
  display_key_hash: string | null;
  display_generation: number;
}
export interface Connection {
  role: ConnectionRole;
  publicId: string;
  sessionHash?: string;
  grantHash?: string;
  authorizedUntil: number;
  send(message: ServerMessage): void;
  close(code: number): void;
}
export interface RoomDeps {
  db: SqlDatabase;
  engine: EngineApi;
  packs: Packs;
  now: () => number;
  verify(sessionHash: string, fresh: boolean): Promise<"active" | "inactive" | "unavailable">;
  onClosed(code: string): void;
  onMembersChanged(code: string, previous: Set<string>, current: Set<string>): void;
}
export class Room {
  readonly connections = new Set<Connection>();
  private queue: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  private latencies = new Map<Connection, Latency>();
  state: GameState;
  private recent: Recent[];
  private members = new Set<string>();
  updatedAt: number;
  constructor(
    readonly code: string,
    readonly hostId: string,
    state: GameState,
    recent: Recent[],
    updatedAt: number,
    private deps: RoomDeps,
  ) {
    this.state = state;
    this.recent = recent.filter((entry) => entry.ack.ok);
    this.updatedAt = updatedAt;
  }
  run<T>(fn: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }
  private persist(state: GameState, recent: Recent[], updatedAt: number): void {
    this.deps.db.run(
      `INSERT INTO rooms(code, host_id, state_json, recent_json, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET state_json = excluded.state_json, recent_json = excluded.recent_json, updated_at = excluded.updated_at`,
      this.code,
      this.hostId,
      JSON.stringify(state),
      JSON.stringify(recent),
      updatedAt,
    );
  }
  saveInitial(): void {
    this.persist(this.state, this.recent, this.updatedAt);
    this.indexMembers();
    this.schedule();
  }
  private commit(state: GameState, recent = this.recent): void {
    const updated = this.deps.now();
    this.persist(state, recent, updated);
    this.state = state;
    this.indexMembers();
    this.recent = recent;
    this.updatedAt = updated;
    this.schedule();
  }
  private indexMembers(): void {
    const view = this.deps.engine.displayView(this.state, this.deps.now());
    const current = new Set([...view.players, ...view.waitingPlayers].map((p) => p.id));
    this.deps.onMembersChanged(this.code, this.members, current);
    this.members = current;
  }
  private schedule(): void {
    clearTimeout(this.timer);
    if (this.closed) return;
    const deadline = this.deps.engine.nextDeadline(this.state);
    if (deadline) {
      this.timer = setTimeout(
        () => {
          void this.system({
            type: "timerExpired",
            timerId: deadline.timerId,
          })
            .then((result) => {
              // Node can fire about 1 ms before Date.now() reaches the deadline, and the engine
              // refuses that as stale. Re-arm, or the deadline is lost and the clue hangs.
              if (!result.ok) this.schedule();
            })
            .catch(() => {
              // Save failures must not drop the deadline. Retry without acknowledging an unsaved change.
              if (!this.closed) this.timer = setTimeout(() => this.schedule(), 1000);
            });
        },
        Math.max(0, Math.ceil(deadline.at - this.deps.now())),
      );
      this.timer.unref?.();
    }
  }
  private apply(actor: Actor, command: Command): ReturnType<EngineApi["apply"]> {
    if (this.closed) throw new HttpError(404, "notFound", "Room closed.");
    return this.deps.engine.apply(this.state, actor, command, this.deps.now());
  }
  system(command: SystemCommand): Promise<ReturnType<EngineApi["apply"]>> {
    return this.run(() => {
      const result = this.apply({ kind: "system" }, command);
      if (result.ok) {
        this.commit(result.state);
        this.broadcast();
      }
      return result;
    });
  }
  summary(identity: Identity): RoomSummary {
    const view = this.deps.engine.displayView(this.state, this.deps.now());
    const me = this.deps.engine.playerView(this.state, identity.account.public_id, this.deps.now());
    const account = this.deps.db.get<{
      username: string | null;
      public_id: string;
    }>("SELECT username, public_id FROM accounts WHERE account_id = ?", this.hostId);
    return {
      code: this.code,
      status: view.phase === "lobby" ? "lobby" : view.phase === "results" ? "finished" : "playing",
      hostName:
        account?.username?.slice(0, 32) ||
        `Player ${account?.public_id.slice(-4).toUpperCase() ?? "????"}`,
      playerCount: view.players.length,
      maxPlayers: MAX_PLAYERS,
      myRole:
        identity.account.account_id === this.hostId
          ? "host"
          : me
            ? me.me.status === "waiting"
              ? "waiting"
              : "player"
            : null,
    };
  }
  join(identity: Identity): Promise<"player" | "waiting"> {
    return this.run(() => {
      if (identity.account.account_id === this.hostId)
        throw new HttpError(403, "forbidden", "The host cannot join as a player.");
      const id = identity.account.public_id;
      let view = this.deps.engine.playerView(this.state, id, this.deps.now());
      if (!view) {
        const result = this.apply(
          { kind: "system" },
          { type: "addPlayer", playerId: id, name: identity.displayName },
        );
        if (!result.ok)
          throw new HttpError(
            409,
            result.rejection.code === "gameFull" ? "roomFull" : "conflict",
            result.rejection.message,
          );
        this.commit(result.state);
        this.broadcast();
        view = this.deps.engine.playerView(this.state, id, this.deps.now());
      }
      return view?.me.status === "waiting" ? "waiting" : "player";
    });
  }
  leave(identity: Identity): Promise<void> {
    return this.run(() => {
      if (identity.account.account_id === this.hostId) {
        this.closeRoom();
        return;
      }
      const result = this.apply(
        { kind: "system" },
        { type: "removeMember", playerId: identity.account.public_id },
      );
      if (result.ok) this.commit(result.state);
      this.closeWhere((c) => c.publicId === identity.account.public_id, "removed");
      this.broadcast();
    });
  }
  private viewFor(c: Connection) {
    const engine = this.deps.engine,
      now = this.deps.now();
    return c.role === "host"
      ? engine.hostView(this.state, now)
      : c.role === "display"
        ? engine.displayView(this.state, now)
        : engine.playerView(this.state, c.publicId, now);
  }
  sendView(c: Connection): void {
    const view = this.viewFor(c);
    if (view) c.send({ t: "view", view });
    else this.closeWhere((candidate) => candidate === c, "removed");
  }
  private broadcast(): void {
    for (const c of this.connections) this.sendView(c);
  }
  attach(c: Connection): Promise<void> {
    return this.run(() => {
      if (this.closed) throw new HttpError(404, "notFound", "Room closed.");
      if (
        c.role === "player" &&
        !this.deps.engine.playerView(this.state, c.publicId, this.deps.now())
      )
        throw new HttpError(403, "forbidden", "Membership ended.");
      if (
        c.grantHash &&
        !this.deps.db.get(
          "SELECT 1 FROM display_grants WHERE grant_hash = ? AND room_code = ? AND expires_at > ?",
          c.grantHash,
          this.code,
          this.deps.now(),
        )
      )
        throw new HttpError(401, "unauthorized", "Display grant expired.");
      if (
        c.sessionHash &&
        !this.deps.db.get(
          "SELECT 1 FROM sessions WHERE session_hash = ? AND revoked_at IS NULL AND expires_at > ?",
          c.sessionHash,
          this.deps.now(),
        )
      )
        throw new HttpError(401, "unauthorized", "Session expired.");
      const first = ![...this.connections].some(
        (other) => other.role === c.role && other.publicId === c.publicId,
      );
      if (first && c.role !== "display") {
        const result = this.apply(
          { kind: "system" },
          {
            type: "setPresence",
            target: c.role === "host" ? { role: "host" } : { role: "player", playerId: c.publicId },
            connected: true,
          },
        );
        if (result.ok) this.commit(result.state);
      }
      this.connections.add(c);
      if (c.role === "player") this.latencies.set(c, new Latency());
      this.probe();
      this.sendPings();
      this.broadcast();
    });
  }
  detach(c: Connection): Promise<void> {
    this.latencies.delete(c);
    return this.run(() => {
      this.sendPings();
      if (!this.connections.delete(c) || this.closed || c.role === "display") return;
      if (
        [...this.connections].some(
          (other) => other.role === c.role && other.publicId === c.publicId,
        )
      )
        return;
      const result = this.apply(
        { kind: "system" },
        {
          type: "setPresence",
          target: c.role === "host" ? { role: "host" } : { role: "player", playerId: c.publicId },
          connected: false,
        },
      );
      if (result.ok) {
        this.commit(result.state);
        this.broadcast();
      }
    });
  }
  /** Called outside the room queue: a slow HAM check must not inflate RTT. */
  probe(): void {
    for (const [c, latency] of this.latencies) {
      const probe = latency.probe(this.deps.now());
      if (probe) c.send(probe);
    }
  }
  probeAck(c: Connection, id: string, arrivalMs: number): void {
    if (c.authorizedUntil <= this.deps.now()) return;
    if (this.latencies.get(c)?.acknowledge(id, arrivalMs)) this.sendPings();
  }
  private sendPings(): void {
    const players = this.deps.engine.displayView(this.state, this.deps.now()).players;
    const pings = Object.fromEntries(
      players.map((p) => {
        const samples = [...this.latencies]
          .filter(([c, l]) => c.publicId === p.id && l.median !== null)
          .map(([, l]) => l.median!);
        return [p.id, samples.length ? Math.min(...samples) : null];
      }),
    );
    for (const c of this.connections) if (c.role === "host") c.send({ t: "pings", pings });
  }
  private eligibleLatencies(except?: string): Latency[] {
    const view = this.deps.engine.displayView(this.state, this.deps.now());
    return [...this.latencies]
      .filter(
        ([c]) =>
          c.publicId !== except &&
          view.players.some(
            (p) =>
              p.id === c.publicId &&
              p.connected &&
              !view.clue?.attempts.some((a) => a.playerId === p.id),
          ),
      )
      .map(([, l]) => l);
  }
  command(
    c: Connection,
    id: string,
    cmd: ClientCommand,
    arrivalMs = this.deps.now(),
  ): Promise<void> {
    // Snapshot bounds before any queue work or authentication. The game only stores candidate times.
    const uplinkBoundMs = this.latencies.get(c)?.uplinkBound ?? 150;
    const maxOtherUplinkMs = Math.max(
      0,
      ...this.eligibleLatencies(c.publicId).map((l) => l.uplinkBound),
    );
    return this.run(async () => {
      const identity = `${c.role}:${c.publicId}`;
      const cached = this.recent.find(
        (entry) => entry.identity === identity && entry.ack.id === id,
      );
      // A replay must still be authorized; revocation never permits cached access.
      if (!this.connections.has(c) || this.closed) return;
      if (c.role === "display" && c.authorizedUntil <= this.deps.now()) {
        this.closeWhere((other) => other === c, "displayRevoked");
        return;
      }
      const verified = c.sessionHash
        ? await this.deps.verify(c.sessionHash, cmd.type === "startGame")
        : "inactive";
      if (verified !== "active" && c.role !== "display") {
        if (verified === "unavailable" && !cached && c.authorizedUntil > this.deps.now()) {
          const ack: Ack = {
            t: "ack",
            id,
            ok: false,
            error: "authUnavailable",
            message: "HAM is unavailable. Try again shortly.",
          };
          c.send(ack);
        }
        return;
      }
      if (cached) {
        c.send(cached.ack);
        return;
      }
      let ack: Ack;
      let state = this.state;
      if (
        !commandAllowed(c.role, cmd) ||
        (c.role === "player" && !this.deps.engine.playerView(state, c.publicId, this.deps.now()))
      ) {
        ack = {
          t: "ack",
          id,
          ok: false,
          error: "notAllowed",
          message: "This role cannot send that command.",
        };
      } else {
        let command: Command | undefined;
        if (cmd.type === "choosePack") {
          try {
            command = {
              type: "setPack",
              pack: this.deps.packs.resolve(cmd.packId, this.hostId),
            };
          } catch (error) {
            if (!(error instanceof HttpError)) throw error;
          }
        } else if (cmd.type === "openBuzzers") {
          const leadMs = Math.min(
            400,
            Math.max(120, ...this.eligibleLatencies().map((l) => l.p90 / 2 + 60)),
          );
          command = { ...cmd, leadMs };
        } else if (cmd.type === "buzz")
          command = { ...cmd, arrivalMs, uplinkBoundMs, maxOtherUplinkMs };
        else command = cmd;
        if (!command)
          ack = {
            t: "ack",
            id,
            ok: false,
            error: "unknownPack",
            message: "Pack not found.",
          };
        else {
          const result = this.apply(
            c.role === "host" ? { kind: "host" } : { kind: "player", playerId: c.publicId },
            command,
          );
          if (result.ok) {
            state = result.state;
            ack = { t: "ack", id, ok: true, revision: state.revision };
          } else
            ack = {
              t: "ack",
              id,
              ok: false,
              error: result.rejection.code,
              message: result.rejection.message,
            };
        }
      }
      // Only accepted commands need durable replay. One identity cannot evict another's retries.
      if (ack.ok) {
        const own = this.recent.filter((entry) => entry.identity === identity).slice(-31);
        const others = this.recent.filter((entry) => entry.identity !== identity);
        this.commit(state, [...others, ...own, { identity, ack }]);
      }
      c.send(ack);
      if (ack.ok) this.broadcast();
    });
  }
  closeWhere(predicate: (c: Connection) => boolean, reason: CloseReason): void {
    for (const c of [...this.connections]) {
      if (predicate(c)) {
        c.send({ t: "closing", reason });
        c.close(WS_CLOSE.intentional);
        void this.detach(c).catch(() => undefined);
      }
    }
  }
  closeRoom(): void {
    this.deps.db.run("DELETE FROM rooms WHERE code = ?", this.code);
    this.closed = true;
    this.deps.onMembersChanged(this.code, this.members, new Set());
    clearTimeout(this.timer);
    this.latencies.clear();
    this.closeWhere(() => true, "roomClosed");
    this.deps.onClosed(this.code);
  }
  shutdown(): Promise<void> {
    return this.run(() => {
      if (this.closed) return;
      // Freeze at shutdown time, rather than recovering the timer from the last command's clock.
      const result = this.apply(
        { kind: "system" },
        { type: "setPresence", target: { role: "host" }, connected: false },
      );
      if (result.ok) this.commit(result.state);
      this.closed = true;
      clearTimeout(this.timer);
      this.latencies.clear();
      this.closeWhere(() => true, "serverShutdown");
    });
  }
  static restore(row: RoomRow, deps: RoomDeps): Room | null {
    const state = deps.engine.restore(JSON.parse(row.state_json));
    if (!state) return null;
    // Only this server writes the ack cache; engine.restore validates the game separately.
    return new Room(
      row.code,
      row.host_id,
      state,
      JSON.parse(row.recent_json) as Recent[],
      row.updated_at,
      deps,
    );
  }
}
