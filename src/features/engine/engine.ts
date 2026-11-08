import type { EngineApi, GameEvent } from "./contract";
import { execute, rejection } from "./commands";
import { defaultSettings } from "./rules";
import { restore } from "./restore";
import { displayView, hostView, playerView } from "./views";

export const engine: EngineApi = {
  createGame: ({ roomCode, seed, now }) => ({
    schema: "ham-quiz/game@1",
    revision: 0,
    roomCode,
    rng: seed >>> 0,
    phase: "lobby",
    pack: null,
    settings: {
      categoriesPerRound: 6,
      rounds: 1,
      wagerClues: [1, 2],
      finalRound: true,
      fairBuzzing: true,
      falseStartLockout: true,
      timers: {
        enabled: true,
        buzzWindowMs: 10_000,
        answerWindowMs: 10_000,
        finalAnswerMs: 45_000,
      },
    },
    players: [],
    waitingPlayers: [],
    departedPlayerIds: [],
    hostConnected: true,
    paused: null,
    timer: null,
    controllerId: null,
    roundIndex: 0,
    boards: [],
    clue: null,
    final: null,
    scoreLog: [],
    lastEvent: null,
    updatedAt: now,
  }),
  defaultSettings,
  apply: (state, actor, command, now) => {
    if (!Number.isFinite(now)) return { ok: false, rejection: rejection("forbidden") };
    const draft = { ...structuredClone(state), revision: state.revision + 1 };
    const events: GameEvent[] = [];
    try {
      const code = execute(draft, actor, command, now, events);
      if (code) return { ok: false, rejection: rejection(code) };
    } catch {
      // Malformed external payloads cannot partially apply or escape as exceptions.
      return { ok: false, rejection: rejection("forbidden") };
    }
    if (draft.timer?.endsAt !== null && draft.timer)
      draft.timer.remainingMs = Math.min(
        draft.timer.durationMs,
        Math.max(0, draft.timer.endsAt! - now),
      );
    draft.updatedAt = now;
    return { ok: true, state: draft, events };
  },
  nextDeadline: (state) => {
    if (state.paused) return null;
    if (state.clue?.collection)
      return { timerId: state.clue.collection.id, at: state.clue.collection.decidesAt };
    return state.timer?.endsAt == null ? null : { timerId: state.timer.id, at: state.timer.endsAt };
  },
  hostView,
  playerView,
  displayView,
  restore,
};
