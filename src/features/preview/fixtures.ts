/**
 * Typed example views for the /preview gallery and component tests.
 *
 * Invented demo content only. Each scenario is written once as a host-level
 * "spec" (the host sees everything) and then filtered into the player and
 * display views the way the engine filters them: answers and wager prompts
 * are removed, not hidden. Fixtures must type-check against contract.ts.
 */
import type {
  AttemptView,
  BoardView,
  ClueView,
  DisplayView,
  FinalView,
  GameEvent,
  GameSettings,
  HostBoardCellView,
  HostCommandType,
  HostView,
  PauseView,
  Phase,
  PlayerId,
  PlayerView,
  PublicPlayer,
  ResultsView,
  ScoreLogEntry,
  TimerView,
  WaitingPlayer,
} from "@/features/engine/contract";
import type { PackSummary, SessionInfo } from "@/features/network/protocol";

export const FIXTURE_NOW = Date.UTC(2026, 10, 7, 20, 30, 0);
export const ROOM = "BCDFG";
export const LONG_NAME = "Maximilian Featherstonehaugh III"; // 32 characters
export const LONG_PROMPT =
  "This sprawling clue exists to test wrapping on every screen: it describes a fictional hardware store that stays open past midnight, sells exactly one left-handed screwdriver per customer, keeps a parrot named Torque behind the counter, and hands out free coffee to anyone who can name the store's founder.";

// ---------------------------------------------------------------- players

export const PLAYERS: PublicPlayer[] = [
  { id: "p-ivvy", name: "Ivvy", score: 1200, connected: true },
  { id: "p-medchu", name: "Medchu", score: 800, connected: true },
  { id: "p-scarlet", name: "Scarlet", score: -200, connected: true },
  { id: "p-max", name: LONG_NAME, score: 2400, connected: false },
];

const WAITING: WaitingPlayer[] = [{ id: "p-john", name: "John" }];

// ---------------------------------------------------------------- board

const CATEGORY_TITLES = [
  "Internet Lore",
  "Kitchen Science",
  "Map Quest",
  "Pixel Games",
  "Words, Words, Words",
  "Things Found in a Hardware Store at Midnight",
];

type CellPlan = "a" | "c" | "x" | "w"; // available, completed, active, wager (available)

function makeBoard(roundIndex: number, roundTitle: string, plan: CellPlan[][], step = 200): BoardView<HostBoardCellView> {
  return {
    roundIndex,
    roundTitle,
    categories: plan.map((column, c) => ({
      id: `cat-${roundIndex}-${c}`,
      title: CATEGORY_TITLES[c] ?? `Category ${c + 1}`,
      cells: column.map((mark, r) => ({
        clueId: `clue-${roundIndex}-${c}-${r}`,
        value: (r + 1) * step,
        state: mark === "c" ? "completed" : mark === "x" ? "active" : "available",
        wager: mark === "w",
      })),
    })),
  };
}

const FRESH_PLAN: CellPlan[][] = [
  ["a", "a", "a", "a", "a"],
  ["a", "a", "w", "a", "a"],
  ["a", "a", "a", "a", "a"],
  ["a", "a", "a", "a", "a"],
  ["a", "a", "a", "a", "a"],
  ["a", "a", "a", "a", "a"],
];

const MID_PLAN: CellPlan[][] = [
  ["c", "c", "a", "a", "a"],
  ["c", "a", "w", "a", "a"],
  ["c", "c", "c", "a", "a"],
  ["a", "a", "a", "a", "c"],
  ["c", "a", "a", "a", "a"],
  ["a", "c", "a", "a", "a"],
];

const ACTIVE_PLAN: CellPlan[][] = MID_PLAN.map((column, c) => column.map((mark, r) => (c === 3 && r === 2 ? "x" : mark)));
const WAGER_ACTIVE_PLAN: CellPlan[][] = MID_PLAN.map((column, c) => column.map((mark, r) => (c === 1 && r === 2 ? "x" : mark)));

