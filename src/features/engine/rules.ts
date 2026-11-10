import type { QuestionPack } from "@/features/content";
import { MIN_WAGER } from "./contract";
import type { GameEvent, GameSettings, PauseReason, ResultsView, TimerKind } from "./contract";
import type { GameState } from "./state";

export function defaultSettings(pack: QuestionPack): GameSettings {
  const categoriesPerRound = Math.min(6, pack.categories.length);
  const rounds = pack.categories.length >= 2 * categoriesPerRound ? 2 : 1;
  const cells = categoriesPerRound * pack.dimensions.cluesPerCategory;
  return {
    categoriesPerRound,
    rounds,
    wagerClues: [Math.min(1, cells), Math.min(2, cells)],
    finalRound: true,
    fairBuzzing: true,
    falseStartLockout: true,
    timers: { enabled: true, buzzWindowMs: 10_000, answerWindowMs: 10_000, finalAnswerMs: 45_000 },
  };
}

export function validSettings(settings: GameSettings, pack: QuestionPack): boolean {
  const { categoriesPerRound: c, rounds: r, wagerClues: w, timers: t } = settings;
  const integer = (x: number, min: number, max: number) =>
    Number.isSafeInteger(x) && x >= min && x <= max;
  return (
    (r === 1 || r === 2) &&
    integer(c, 1, 6) &&
    c * r <= pack.categories.length &&
    Array.isArray(w) &&
    w.length === 2 &&
    w.every((n) => integer(n, 0, Math.min(3, c * pack.dimensions.cluesPerCategory))) &&
    typeof settings.finalRound === "boolean" &&
    typeof settings.fairBuzzing === "boolean" &&
    typeof settings.falseStartLockout === "boolean" &&
    !!t &&
    typeof t.enabled === "boolean" &&
    integer(t.buzzWindowMs, 3000, 60_000) &&
    integer(t.answerWindowMs, 3000, 60_000) &&
    integer(t.finalAnswerMs, 10_000, 180_000)
  );
}

/** LCG: all arithmetic and the next generator state survive a JSON round trip. */
export function randomIndex(state: GameState, length: number): number {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return Math.floor((state.rng / 4294967296) * length);
}

export function buildBoards(state: GameState, pack: QuestionPack) {
  const first = pack.scoring.rounds.find((r) => r.id === pack.scoring.defaultRoundId)!;
  const second = pack.scoring.rounds.find((r) => r.id !== first.id);
  return Array.from({ length: state.settings.rounds }, (_, roundIndex) => {
    const scoring = roundIndex === 0 ? first : (second ?? first);
    const multiplier = roundIndex === 1 && !second ? 2 : 1;
    const c = state.settings.categoriesPerRound;
    const categories = pack.categories
      .slice(roundIndex * c, (roundIndex + 1) * c)
      .map((category) => ({
        id: category.id,
        title: category.title,
        cells: [...category.clues]
          .sort((a, b) => a.tier - b.tier)
          .map((clue) => ({
            clueId: clue.id,
            value: scoring.pointsByTier[clue.tier] * multiplier,
            state: "available" as const,
            wager: false,
          })),
      }));
    const cells = categories.flatMap((category) => category.cells);
    const tiers = new Map(
      pack.categories.flatMap((category) =>
        category.clues.map((clue) => [clue.id, clue.tier] as const),
      ),
    );
    const lowest = Math.min(...cells.map((cell) => tiers.get(cell.clueId)!));
    let candidates = cells.filter((cell) => tiers.get(cell.clueId)! > lowest);
    for (let i = 0; i < state.settings.wagerClues[roundIndex]; i++) {
      if (!candidates.length) candidates = cells.filter((cell) => !cell.wager);
      const [cell] = candidates.splice(randomIndex(state, candidates.length), 1);
      cell.wager = true;
    }
    return {
      roundIndex,
      roundTitle: roundIndex === 0 || second ? scoring.title : "Round 2",
      categories,
    };
  });
}

export const currentBoard = (state: GameState) => state.boards[state.roundIndex] ?? null;
export const eligibleBuzzers = (state: GameState) =>
  state.players.filter((p) => !state.clue?.attempts.some((a) => a.playerId === p.id));
export function wagerBounds(state: GameState) {
  if (state.clue?.stage !== "wager") return null;
  return {
    min: MIN_WAGER,
    // Includes the minimum so a board of very small values still has a legal wager.
    max: Math.max(
      MIN_WAGER,
      state.players.find((p) => p.id === state.controllerId)?.score ?? 0,
      ...currentBoard(state)!.categories.flatMap((c) => c.cells.map((cell) => cell.value)),
    ),
  };
}
export function event(state: GameState, events: GameEvent[], value: GameEvent) {
  events.push(value);
  state.lastEvent = { revision: state.revision, event: value };
}
export function startTimer(state: GameState, kind: TimerKind, now: number) {
  if (!state.settings.timers.enabled) {
    state.timer = null;
    return;
  }
  const durationMs =
    kind === "buzz"
      ? state.settings.timers.buzzWindowMs
      : kind === "answer"
        ? state.settings.timers.answerWindowMs
        : state.settings.timers.finalAnswerMs;
  state.timer = {
    id: `timer-${state.revision}`,
    kind,
    durationMs,
    endsAt: now + durationMs,
    remainingMs: durationMs,
  };
}
export function pause(state: GameState, reason: PauseReason, now: number, events: GameEvent[]) {
  if (state.timer?.endsAt !== null && state.timer) {
    state.timer.remainingMs = Math.max(
      0,
      state.timer.endsAt! -
        Math.max(now, state.timer.kind === "buzz" ? (state.clue?.opensAt ?? now) : now),
    );
    state.timer.endsAt = null;
  }
  state.paused = { reason, since: now };
  event(state, events, { kind: "paused", reason });
}
/**
 * The one recovery rule for a backend restart: everyone is offline, and a game in progress is
 * paused with its timer frozen at the last saved command time. `restore` applies it when a
 * saved game is loaded, and the `restored` command applies it and announces the pause.
 */
