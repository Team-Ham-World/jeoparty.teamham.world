import type {
  EngineApi,
  GameState,
  HostView,
  PlayerView,
  DisplayView,
  Command,
  GameSettings,
  ViewCommon,
} from "@/features/engine/contract";
import type { QuestionPack } from "@/features/content";
import { createApp } from "./app";
import { loadConfig } from "./config";

/** The fake engine's own state. It crosses the EngineApi boundary as an opaque GameState. */
interface FakeState {
  schema: "ham-quiz/game@1";
  revision: number;
  roomCode: string;
  players: { id: string; name: string; score: number; connected: boolean }[];
  waitingPlayers: { id: string; name: string }[];
  phase: ViewCommon["phase"];
  hostConnected: boolean;
  commands: string[];
  pack: QuestionPack | null;
  deadline: { timerId: string; at: number } | null;
}
export function fakeEngine() {
  const applied: Command[] = [];
  const settings: GameSettings = {
    rounds: 1,
    categoriesPerRound: 1,
    wagerClues: [0, 0],
    finalRound: false,
    timers: {
      enabled: false,
      buzzWindowMs: 10000,
      answerWindowMs: 10000,
      finalAnswerMs: 45000,
    },
  };
  const read = (state: GameState): FakeState => state as unknown as FakeState;
  const write = (state: FakeState): GameState => state as unknown as GameState;
  const common = (raw: GameState, now: number): ViewCommon => {
    const s = read(raw);
    return {
      revision: s.revision,
      serverNow: now,
      roomCode: s.roomCode,
      phase: s.phase,
      paused: null,
      hostConnected: s.hostConnected,
      players: s.players,
      waitingPlayers: s.waitingPlayers,
      controllerId: null,
      round: null,
      timer: null,
      clue: null,
      final: null,
      results: null,
      pack: s.pack ? { id: s.pack.id, title: s.pack.title } : null,
      lastEvent: null,
    };
  };
  const api: EngineApi = {
    createGame: ({ roomCode }) =>
      write({
        schema: "ham-quiz/game@1",
        roomCode,
        revision: 0,
        players: [],
        waitingPlayers: [],
        phase: "lobby",
        hostConnected: false,
        commands: [],
        pack: null,
        deadline: null,
      }),
    defaultSettings: () => settings,
    apply(raw, actor, cmd) {
      applied.push(cmd);
      const s = structuredClone(read(raw));
      const reject = (code: "gameFull" | "unknownPlayer" | "forbidden") => ({
        ok: false as const,
        rejection: { code, message: code },
      });
      if (cmd.type === "addPlayer") {
        if (s.phase === "lobby" && s.players.length >= 6)
          return reject("gameFull");
        if (s.phase === "lobby")
          s.players.push({
            id: cmd.playerId,
            name: cmd.name,
            score: 0,
            connected: false,
          });
        else s.waitingPlayers.push({ id: cmd.playerId, name: cmd.name });
      }
      if (cmd.type === "removeMember" || cmd.type === "removePlayer") {
        s.players = s.players.filter((p) => p.id !== cmd.playerId);
        s.waitingPlayers = s.waitingPlayers.filter(
          (p) => p.id !== cmd.playerId,
        );
      }
      if (cmd.type === "renamePlayer")
        for (const p of [...s.players, ...s.waitingPlayers])
          if (p.id === cmd.playerId) p.name = cmd.name;
      if (cmd.type === "setPresence") {
        if (cmd.target.role === "host") s.hostConnected = cmd.connected;
        else {
          const target = cmd.target;
          for (const p of s.players)
            if (p.id === target.playerId) p.connected = cmd.connected;
        }
      }
      if (cmd.type === "setPack") s.pack = cmd.pack;
      if (cmd.type === "startGame") s.phase = "board";
      if (cmd.type === "timerExpired") s.deadline = null;
      if (actor.kind === "player" && cmd.type === "startGame")
        return reject("forbidden");
      s.commands.push(cmd.type);
      return {
        ok: true,
        state: write({ ...s, revision: s.revision + 1 }),
        events: [],
      };
    },
    nextDeadline: (raw) => read(raw).deadline,
    hostView: (s, now): HostView => ({
      ...common(s, now),
      audience: "host",
      board: null,
      settings,
      allowedCommands: [],
      startBlockers: [],
      wagerBounds: null,
      scoreLog: [],
    }),
    playerView: (raw, id, now): PlayerView | null => {
      const s = read(raw),
        p = s.players.find((p) => p.id === id),
        waiting = s.waitingPlayers.find((p) => p.id === id);
      if (!p && !waiting) return null;
      return {
        ...common(raw, now),
        audience: "player",
        board: null,
        me: {
          id,
          name: p?.name ?? waiting!.name,
          score: p?.score ?? 0,
          status: waiting ? "waiting" : "playing",
        },
        can: { buzz: true, wager: null, finalWager: null, finalAnswer: false },
        myFinal: null,
      };
    },
    displayView: (s, now): DisplayView => ({
      ...common(s, now),
      audience: "display",
      board: null,
    }),
    restore: (raw) =>
      typeof raw === "object" &&
      raw !== null &&
      "schema" in raw &&
      raw.schema === "ham-quiz/game@1"
        ? (raw as unknown as GameState)
        : null,
  };
  return { api, applied, read, write };
}
export async function harness(databasePath = ":memory:") {
  let time = Date.now();
  const engine = fakeEngine();
  const app = await createApp(
    loadConfig({
      APP_ENV: "test",
      DATABASE_PATH: databasePath,
      PORT: "0",
      PUBLIC_ORIGIN: "http://127.0.0.1:3101",
    }),
    { engine: engine.api, now: () => time, timers: false },
  );
  const port = await app.listen();
  const base = `http://127.0.0.1:${port}`;
  return {
    app,
    engine,
    base,
    advance: (ms: number) => {
      time += ms;
    },
    stop: () => app.close(),
  };
}
export type Harness = Awaited<ReturnType<typeof harness>>;
export class Browser {
  cookie = "";
  csrf = "";
  constructor(readonly h: Harness) {}
  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    const response = await fetch(`${this.h.base}${path}`, {
      ...init,
      headers,
      redirect: "manual",
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) this.cookie = cookie.split(";")[0];
    return response;
  }
  async beginLogin(returnTo = "/") {
    const res = await this.request(
      `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`,
    );
    return new URL(res.headers.get("location")!).searchParams;
  }
  async decide(
    params: URLSearchParams,
    options: { username?: string; deny?: boolean; hide?: boolean } = {},
  ) {
    const form = new URLSearchParams(params);
    form.set("username", options.username ?? "alice");
    if (options.deny) form.set("action", "deny");
    if (options.hide) form.set("hide_username", "1");
    const res = await this.request("/__ham/authorize/decide", {
      method: "POST",
      headers: {
        origin: this.h.app.config.publicOrigin,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    return new URL(res.headers.get("location")!);
  }
  callback(url: URL) {
    return this.request(url.pathname + url.search);
  }
  async signIn(username: string) {
    const result = await this.callback(
      await this.decide(await this.beginLogin(), { username }),
    );
    const info = await (await this.request("/api/session")).json();
    this.csrf = info.csrfToken;
    return result;
  }
  mutate(
    path: string,
    body?: unknown,
    method = "POST",
    headers: Record<string, string> = {},
  ) {
    return this.request(path, {
      method,
      headers: {
        origin: this.h.app.config.publicOrigin,
        "x-quiz-csrf": this.csrf,
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  async createRoom() {
    return (await (await this.mutate("/api/rooms", {})).json()).code as string;
  }
}