export const BOARD_FRESH = makeBoard(0, "Round 1", FRESH_PLAN);
export const BOARD_MID = makeBoard(0, "Round 1", MID_PLAN);
export const BOARD_ACTIVE = makeBoard(0, "Round 1", ACTIVE_PLAN);
export const BOARD_WAGER_ACTIVE = makeBoard(0, "Round 1", WAGER_ACTIVE_PLAN);

// ---------------------------------------------------------------- clues

const PROMPT =
  "This text-only web browser from 1992 still installs today and draws every page right inside your terminal.";
const ANSWER = "What is Lynx?";

function clue(stage: ClueView["stage"], extra: Partial<ClueView> = {}): ClueView {
  return {
    clueId: "clue-0-3-2",
    categoryTitle: "Pixel Games",
    value: 600,
    kind: "standard",
    stage,
    prompt: PROMPT,
    wager: null,
    answeringPlayerId: null,
    attempts: [],
    lockedOutPlayerIds: [],
    answer: ANSWER,
    ...extra,
  };
}

const ATTEMPT_PENDING: AttemptView = { id: "att-2", playerId: "p-medchu", result: "pending", timedOut: false, delta: null };
const ATTEMPT_WRONG: AttemptView = { id: "att-1", playerId: "p-scarlet", result: "incorrect", timedOut: false, delta: -600 };
const ATTEMPT_RIGHT: AttemptView = { id: "att-2", playerId: "p-medchu", result: "correct", timedOut: false, delta: 600 };

function timer(kind: TimerView["kind"], durationMs: number, remaining: number, paused = false): TimerView {
  return {
    id: `timer-${kind}`,
    kind,
    durationMs,
    endsAt: paused ? null : FIXTURE_NOW + remaining,
    remainingMs: remaining,
  };
}

// ---------------------------------------------------------------- final

const FINAL_BASE: FinalView = {
  stage: "wagers",
  categoryTitle: "Famous Last Words",
  prompt: "In 1997 this chess computer won a six-game match against the reigning world champion.",
  eligiblePlayerIds: ["p-ivvy", "p-medchu", "p-max"],
  wagerSubmittedIds: [],
  answerSubmittedIds: [],
  responses: [],
  nextResponderId: null,
  answer: "What is Deep Blue?",
};

// ---------------------------------------------------------------- settings

export const SETTINGS: GameSettings = {
  rounds: 2,
  categoriesPerRound: 6,
  wagerClues: [1, 2],
  finalRound: true,
  timers: { enabled: true, buzzWindowMs: 10_000, answerWindowMs: 10_000, finalAnswerMs: 45_000 },
};

const SCORE_LOG: ScoreLogEntry[] = [
  { revision: 41, at: FIXTURE_NOW - 60_000, playerId: "p-ivvy", delta: 400, kind: "clue", reason: "Internet Lore · 400" },
  { revision: 44, at: FIXTURE_NOW - 45_000, playerId: "p-scarlet", delta: -600, kind: "clue", reason: "Map Quest · 600" },
  { revision: 47, at: FIXTURE_NOW - 30_000, playerId: "p-max", delta: 1000, kind: "wager", reason: "Kitchen Science · wager" },
  { revision: 52, at: FIXTURE_NOW - 12_000, playerId: "p-medchu", delta: 200, kind: "adjustment", reason: "Accepted 'Lynx' without the article" },
];

// ---------------------------------------------------------------- specs

export interface Spec {
  phase: Phase;
  players?: PublicPlayer[];
  waitingPlayers?: WaitingPlayer[];
  controllerId?: PlayerId | null;
  round?: ViewRound;
  timer?: TimerView | null;
  clue?: ClueView | null;
  final?: FinalView | null;
  results?: ResultsView | null;
  paused?: PauseView | null;
  hostConnected?: boolean;
  board?: BoardView<HostBoardCellView> | null;
  lastEvent?: GameEvent | null;
  pack?: { id: string; title: string } | null;
}

type ViewRound = { index: number; total: number; title: string } | null;

