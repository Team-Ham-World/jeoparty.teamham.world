/**
 * HAM Quiz engine contract.
 *
 * Rules live in docs/RULES.md. This file is the typed interface between the
 * engine (pure rules), the server (identity, ordering, storage, delivery) and
 * the screens (which only render views and request commands).
 *
 * Everything here is plain JSON-serializable data. The engine is pure: it never
 * reads the clock, random numbers, the network or storage. Time arrives as
 * `now` (epoch ms) and randomness comes from a seed stored in the game state.
 */
import type { QuestionPack } from "@/features/content";

export type PlayerId = string; // Server-assigned opaque public id. Never a HAM `sub`.
export type ClueId = string;
export type AttemptId = string;
export type TimerId = string;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MAX_NAME_LENGTH = 32;
export const MAX_FINAL_ANSWER_LENGTH = 200;
export const MAX_ADJUSTMENT_REASON_LENGTH = 120;
export const MAX_ADJUSTMENT_DELTA = 100_000;
export const MIN_WAGER = 5;

// ---------------------------------------------------------------------------
// Settings

export interface TimerSettings {
  enabled: boolean;
  buzzWindowMs: number;
  answerWindowMs: number;
  finalAnswerMs: number;
}

export interface GameSettings {
  rounds: 1 | 2;
  categoriesPerRound: number;
  /** Wager clues for round 1 and round 2. */
  wagerClues: readonly [number, number];
  finalRound: boolean;
  timers: TimerSettings;
}

export interface SettingsPatch {
  rounds?: 1 | 2;
  categoriesPerRound?: number;
  wagerClues?: readonly [number, number];
  finalRound?: boolean;
  timers?: Partial<TimerSettings>;
}

// ---------------------------------------------------------------------------
// Phases

export type Phase = "lobby" | "roundIntro" | "board" | "clue" | "final" | "results";
export type ClueStage = "wager" | "reading" | "open" | "answering" | "closed" | "revealed";
export type FinalStage = "wagers" | "answering" | "judging" | "done";
export type TimerKind = "buzz" | "answer" | "finalAnswer";
export type PauseReason = "host" | "hostOffline" | "restored";

// ---------------------------------------------------------------------------
// Actors and commands

/** Who sent a command. The server derives this from credentials, never from the payload. */
export type Actor = { kind: "host" } | { kind: "player"; playerId: PlayerId } | { kind: "system" };

export type HostCommand =
  | { type: "setPack"; pack: QuestionPack } // Built by the server after resolving a client's `choosePack`.
  | { type: "updateSettings"; patch: SettingsPatch }
  | { type: "removePlayer"; playerId: PlayerId }
  | { type: "startGame" }
  | { type: "continue" } // roundIntro → board
  | { type: "selectClue"; clueId: ClueId }
  | { type: "openBuzzers"; clueId: ClueId }
  | { type: "judge"; clueId: ClueId; attemptId: AttemptId; correct: boolean }
  | { type: "endAttempts"; clueId: ClueId }
  | { type: "reveal"; clueId: ClueId }
  | { type: "returnToBoard"; clueId: ClueId }
  | { type: "submitWager"; clueId: ClueId; amount: number } // On behalf of the controller.
  | { type: "showFinalClue" }
  | { type: "lockFinalAnswers" }
  | { type: "revealFinalResponse"; playerId: PlayerId }
  | { type: "judgeFinal"; playerId: PlayerId; correct: boolean }
  | { type: "finishGame" }
  | { type: "adjustScore"; playerId: PlayerId; delta: number; reason: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "endGame" }
  | { type: "playAgain" };

export type PlayerCommand =
  | { type: "buzz"; clueId: ClueId }
  | { type: "submitWager"; clueId: ClueId; amount: number }
  | { type: "submitFinalWager"; amount: number }
  | { type: "submitFinalAnswer"; text: string };

/** Only the server sends these. Clients can never submit them. */
export type SystemCommand =
  | { type: "addPlayer"; playerId: PlayerId; name: string } // Lobby → player; in game → waiting.
  | { type: "renamePlayer"; playerId: PlayerId; name: string }
  | { type: "removeMember"; playerId: PlayerId } // A player or waiting account left voluntarily.
  | { type: "setPresence"; target: { role: "host" } | { role: "player"; playerId: PlayerId }; connected: boolean }
  | { type: "timerExpired"; timerId: TimerId }
  | { type: "restored" }; // After a backend restart: pause games in progress.

