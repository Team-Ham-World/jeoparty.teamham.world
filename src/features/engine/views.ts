import type { Command, FinalView, HostView, PlayerView, ViewCommon } from "./contract";
import type { GameState } from "./state";
import { currentBoard, eligibleBuzzers, ownValue, standings, wagerBounds } from "./rules";
import { execute, hostCommands } from "./commands";

function finalView(s: GameState, host: boolean): FinalView | null {
  const f = s.final;
  if (!f) return null;
  const responses =
    host && (f.stage === "wagers" || f.stage === "answering")
      ? f.eligiblePlayerIds.map((playerId) => ({
          playerId,
          status: "hidden" as const,
          answer: ownValue(f.answers, playerId) ?? null,
          wager: ownValue(f.wagers, playerId) ?? null,
          correct: null,
          delta: null,
        }))
      : f.responses.map((r) => ({
          ...r,
          answer: host || r.status !== "hidden" ? r.answer : null,
          wager: host || r.status === "judged" ? r.wager : null,
        }));
  return {
    stage: f.stage,
    categoryTitle: f.categoryTitle,
    prompt: host || f.stage !== "wagers" ? f.prompt : null,
    eligiblePlayerIds: f.eligiblePlayerIds,
    wagerSubmittedIds: Object.keys(f.wagers),
    answerSubmittedIds: Object.keys(f.answers),
    responses,
    nextResponderId: f.responses.find((r) => r.status !== "judged")?.playerId ?? null,
    answer: host || f.stage === "done" ? f.answer : null,
  };
}
function common(s: GameState, now: number, host: boolean): ViewCommon {
  const board = currentBoard(s);
  const clue = s.clue;
  return {
    revision: s.revision,
    serverNow: now,
    roomCode: s.roomCode,
    phase: s.phase,
    paused: s.paused,
    hostConnected: s.hostConnected,
    players: s.players,
    waitingPlayers: s.waitingPlayers.map((p) => ({ id: p.id, name: p.name })),
    controllerId: s.controllerId,
    round: board
      ? { index: s.roundIndex, total: s.settings.rounds, title: board.roundTitle }
      : null,
    timer: s.timer
      ? {
          ...s.timer,
          remainingMs:
            s.timer.endsAt === null ? s.timer.remainingMs : Math.max(0, s.timer.endsAt - now),
        }
      : null,
    clue: clue
      ? {
          clueId: clue.clueId,
          categoryTitle: clue.categoryTitle,
          value: clue.value,
          kind: clue.kind,
          stage: clue.stage,
          prompt: host || clue.stage !== "wager" ? clue.prompt : null,
          wager: clue.wager,
          answeringPlayerId: clue.answeringPlayerId,
          attempts: clue.attempts,
          lockedOutPlayerIds: clue.lockedOutPlayerIds,
          answer: host || clue.stage === "revealed" ? clue.answer : null,
        }
      : null,
    final: finalView(s, host),
    results: s.phase === "results" ? standings(s) : null,
    pack: s.pack ? { id: s.pack.id, title: s.pack.title } : null,
    lastEvent: s.lastEvent,
  };
}
function publicBoard(s: GameState) {
  const b = currentBoard(s);
  return b
    ? {
        roundIndex: b.roundIndex,
        roundTitle: b.roundTitle,
        categories: b.categories.map((c) => ({
          id: c.id,
          title: c.title,
          cells: c.cells.map((cell) => ({
            clueId: cell.clueId,
            value: cell.value,
            state: cell.state,
          })),
        })),
      }
    : null;
}
export function startBlockers(s: GameState): string[] {
  const blockers = [];
  if (s.paused) blockers.push("Resume the game first.");
  if (s.phase !== "lobby") blockers.push("Return to the lobby first.");
  if (!s.pack) blockers.push("Choose a pack.");
  if (s.players.length < 2) blockers.push("At least two players must join.");
  return blockers;
}
function allowedCommands(s: GameState, now: number) {
  const id = s.clue?.clueId ?? "";
  const next = s.final?.responses.find((r) => r.status !== "judged")?.playerId ?? "";
  const probes: Command[] = [
    { type: "updateSettings", patch: {} },
    { type: "removePlayer", playerId: s.players[0]?.id ?? "" },
    { type: "startGame" },
    { type: "continue" },
    {
      type: "selectClue",
      clueId:
        currentBoard(s)
          ?.categories.flatMap((c) => c.cells)
          .find((c) => c.state === "available")?.clueId ?? "",
    },
    { type: "openBuzzers", clueId: id },
    { type: "judge", clueId: id, attemptId: s.clue?.attempts.at(-1)?.id ?? "", correct: true },
    { type: "endAttempts", clueId: id },
    { type: "reveal", clueId: id },
    { type: "returnToBoard", clueId: id },
    { type: "submitWager", clueId: id, amount: wagerBounds(s)?.min ?? 5 },
    { type: "showFinalClue" },
    { type: "lockFinalAnswers" },
    { type: "revealFinalResponse", playerId: next },
    { type: "judgeFinal", playerId: next, correct: true },
    { type: "finishGame" },
    { type: "adjustScore", playerId: s.players[0]?.id ?? "", delta: 1, reason: "Correction" },
    { type: "pause" },
    { type: "resume" },
    { type: "endGame" },
    { type: "playAgain" },
  ];
  return hostCommands.filter((type) => {
    if (type === "setPack") return s.phase === "lobby" && !s.paused;
    const command = probes.find((c) => c.type === type);
    return (
      command !== undefined &&
      execute(structuredClone(s), { kind: "host" }, command, now, []) === null
    );
  });
}
export function hostView(s: GameState, now: number): HostView {
  return structuredClone({
    ...common(s, now, true),
    audience: "host",
    board: currentBoard(s),
    settings: s.settings,
    allowedCommands: allowedCommands(s, now),
    startBlockers: startBlockers(s),
    wagerBounds: wagerBounds(s),
    scoreLog: s.scoreLog,
  });
}
export function displayView(s: GameState, now: number) {
  return structuredClone({
    ...common(s, now, false),
    audience: "display" as const,
    board: publicBoard(s),
  });
}
export function playerView(s: GameState, playerId: string, now: number): PlayerView | null {
  const playing = s.players.find((p) => p.id === playerId);
  const member = playing ?? s.waitingPlayers.find((p) => p.id === playerId);
  if (!member) return null;
  const active = !!playing && !s.paused;
  const finalEligible = active && s.final?.eligiblePlayerIds.includes(playerId);
  return structuredClone({
    ...common(s, now, false),
    audience: "player",
    board: publicBoard(s),
    me: {
      id: member.id,
      name: member.name,
      score: member.score,
      status: playing ? "playing" : "waiting",
    },
    can: {
      buzz: active && s.clue?.stage === "open" && eligibleBuzzers(s).some((p) => p.id === playerId),
      wager: active && s.controllerId === playerId ? wagerBounds(s) : null,
      finalWager:
        finalEligible && s.final?.stage === "wagers"
          ? { min: 0, max: s.final.startingScores[playerId] }
          : null,
      finalAnswer: !!finalEligible && s.final?.stage === "answering",
    },
    myFinal:
      playing && s.final?.eligiblePlayerIds.includes(playerId)
        ? {
            wager: ownValue(s.final.wagers, playerId) ?? null,
            answer: ownValue(s.final.answers, playerId) ?? null,
          }
        : null,
  });
}