const REVISION = 60;
const ROUND_1: ViewRound = { index: 0, total: 2, title: "Round 1" };

function common(spec: Spec) {
  return {
    revision: REVISION,
    serverNow: FIXTURE_NOW,
    roomCode: ROOM,
    phase: spec.phase,
    paused: spec.paused ?? null,
    hostConnected: spec.hostConnected ?? true,
    players: spec.players ?? PLAYERS,
    waitingPlayers: spec.waitingPlayers ?? [],
    controllerId: spec.controllerId ?? null,
    round: spec.round === undefined ? (spec.phase === "lobby" ? null : ROUND_1) : spec.round,
    timer: spec.timer ?? null,
    results: spec.results ?? null,
    pack: spec.pack === undefined ? { id: "pack-ham", title: "HAM Party Pack" } : spec.pack,
    lastEvent: spec.lastEvent ? { revision: REVISION, event: spec.lastEvent } : null,
  };
}

function publicBoard(board: BoardView<HostBoardCellView> | null | undefined): BoardView | null {
  if (!board) return null;
  return {
    ...board,
    categories: board.categories.map((category) => ({
      ...category,
      cells: category.cells.map((cell) => ({ clueId: cell.clueId, value: cell.value, state: cell.state })),
    })),
  };
}

function publicClue(c: ClueView | null | undefined): ClueView | null {
  if (!c) return null;
  return {
    ...c,
    prompt: c.stage === "wager" ? null : c.prompt,
    answer: c.stage === "revealed" ? c.answer : null,
  };
}

function publicFinal(f: FinalView | null | undefined): FinalView | null {
  if (!f) return null;
  return {
    ...f,
    prompt: f.stage === "wagers" ? null : f.prompt,
    answer: f.stage === "done" ? f.answer : null,
    responses: f.responses.map((r) => ({
      ...r,
      answer: r.status === "hidden" ? null : r.answer,
      wager: r.status === "judged" ? r.wager : null,
      correct: r.status === "judged" ? r.correct : null,
      delta: r.status === "judged" ? r.delta : null,
    })),
  };
}

export function displayOf(spec: Spec): DisplayView {
  return {
    ...common(spec),
    audience: "display",
    board: publicBoard(spec.board),
    clue: publicClue(spec.clue),
    final: publicFinal(spec.final),
  };
}

export function hostOf(spec: Spec, extra: Partial<Pick<HostView, "allowedCommands" | "startBlockers" | "wagerBounds" | "settings" | "scoreLog">> = {}): HostView {
  return {
    ...common(spec),
    audience: "host",
    board: spec.board ?? null,
    clue: spec.clue ?? null,
    final: spec.final ?? null,
    settings: extra.settings ?? SETTINGS,
    allowedCommands: extra.allowedCommands ?? [],
    startBlockers: extra.startBlockers ?? [],
    wagerBounds: extra.wagerBounds ?? null,
    scoreLog: extra.scoreLog ?? SCORE_LOG,
  };
}

const NO_CAN: PlayerView["can"] = { buzz: false, wager: null, finalWager: null, finalAnswer: false };

export function playerOf(
  spec: Spec,
  meId: PlayerId,
  extra: { can?: Partial<PlayerView["can"]>; myFinal?: PlayerView["myFinal"]; waiting?: boolean } = {},
): PlayerView {
  const players = spec.players ?? PLAYERS;
  const waiting = (spec.waitingPlayers ?? []).find((w) => w.id === meId);
  const me = players.find((p) => p.id === meId);
  return {
    ...common(spec),
    audience: "player",
    board: publicBoard(spec.board),
    clue: publicClue(spec.clue),
    final: publicFinal(spec.final),
    me: me
      ? { id: me.id, name: me.name, score: me.score, status: "playing" }
      : { id: meId, name: waiting?.name ?? "You", score: 0, status: "waiting" },
    can: { ...NO_CAN, ...extra.can },
    myFinal: extra.myFinal ?? null,
  };
}

