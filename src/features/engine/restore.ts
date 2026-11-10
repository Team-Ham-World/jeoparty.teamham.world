import { validateQuestionPack } from "@/features/content";
import { MAX_FINAL_ANSWER_LENGTH, MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS } from "./contract";
import type { GameState } from "./state";
import { freezeAfterRestart, validSettings } from "./rules";

type Check = (value: unknown) => boolean;
const string: Check = (v) => typeof v === "string";
const bool: Check = (v) => typeof v === "boolean";
const number: Check = (v) => typeof v === "number" && Number.isFinite(v);
const integer: Check = (v) => number(v) && Number.isSafeInteger(v);
const nonnegative: Check = (v) => integer(v) && Number(v) >= 0;
const oneOf =
  (...values: unknown[]): Check =>
  (v) =>
    values.includes(v);
const nullable =
  (check: Check): Check =>
  (v) =>
    v === null || check(v);
const array =
  (check: Check): Check =>
  (v) =>
    Array.isArray(v) && v.every(check);
const record =
  (check: Check): Check =>
  (v) =>
    !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(check);
const object =
  (fields: Record<string, Check>): Check =>
  (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const entries = Object.entries(v);
    return (
      entries.length === Object.keys(fields).length &&
      entries.every(([key, value]) => Object.hasOwn(fields, key) && fields[key](value))
    );
  };
const player = object({ id: string, name: string, score: integer, connected: bool });
const response = object({
  playerId: string,
  status: oneOf("hidden", "revealed", "judged"),
  answer: nullable(string),
  wager: nullable(nonnegative),
  correct: nullable(bool),
  delta: nullable(integer),
});
const attempt = object({
  id: string,
  playerId: string,
  result: oneOf("pending", "correct", "incorrect"),
  timedOut: bool,
  delta: nullable(integer),
});
const timer = object({
  id: string,
  kind: oneOf("buzz", "answer", "finalAnswer"),
  durationMs: nonnegative,
  endsAt: nullable(number),
  remainingMs: (v) => number(v) && Number(v) >= 0,
});
const pause = object({ reason: oneOf("host", "hostOffline", "restored"), since: number });
const cell = object({
  clueId: string,
  value: nonnegative,
  state: oneOf("available", "active", "completed"),
  wager: bool,
});
const board = object({
  roundIndex: nonnegative,
  roundTitle: string,
  categories: array(object({ id: string, title: string, cells: array(cell) })),
});
const clue = object({
  clueId: string,
  categoryTitle: string,
  value: nonnegative,
  kind: oneOf("standard", "wager"),
  stage: oneOf("wager", "reading", "open", "answering", "closed", "revealed"),
  prompt: string,
  answer: string,
  wager: nullable(nonnegative),
  answeringPlayerId: nullable(string),
  attempts: array(attempt),
  lockedOutPlayerIds: array(string),
  ended: bool,
  opensAt: nullable(number),
  buzzResult: nullable(
    object({
      winnerId: string,
      marginMs: nullable((v) => number(v) && Number(v) >= 0),
      contenderCount: nonnegative,
    }),
  ),
  collection: nullable(
    object({
      id: string,
      decidesAt: number,
      candidates: array(object({ playerId: string, effectiveMs: number, arrivalMs: number })),
    }),
  ),
});
const final = object({
  stage: oneOf("wagers", "answering", "judging", "done"),
  categoryTitle: string,
  prompt: string,
  answer: string,
  eligiblePlayerIds: array(string),
  startingScores: record(integer),
  wagers: record(nonnegative),
  answers: record(string),
  responses: array(response),
});
const eventChecks: Record<string, Check> = {};
const eventFields: Record<string, Record<string, Check>> = {
  playerJoined: { playerId: string },
  gameStarted: {},
  roundStarted: { roundIndex: nonnegative },
  clueSelected: { clueId: string, wager: bool },
  buzzersOpened: { clueId: string },
  buzzAccepted: { clueId: string, playerId: string },
  wagerSubmitted: { clueId: string, playerId: string, amount: nonnegative },
  judged: { clueId: string, playerId: string, correct: bool, delta: integer },
  attemptsEnded: { clueId: string },
  revealed: { clueId: string },
  timerExpired: { timer: oneOf("buzz", "answer", "finalAnswer") },
  finalStarted: {},
  finalClueShown: {},
  finalResponseRevealed: { playerId: string },
  finalJudged: { playerId: string, correct: bool, delta: integer },
  scoreAdjusted: { playerId: string, delta: integer },
  paused: { reason: oneOf("host", "hostOffline", "restored") },
  resumed: {},
  gameOver: { winnerIds: array(string) },
};
for (const [kind, fields] of Object.entries(eventFields))
  eventChecks[kind] = object({ kind: oneOf(kind), ...fields });