export function freezeAfterRestart(state: GameState) {
  state.hostConnected = false;
  [...state.players, ...state.waitingPlayers].forEach((p) => {
    p.connected = false;
  });
  if (state.phase === "lobby" || state.phase === "results") return;
  if (state.timer && state.timer.endsAt !== null) {
    state.timer.remainingMs = Math.min(
      state.timer.durationMs,
      Math.max(0, state.timer.endsAt - state.updatedAt),
    );
    state.timer.endsAt = null;
  }
  state.paused = { reason: "restored", since: state.paused?.since ?? state.updatedAt };
}
export function standings(state: GameState): ResultsView {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const entries = sorted.map((p, i) => ({
    playerId: p.id,
    name: p.name,
    score: p.score,
    rank: sorted.findIndex((other) => other.score === sorted[i].score) + 1,
  }));
  return {
    standings: entries,
    winnerIds: entries.filter((p) => p.rank === 1).map((p) => p.playerId),
  };
}
export function results(state: GameState, events: GameEvent[]) {
  for (const b of state.boards)
    for (const c of b.categories)
      for (const cell of c.cells) if (cell.state === "active") cell.state = "completed";
  state.phase = "results";
  state.timer = null;
  state.paused = null;
  state.clue = null;
  state.final = null;
  event(state, events, { kind: "gameOver", winnerIds: standings(state).winnerIds });
}
export function ownValue<T>(values: Record<string, T>, id: string): T | undefined {
  return Object.hasOwn(values, id) ? values[id] : undefined;
}
export function lockFinal(state: GameState) {
  const f = state.final!;
  f.stage = "judging";
  state.timer = null;
  f.responses = [...f.eligiblePlayerIds]
    .sort(
      (a, b) =>
        f.startingScores[a] - f.startingScores[b] ||
        state.players.findIndex((p) => p.id === b) - state.players.findIndex((p) => p.id === a),
    )
    .map((playerId) => ({
      playerId,
      status: "hidden",
      answer: ownValue(f.answers, playerId) ?? "",
      wager: ownValue(f.wagers, playerId) ?? 0,
      correct: null,
      delta: null,
    }));
}
export function advanceRound(state: GameState, now: number, events: GameEvent[]) {
  state.clue = null;
  state.timer = null;
  if (state.roundIndex + 1 < state.settings.rounds) {
    state.roundIndex++;
    state.controllerId = [...state.players].sort((a, b) => a.score - b.score)[0].id;
    state.phase = "roundIntro";
    event(state, events, { kind: "roundStarted", roundIndex: state.roundIndex });
  } else if (state.settings.finalRound && state.players.some((p) => p.score > 0)) {
    const pack = state.pack!;
    const unused = pack.categories[state.settings.rounds * state.settings.categoriesPerRound];
    const category =
      unused ??
      pack.categories[
        randomIndex(state, state.settings.rounds * state.settings.categoriesPerRound)
      ];
    const eligible = state.players.filter((p) => p.score > 0);
    state.final = {
      stage: "wagers",
      categoryTitle: category.title,
      prompt: category.finalClue.prompt,
      answer: category.finalClue.answer,
      eligiblePlayerIds: eligible.map((p) => p.id),
      startingScores: Object.fromEntries(eligible.map((p) => [p.id, p.score])),
      wagers: {},
      answers: {},
      responses: [],
    };
    state.phase = "final";
    event(state, events, { kind: "finalStarted" });
  } else results(state, events);
}
export function score(
  state: GameState,
  playerId: string,
  delta: number,
  kind: "clue" | "wager" | "final" | "adjustment",
  reason: string,
  now: number,
) {
  state.players.find((p) => p.id === playerId)!.score += delta;
  state.scoreLog.push({ revision: state.revision, at: now, playerId, delta, kind, reason });
}

/** Both immediate buzzing and collected decisions use the same answer transition. */
export function acceptBuzz(state: GameState, playerId: string, now: number, events: GameEvent[]) {
  const clue = state.clue!;
  clue.collection = null;
  clue.stage = "answering";
  clue.answeringPlayerId = playerId;
  clue.attempts.push({
    id: `attempt-${state.revision}`,
    playerId,
    result: "pending",
    timedOut: false,
    delta: null,
  });
  startTimer(state, "answer", now);
  event(state, events, { kind: "buzzAccepted", clueId: clue.clueId, playerId });
}
export function decideBuzz(state: GameState, now: number, events: GameEvent[]) {
  const clue = state.clue!;
  const candidates = [...clue.collection!.candidates].sort((a, b) => a.effectiveMs - b.effectiveMs);
  clue.buzzResult = {
    winnerId: candidates[0].playerId,
    marginMs: candidates.length > 1 ? candidates[1].effectiveMs - candidates[0].effectiveMs : null,
    contenderCount: candidates.length,
  };
  acceptBuzz(state, candidates[0].playerId, now, events);
}