// ---------------------------------------------------------------- scenarios

const LOBBY_PLAYERS: PublicPlayer[] = PLAYERS.map((p) => ({ ...p, score: 0 }));

export const SPECS = {
  lobby: { phase: "lobby", players: LOBBY_PLAYERS },
  lobbyAlone: { phase: "lobby", players: LOBBY_PLAYERS.slice(0, 1), pack: null },
  roundIntro: { phase: "roundIntro", board: BOARD_FRESH, controllerId: "p-medchu", players: LOBBY_PLAYERS },
  board: { phase: "board", board: BOARD_MID, controllerId: "p-ivvy", waitingPlayers: WAITING },
  reading: { phase: "clue", board: BOARD_ACTIVE, controllerId: "p-ivvy", clue: clue("reading") },
  open: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("open"),
    timer: timer("buzz", 10_000, 7_400),
    lastEvent: { kind: "buzzersOpened", clueId: "clue-0-3-2" },
  },
  answering: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("answering", { answeringPlayerId: "p-medchu", attempts: [ATTEMPT_WRONG, ATTEMPT_PENDING], lockedOutPlayerIds: ["p-scarlet"] }),
    timer: timer("answer", 10_000, 6_200),
    lastEvent: { kind: "buzzAccepted", clueId: "clue-0-3-2", playerId: "p-medchu" },
  },
  closed: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("closed", { attempts: [ATTEMPT_WRONG], lockedOutPlayerIds: ["p-scarlet"] }),
    lastEvent: { kind: "judged", clueId: "clue-0-3-2", playerId: "p-scarlet", correct: false, delta: -600 },
  },
  judgedCorrect: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-medchu",
    clue: clue("closed", { attempts: [ATTEMPT_WRONG, ATTEMPT_RIGHT], lockedOutPlayerIds: ["p-scarlet"] }),
    players: PLAYERS.map((p) => (p.id === "p-medchu" ? { ...p, score: 1400 } : p)),
    lastEvent: { kind: "judged", clueId: "clue-0-3-2", playerId: "p-medchu", correct: true, delta: 600 },
  },
  revealed: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-medchu",
    clue: clue("revealed", { attempts: [ATTEMPT_WRONG, ATTEMPT_RIGHT], lockedOutPlayerIds: ["p-scarlet"] }),
    players: PLAYERS.map((p) => (p.id === "p-medchu" ? { ...p, score: 1400 } : p)),
    lastEvent: { kind: "revealed", clueId: "clue-0-3-2" },
  },
  wager: {
    phase: "clue",
    board: BOARD_WAGER_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("wager", {
      clueId: "clue-0-1-2",
      categoryTitle: "Kitchen Science",
      kind: "wager",
      prompt: "Bakers add this acidic powder, often paired with baking soda, so batter rises in two stages.",
      answer: "What is cream of tartar?",
    }),
    lastEvent: { kind: "clueSelected", clueId: "clue-0-1-2", wager: true },
  },
  wagerAnswering: {
    phase: "clue",
    board: BOARD_WAGER_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("answering", {
      clueId: "clue-0-1-2",
      categoryTitle: "Kitchen Science",
      kind: "wager",
      wager: 1000,
      prompt: "Bakers add this acidic powder, often paired with baking soda, so batter rises in two stages.",
      answer: "What is cream of tartar?",
      answeringPlayerId: "p-ivvy",
      attempts: [{ id: "att-w", playerId: "p-ivvy", result: "pending", timedOut: false, delta: null }],
    }),
    timer: timer("answer", 10_000, 8_100),
    lastEvent: { kind: "wagerSubmitted", clueId: "clue-0-1-2", playerId: "p-ivvy", amount: 1000 },
  },
  longClue: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-max",
    clue: clue("answering", {
      categoryTitle: "Things Found in a Hardware Store at Midnight",
      value: 1000,
      prompt: LONG_PROMPT,
      answer: "Who is Ada Wrench, the founder who never sleeps?",
      answeringPlayerId: "p-max",
      attempts: [{ id: "att-l", playerId: "p-max", result: "pending", timedOut: true, delta: null }],
    }),
    timer: timer("answer", 10_000, 0),
  },
  finalWagers: {
    phase: "final",
    round: null,
    final: { ...FINAL_BASE, wagerSubmittedIds: ["p-max"] },
    lastEvent: { kind: "finalStarted" },
  },
  finalAnswering: {
    phase: "final",
    round: null,
    final: { ...FINAL_BASE, stage: "answering", wagerSubmittedIds: ["p-ivvy", "p-medchu", "p-max"], answerSubmittedIds: ["p-ivvy"] },
    timer: timer("finalAnswer", 45_000, 31_000),
    lastEvent: { kind: "finalClueShown" },
  },
  finalJudging: {
    phase: "final",
    round: null,
    final: {
      ...FINAL_BASE,
      stage: "judging",
      wagerSubmittedIds: ["p-ivvy", "p-medchu", "p-max"],
      answerSubmittedIds: ["p-ivvy", "p-medchu", "p-max"],
      responses: [
        { playerId: "p-medchu", status: "judged", answer: "Deep Blue", wager: 800, correct: true, delta: 800 },
        { playerId: "p-ivvy", status: "revealed", answer: "What is HAL 9000?", wager: 1200, correct: null, delta: null },
        { playerId: "p-max", status: "hidden", answer: "deep blue!!", wager: 1600, correct: null, delta: null },
      ],
      nextResponderId: "p-ivvy",
    },
    players: PLAYERS.map((p) => (p.id === "p-medchu" ? { ...p, score: 1600 } : p)),
    lastEvent: { kind: "finalResponseRevealed", playerId: "p-ivvy" },
  },
  finalDone: {
    phase: "final",
    round: null,
    final: {
      ...FINAL_BASE,
      stage: "done",
      wagerSubmittedIds: ["p-ivvy", "p-medchu", "p-max"],
      answerSubmittedIds: ["p-ivvy", "p-medchu", "p-max"],
      responses: [
        { playerId: "p-medchu", status: "judged", answer: "Deep Blue", wager: 800, correct: true, delta: 800 },
        { playerId: "p-ivvy", status: "judged", answer: "What is HAL 9000?", wager: 1200, correct: false, delta: -1200 },
        { playerId: "p-max", status: "judged", answer: "deep blue!!", wager: 0, correct: true, delta: 0 },
      ],
    },
    players: [
      { id: "p-ivvy", name: "Ivvy", score: 0, connected: true },
      { id: "p-medchu", name: "Medchu", score: 1600, connected: true },
      { id: "p-scarlet", name: "Scarlet", score: -200, connected: true },
      { id: "p-max", name: LONG_NAME, score: 2400, connected: false },
    ],
  },
  results: {
    phase: "results",
    round: null,
    players: [
      { id: "p-ivvy", name: "Ivvy", score: 1600, connected: true },
      { id: "p-medchu", name: "Medchu", score: 2400, connected: true },
      { id: "p-scarlet", name: "Scarlet", score: -200, connected: true },
      { id: "p-max", name: LONG_NAME, score: 2400, connected: true },
    ],
    results: {
      standings: [
        { playerId: "p-medchu", name: "Medchu", score: 2400, rank: 1 },
        { playerId: "p-max", name: LONG_NAME, score: 2400, rank: 1 },
        { playerId: "p-ivvy", name: "Ivvy", score: 1600, rank: 3 },
        { playerId: "p-scarlet", name: "Scarlet", score: -200, rank: 4 },
      ],
      winnerIds: ["p-medchu", "p-max"],
    },
    lastEvent: { kind: "gameOver", winnerIds: ["p-medchu", "p-max"] },
  },
  paused: {
    phase: "clue",
    board: BOARD_ACTIVE,
    controllerId: "p-ivvy",
    clue: clue("open"),
    timer: timer("buzz", 10_000, 5_200, true),
    paused: { reason: "host", since: FIXTURE_NOW - 20_000 },
  },
  hostOffline: {
    phase: "board",
    board: BOARD_MID,
    controllerId: "p-ivvy",
    hostConnected: false,
    paused: { reason: "hostOffline", since: FIXTURE_NOW - 8_000 },
  },
  restored: {
    phase: "board",
    board: BOARD_MID,
    controllerId: "p-ivvy",
    paused: { reason: "restored", since: FIXTURE_NOW - 3_000 },
  },
} satisfies Record<string, Spec>;