const event: Check = (v) => Object.values(eventChecks).some((check) => check(v));
const stateShape = object({
  schema: oneOf("ham-quiz/game@1"),
  revision: nonnegative,
  roomCode: string,
  rng: (v) => nonnegative(v) && Number(v) <= 0xffffffff,
  phase: oneOf("lobby", "roundIntro", "board", "clue", "final", "results"),
  pack: nullable((v) => validateQuestionPack(v).ok),
  settings: object({
    rounds: oneOf(1, 2),
    categoriesPerRound: nonnegative,
    wagerClues: (v) => Array.isArray(v) && v.length === 2 && v.every(nonnegative),
    finalRound: bool,
    fairBuzzing: bool,
    falseStartLockout: bool,
    timers: object({
      enabled: bool,
      buzzWindowMs: nonnegative,
      answerWindowMs: nonnegative,
      finalAnswerMs: nonnegative,
    }),
  }),
  players: array(player),
  waitingPlayers: array(player),
  departedPlayerIds: array(string),
  hostConnected: bool,
  paused: nullable(pause),
  timer: nullable(timer),
  controllerId: nullable(string),
  roundIndex: nonnegative,
  boards: array(board),
  clue: nullable(clue),
  final: nullable(final),
  scoreLog: array(
    object({
      revision: nonnegative,
      at: number,
      playerId: string,
      delta: integer,
      kind: oneOf("clue", "wager", "final", "adjustment"),
      reason: string,
    }),
  ),
  lastEvent: nullable(object({ revision: nonnegative, event })),
  updatedAt: number,
});

/**
 * An old save has no opening time, so treat the buzzers as already open. A paused
 * game must not open after its pause began, or resume reads the gap as remaining lead.
 */
function migratedOpensAt(updatedAt: unknown, paused: unknown): unknown {
  const since = paused && typeof paused === "object" && "since" in paused ? paused.since : null;
  return typeof updatedAt === "number" && typeof since === "number"
    ? Math.min(updatedAt, since)
    : updatedAt;
}