export type Command = HostCommand | PlayerCommand | SystemCommand;
export type HostCommandType = HostCommand["type"];
export type PlayerCommandType = PlayerCommand["type"];

// ---------------------------------------------------------------------------
// Results

export type RejectionCode =
  | "forbidden" // This actor may not send this command.
  | "wrongPhase"
  | "paused"
  | "notPaused"
  | "noPack"
  | "invalidSettings"
  | "notEnoughPlayers"
  | "gameFull"
  | "unknownPlayer"
  | "alreadyJoined"
  | "invalidName"
  | "unknownClue"
  | "clueCompleted"
  | "staleClue" // Names a clue that is not the current one.
  | "staleAttempt"
  | "buzzersClosed"
  | "alreadyAttempted"
  | "mustJudgeFirst"
  | "noEligiblePlayers"
  | "notController"
  | "invalidWager"
  | "notEligible"
  | "submissionsLocked"
  | "outOfOrder"
  | "invalidAdjustment"
  | "staleTimer";

export interface Rejection {
  code: RejectionCode;
  /** Short, human-readable, safe to show to the sender. */
  message: string;
}

/**
 * Public-safe events for effects (sounds, flashes). They must never reveal
 * private data, such as a final wager before it is judged.
 */
export type GameEvent =
  | { kind: "playerJoined"; playerId: PlayerId }
  | { kind: "gameStarted" }
  | { kind: "roundStarted"; roundIndex: number }
  | { kind: "clueSelected"; clueId: ClueId; wager: boolean }
  | { kind: "buzzersOpened"; clueId: ClueId }
  | { kind: "buzzAccepted"; clueId: ClueId; playerId: PlayerId }
  | { kind: "wagerSubmitted"; clueId: ClueId; playerId: PlayerId; amount: number }
  | { kind: "judged"; clueId: ClueId; playerId: PlayerId; correct: boolean; delta: number }
  | { kind: "attemptsEnded"; clueId: ClueId }
  | { kind: "revealed"; clueId: ClueId }
  | { kind: "timerExpired"; timer: TimerKind }
  | { kind: "finalStarted" }
  | { kind: "finalClueShown" }
  | { kind: "finalResponseRevealed"; playerId: PlayerId }
  | { kind: "finalJudged"; playerId: PlayerId; correct: boolean; delta: number }
  | { kind: "scoreAdjusted"; playerId: PlayerId; delta: number }
  | { kind: "paused"; reason: PauseReason }
  | { kind: "resumed" }
  | { kind: "gameOver"; winnerIds: PlayerId[] };

/**
 * Engine-owned and JSON-serializable. Code outside src/features/engine treats
 * it as opaque apart from these header fields. The engine may replace this
 * declaration with its concrete interface, provided the header fields remain.
 */
export type { GameState } from "./state";
import type { GameState } from "./state";

export type EngineResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; rejection: Rejection };

// ---------------------------------------------------------------------------
// Views: what each audience may see. Private data is absent, not hidden.

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  score: number;
  connected: boolean;
}

export interface WaitingPlayer {
  id: PlayerId;
  name: string;
}

export interface TimerView {
  id: TimerId;
  kind: TimerKind;
  durationMs: number;
  /** Server epoch ms; null while paused. Use `serverNow` to correct client clock skew. */
  endsAt: number | null;
  remainingMs: number;
}

export interface PauseView {
  reason: PauseReason;
  since: number;
}

export type CellState = "available" | "active" | "completed";

export interface BoardCellView {
  clueId: ClueId;
  value: number;
  state: CellState;
}

export interface HostBoardCellView extends BoardCellView {
  wager: boolean;
}

export interface BoardCategoryView<Cell extends BoardCellView = BoardCellView> {
  id: string;
  title: string;
  cells: Cell[];
}

export interface BoardView<Cell extends BoardCellView = BoardCellView> {
  roundIndex: number;
  roundTitle: string;
  categories: BoardCategoryView<Cell>[];
}

export interface AttemptView {
  id: AttemptId;
  playerId: PlayerId;
  result: "pending" | "correct" | "incorrect";
  timedOut: boolean;
  /** Score change once judged; null while pending. */
  delta: number | null;
}

export interface ClueView {
  clueId: ClueId;
  categoryTitle: string;
  value: number;
  kind: "standard" | "wager";
  stage: ClueStage;
  /** Null for public views during the `wager` stage. The host always sees it. */
  prompt: string | null;
  /** Public once submitted. */
  wager: number | null;
  answeringPlayerId: PlayerId | null;
  attempts: AttemptView[];
  lockedOutPlayerIds: PlayerId[];
  /** Public only at `revealed`. The host always sees it. */
  answer: string | null;
}