export type SpecId = keyof typeof SPECS;

// Host command sets per scenario (what the engine would allow).
const DURING_GAME: HostCommandType[] = ["adjustScore", "pause", "endGame"];
export const HOST_ALLOWED: Record<SpecId, HostCommandType[]> = {
  lobby: ["setPack", "updateSettings", "removePlayer", "startGame"],
  lobbyAlone: ["setPack", "updateSettings", "removePlayer"],
  roundIntro: ["continue", ...DURING_GAME],
  board: ["selectClue", ...DURING_GAME],
  reading: ["openBuzzers", "endAttempts", "reveal", ...DURING_GAME],
  open: ["endAttempts", "reveal", ...DURING_GAME],
  answering: ["judge", ...DURING_GAME],
  closed: ["openBuzzers", "reveal", ...DURING_GAME],
  judgedCorrect: ["reveal", ...DURING_GAME],
  revealed: ["returnToBoard", ...DURING_GAME],
  wager: ["submitWager", "endAttempts", ...DURING_GAME],
  wagerAnswering: ["judge", ...DURING_GAME],
  longClue: ["judge", ...DURING_GAME],
  finalWagers: ["showFinalClue", ...DURING_GAME],
  finalAnswering: ["lockFinalAnswers", ...DURING_GAME],
  finalJudging: ["judgeFinal", ...DURING_GAME],
  finalDone: ["finishGame", ...DURING_GAME],
  results: ["adjustScore", "playAgain"],
  paused: ["resume", "adjustScore", "endGame"],
  hostOffline: ["resume", "adjustScore", "endGame"],
  restored: ["resume", "adjustScore", "endGame"],
};