/** Persistence is a trust boundary: validate structure, references and active-stage invariants. */
export function restore(raw: unknown): GameState | null {
  try {
    // Reject values that JSON would silently omit or replace with null.
    const json: unknown = JSON.parse(
      JSON.stringify(raw, (_key, value: unknown) => {
        if (
          value === undefined ||
          typeof value === "function" ||
          typeof value === "symbol" ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          throw new Error("Invalid persisted JSON");
        return value;
      }),
    );
    // Additive migration for games saved before fair buzzing. Invalid present fields still fail validation.
    if (
      json &&
      typeof json === "object" &&
      "settings" in json &&
      json.settings &&
      typeof json.settings === "object"
    ) {
      if (!("fairBuzzing" in json.settings)) Object.assign(json.settings, { fairBuzzing: true });
      if (!("falseStartLockout" in json.settings))
        Object.assign(json.settings, { falseStartLockout: true });
      if ("clue" in json && json.clue && typeof json.clue === "object") {
        if (!("opensAt" in json.clue))
          Object.assign(json.clue, {
            opensAt:
              "stage" in json.clue && json.clue.stage === "open" && "updatedAt" in json
                ? migratedOpensAt(json.updatedAt, "paused" in json ? json.paused : null)
                : null,
          });
        if (!("collection" in json.clue)) Object.assign(json.clue, { collection: null });
        if (!("buzzResult" in json.clue)) Object.assign(json.clue, { buzzResult: null });
      }
    }
    if (!stateShape(json)) return null;
    const s = json as GameState; // All fields checked above; relations checked below.
    if (s.pack && !validSettings(s.settings, s.pack)) return null;
    const members = [...s.players, ...s.waitingPlayers];
    const ids = new Set(members.map((p) => p.id));
    const playing = new Set(s.players.map((p) => p.id));
    if (
      ids.size !== members.length ||
      s.players.length > MAX_PLAYERS ||
      members.some((p) => !p.id || !p.name.trim() || p.name.length > MAX_NAME_LENGTH)
    )
      return null;
    if (
      new Set(s.departedPlayerIds).size !== s.departedPlayerIds.length ||
      s.departedPlayerIds.some((id) => !playing.has(id))
    )
      return null;
    if (s.controllerId !== null && !playing.has(s.controllerId)) return null;
    if (s.lastEvent && s.lastEvent.revision > s.revision) return null;
    if (s.scoreLog.some((e) => !playing.has(e.playerId) || e.revision > s.revision)) return null;
    if (s.phase === "lobby") {
      if (s.boards.length || s.clue || s.final || s.timer || s.paused) return null;
    } else {
      if (
        !s.pack ||
        s.players.length < MIN_PLAYERS ||
        s.boards.length !== s.settings.rounds ||
        !s.boards[s.roundIndex] ||
        !s.controllerId
      )
        return null;
    }
    if ((s.phase === "clue") !== (s.clue !== null) || (s.phase === "final") !== (s.final !== null))
      return null;
    for (const [r, board] of s.boards.entries()) {
      const categories = s.pack!.categories.slice(
        r * s.settings.categoriesPerRound,
        (r + 1) * s.settings.categoriesPerRound,
      );
      if (board.roundIndex !== r || board.categories.length !== categories.length) return null;
      for (const [i, category] of board.categories.entries()) {
        const source = categories[i];
        const clues = [...source.clues].sort((a, b) => a.tier - b.tier);
        if (
          category.id !== source.id ||
          category.cells.length !== clues.length ||
          category.cells.some((cell, j) => cell.clueId !== clues[j].id)
        )
          return null;
      }
    }
    const activeCells = s.boards
      .flatMap((b) => b.categories.flatMap((c) => c.cells))
      .filter((c) => c.state === "active");
    if (activeCells.length !== (s.clue ? 1 : 0)) return null;
    if (s.clue) {
      const c = s.clue;
      if (
        activeCells[0].clueId !== c.clueId ||
        c.attempts.some((a) => !playing.has(a.playerId)) ||
        new Set(c.attempts.map((a) => a.playerId)).size !== c.attempts.length
      )
        return null;
      if (c.stage === "open" && c.opensAt === null) return null;
      if (
        c.buzzResult &&
        (!playing.has(c.buzzResult.winnerId) ||
          !c.attempts.some((a) => a.playerId === c.buzzResult!.winnerId) ||
          c.buzzResult.contenderCount < 1 ||
          c.buzzResult.contenderCount > s.players.length ||
          (c.buzzResult.contenderCount === 1) !== (c.buzzResult.marginMs === null))
      )
        return null;
      if (c.collection) {
        const entries = c.collection.candidates;
        if (
          !s.settings.fairBuzzing ||
          c.stage !== "open" ||
          c.kind !== "standard" ||
          c.opensAt === null ||
          s.timer ||
          !entries.length ||
          entries.length > s.players.length ||
          new Set(entries.map((e) => e.playerId)).size !== entries.length ||
          entries.some(
            (e) =>
              !playing.has(e.playerId) ||
              e.effectiveMs < c.opensAt! - 40 ||
              e.effectiveMs > e.arrivalMs ||
              e.arrivalMs > c.collection!.decidesAt ||
              c.attempts.some((a) => a.playerId === e.playerId),
          ) ||
          c.collection.decidesAt < entries[0].arrivalMs ||
          c.collection.decidesAt > entries[0].arrivalMs + 250
        )
          return null;
      }
      const pending = c.attempts.filter((a) => a.result === "pending");
      if (
        pending.length !== (c.stage === "answering" ? 1 : 0) ||
        (c.stage === "answering" &&
          (pending[0] !== c.attempts.at(-1) || pending[0].playerId !== c.answeringPlayerId))
      )
        return null;
      if (c.kind === "standard" && (c.stage === "wager" || c.wager !== null)) return null;
      if (c.lockedOutPlayerIds.some((id) => !playing.has(id))) return null;
      if (c.attempts.some((a) => (a.result === "pending") !== (a.delta === null))) return null;
    }
    if (s.final) {
      const f = s.final;
      if (
        !f.eligiblePlayerIds.length ||
        new Set(f.eligiblePlayerIds).size !== f.eligiblePlayerIds.length ||
        f.eligiblePlayerIds.some((id) => !playing.has(id) || !(f.startingScores[id] > 0))
      )
        return null;
      for (const data of [f.startingScores, f.wagers, f.answers])
        if (Object.keys(data).some((id) => !f.eligiblePlayerIds.includes(id))) return null;
      if (
        Object.entries(f.wagers).some(([id, w]) => w > f.startingScores[id]) ||
        Object.values(f.answers).some((a) => a.length > MAX_FINAL_ANSWER_LENGTH)
      )
        return null;
      if (f.stage === "wagers" || f.stage === "answering") {
        if (f.responses.length) return null;
      } else {
        const order = [...f.eligiblePlayerIds].sort(
          (a, b) =>
            f.startingScores[a] - f.startingScores[b] ||
            s.players.findIndex((p) => p.id === b) - s.players.findIndex((p) => p.id === a),
        );
        if (
          f.responses.length !== order.length ||
          f.responses.some(
            (r, i) =>
              r.playerId !== order[i] ||
              r.answer !== (Object.hasOwn(f.answers, r.playerId) ? f.answers[r.playerId] : "") ||
              r.wager !== (Object.hasOwn(f.wagers, r.playerId) ? f.wagers[r.playerId] : 0),
          )
        )
          return null;
        let sawUnjudged = false;
        for (const r of f.responses) {
          if (sawUnjudged && r.status !== "hidden") return null;
          if (r.status !== "judged") {
            sawUnjudged = true;
            if (r.correct !== null || r.delta !== null) return null;
          } else if (r.correct === null || r.delta !== (r.correct ? 1 : -1) * r.wager!) return null;
        }
        if ((f.stage === "done") !== !sawUnjudged) return null;
      }
    }
    if (s.timer) {
      const t = s.timer;
      if (t.remainingMs > t.durationMs || (s.paused !== null) !== (t.endsAt === null)) return null;
      if (
        t.kind === "buzz"
          ? s.clue?.stage !== "open"
          : t.kind === "answer"
            ? s.clue?.stage !== "answering"
            : s.final?.stage !== "answering"
      )
        return null;
    }
    freezeAfterRestart(s);
    return s;
  } catch {
    return null;
  }
}