export interface FinalResponseView {
  playerId: PlayerId;
  status: "hidden" | "revealed" | "judged";
  /** Public once revealed. The host sees submissions as they arrive. */
  answer: string | null;
  /** Public once judged. The host sees submissions as they arrive. */
  wager: number | null;
  correct: boolean | null;
  delta: number | null;
}

export interface FinalView {
  stage: FinalStage;
  categoryTitle: string;
  /** Null for public views during `wagers`. */
  prompt: string | null;
  eligiblePlayerIds: PlayerId[];
  wagerSubmittedIds: PlayerId[];
  answerSubmittedIds: PlayerId[];
  /** Public responses are in reveal order, empty until `judging`. The host sees submissions throughout. */
  responses: FinalResponseView[];
  nextResponderId: PlayerId | null;
  /** Public at `done`. The host always sees it. */
  answer: string | null;
}

export interface StandingView {
  playerId: PlayerId;
  name: string;
  score: number;
  /** 1-based; tied scores share a rank. */
  rank: number;
}

export interface ResultsView {
  standings: StandingView[];
  winnerIds: PlayerId[];
}

export interface ScoreLogEntry {
  revision: number;
  at: number;
  playerId: PlayerId;
  delta: number;
  kind: "clue" | "wager" | "final" | "adjustment";
  /** Adjustment reason, or a generated description such as the clue's category and value. */
  reason: string;
}

export interface ViewCommon {
  revision: number;
  /** Server clock when the view was produced (epoch ms). */
  serverNow: number;
  roomCode: string;
  phase: Phase;
  paused: PauseView | null;
  hostConnected: boolean;
  players: PublicPlayer[];
  waitingPlayers: WaitingPlayer[];
  controllerId: PlayerId | null;
  round: { index: number; total: number; title: string } | null;
  timer: TimerView | null;
  clue: ClueView | null;
  final: FinalView | null;
  results: ResultsView | null;
  pack: { id: string; title: string } | null;
  /** The most recent public-safe event, for one-shot effects. Ignore if its revision was already seen. */
  lastEvent: { revision: number; event: GameEvent } | null;
}

export interface DisplayView extends ViewCommon {
  audience: "display";
  board: BoardView | null;
}

export interface PlayerView extends ViewCommon {
  audience: "player";
  board: BoardView | null;
  me: { id: PlayerId; name: string; score: number; status: "playing" | "waiting" };
  /** What this player can do right now. Screens must not recompute rules. */
  can: {
    buzz: boolean;
    wager: { min: number; max: number } | null;
    finalWager: { min: number; max: number } | null;
    finalAnswer: boolean;
  };
  /** This player's own final submissions; never other players'. */
  myFinal: { wager: number | null; answer: string | null } | null;
}

export interface HostView extends ViewCommon {
  audience: "host";
  board: BoardView<HostBoardCellView> | null;
  settings: GameSettings;
  /** Host command types accepted in the current state (payload checks still apply). */
  allowedCommands: HostCommandType[];
  /** Why `startGame` is unavailable, as short human-readable reasons. Empty when it is allowed. */
  startBlockers: string[];
  /** Wager bounds for the controller during a wager clue. */
  wagerBounds: { min: number; max: number } | null;
  scoreLog: ScoreLogEntry[];
}

// ---------------------------------------------------------------------------
// Engine API

export interface CreateGameInput {
  roomCode: string;
  /** 32-bit seed for the game's deterministic random generator. */
  seed: number;
  now: number;
}

export interface EngineApi {
  /** A new game in the lobby with no pack and no players. */
  createGame(input: CreateGameInput): GameState;
  defaultSettings(pack: QuestionPack): GameSettings;
  /** Validate, then apply. Never throws for bad input; returns a rejection. */
  apply(state: GameState, actor: Actor, command: Command, now: number): EngineResult;
  /** The server schedules a `timerExpired` system command for this deadline. */
  nextDeadline(state: GameState): { timerId: TimerId; at: number } | null;
  hostView(state: GameState, now: number): HostView;
  /** Null when the player is neither playing nor waiting. */
  playerView(state: GameState, playerId: PlayerId, now: number): PlayerView | null;
  displayView(state: GameState, now: number): DisplayView;
  /** Validate a persisted state (for example after restart). Null if unusable. */
  restore(raw: unknown): GameState | null;
}