export function hostFixture(id: SpecId): HostView {
  const spec: Spec = SPECS[id];
  return hostOf(spec, {
    allowedCommands: HOST_ALLOWED[id],
    startBlockers: id === "lobbyAlone" ? ["Choose a question pack.", "At least 2 players need to join."] : [],
    wagerBounds: id === "wager" ? { min: 5, max: 1200 } : null,
    scoreLog: spec.phase === "lobby" ? [] : SCORE_LOG,
  });
}

export function displayFixture(id: SpecId): DisplayView {
  return displayOf(SPECS[id]);
}

// ---------------------------------------------------------------- API data

export const SESSION_SIGNED_OUT: SessionInfo = { signedIn: false, authMode: "fixture" };
export const SESSION_SIGNED_IN: SessionInfo = {
  signedIn: true,
  authMode: "fixture",
  user: { id: "acct-medchu", name: "Medchu" },
  csrfToken: "preview-csrf",
};

export const PACKS: PackSummary[] = [
  {
    id: "pack-ham",
    title: "HAM Party Pack",
    description: "Twelve categories of internet lore, kitchen science and questionable trivia.",
    categories: 12,
    cluesPerCategory: 5,
    source: "builtIn",
    updatedAt: null,
  },
  {
    id: "pack-small",
    title: "Team Ham Small Trivia Pack",
    description: "Three categories with three clues each. Good for a quick test game.",
    categories: 3,
    cluesPerCategory: 3,
    source: "builtIn",
    updatedAt: null,
  },
  {
    id: "pack-mine-1",
    title: "Scarlet's Birthday Bash",
    description: null,
    categories: 6,
    cluesPerCategory: 5,
    source: "mine",
    updatedAt: "2026-11-02T18:20:00.000Z",
  },
];
