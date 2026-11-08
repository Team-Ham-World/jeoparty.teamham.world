import { validateQuestionPack } from "@/features/content";
import type { Actor, Command, GameEvent, RejectionCode } from "./contract";
import type { GameState } from "./state";
import {
  advanceRound,
  acceptBuzz,
  decideBuzz,
  buildBoards,
  currentBoard,
  defaultSettings,
  eligibleBuzzers,
  event,
  lockFinal,
  ownValue,
  pause,
  randomIndex,
  results,
  score,
  startTimer,
  validSettings,
  wagerBounds,
} from "./rules";

export const hostCommands = [
  "setPack",
  "updateSettings",
  "removePlayer",
  "startGame",
  "continue",
  "selectClue",
  "openBuzzers",
  "judge",
  "endAttempts",
  "reveal",
  "returnToBoard",
  "submitWager",
  "showFinalClue",
  "lockFinalAnswers",
  "revealFinalResponse",
  "judgeFinal",
  "finishGame",
  "adjustScore",
  "pause",
  "resume",
  "endGame",
  "playAgain",
] as const;
const playerCommands = ["buzz", "submitWager", "submitFinalWager", "submitFinalAnswer"];
const systemCommands = [
  "addPlayer",
  "renamePlayer",
  "removeMember",
  "setPresence",
  "timerExpired",
  "restored",
];
const messages: Record<RejectionCode, string> = {
  forbidden: "This action is not permitted.",
  wrongPhase: "This action is unavailable at this stage.",
  paused: "The game is paused.",
  notPaused: "The game is not paused.",
  noPack: "Choose a pack first.",
  invalidSettings: "Settings are outside the allowed bounds.",
  notEnoughPlayers: "At least two players are required.",
  gameFull: "All six seats are taken.",
  unknownPlayer: "Player not found.",
  alreadyJoined: "This player has already joined.",
  invalidName: "Use a name of 1–32 characters.",
  unknownClue: "Clue not found.",
  clueCompleted: "This clue is already completed.",
  staleClue: "This is not the current clue.",
  staleAttempt: "This is not the current attempt.",
  buzzersClosed: "Buzzers are closed.",
  alreadyAttempted: "You already attempted this clue.",
  mustJudgeFirst: "Judge the current attempt first.",
  noEligiblePlayers: "No players can buzz.",
  notController: "Only the controller can wager.",
  invalidWager: "Wager outside the allowed bounds.",
  notEligible: "You are not eligible for the final round.",
  submissionsLocked: "Submissions are locked.",
  outOfOrder: "Reveal and judge the next response in order.",
  invalidAdjustment: "Use a non-zero integer up to 100000 and a reason of 1–120 characters.",
  staleTimer: "This timer is no longer active.",
};
export function rejection(code: RejectionCode) {
  return { code, message: messages[code] };
}
const nameValid = (name: string) =>
  typeof name === "string" && name.trim().length > 0 && name.trim().length <= 32;
const inPlay = (s: GameState) => s.phase !== "lobby" && s.phase !== "results";

/** Mutates only the private draft. The facade discards it on rejection. */
export function execute(
  s: GameState,
  actor: Actor,
  c: Command,
  now: number,
  events: GameEvent[],
): RejectionCode | null {
  if (!actor || !c || typeof c.type !== "string") return "forbidden";
  const permitted: readonly string[] =
    actor.kind === "host"
      ? hostCommands
      : actor.kind === "player"
        ? playerCommands
        : actor.kind === "system"
          ? systemCommands
          : [];
  if (!permitted.includes(c.type)) return "forbidden";
  if (actor.kind === "player" && !s.players.some((p) => p.id === actor.playerId))
    return "unknownPlayer";
  if (
    s.paused &&
    !(actor.kind === "system" && c.type !== "timerExpired") &&
    !["resume", "adjustScore", "endGame"].includes(c.type)
  )
    return "paused";
  const player = "playerId" in c ? s.players.find((p) => p.id === c.playerId) : undefined;
  const member =
    "playerId" in c ? (player ?? s.waitingPlayers.find((p) => p.id === c.playerId)) : undefined;
  // Stage commands target a specific clue, even when its phase has moved on.
  if ("clueId" in c && c.type !== "selectClue") {
    if (c.type === "buzz" && (s.phase !== "clue" || s.clue?.stage !== "open"))
      return "buzzersClosed";
    if (!s.clue || c.clueId !== s.clue.clueId) return "staleClue";
  }
  switch (c.type) {
    case "setPack": {
      if (s.phase !== "lobby") return "wrongPhase";
      const parsed = validateQuestionPack(c.pack);
      if (!parsed.ok) return "invalidSettings";
      s.pack = structuredClone(parsed.data);
      s.settings = defaultSettings(s.pack);
      return null;
    }
    case "updateSettings": {
      if (s.phase !== "lobby") return "wrongPhase";
      if (!s.pack) return "noPack";
      if (!c.patch || typeof c.patch !== "object") return "invalidSettings";
      const settings = {
        ...s.settings,
        ...c.patch,
        timers: { ...s.settings.timers, ...c.patch.timers },
      };
      if (!validSettings(settings, s.pack)) return "invalidSettings";
      s.settings = settings;
      return null;
    }
    case "addPlayer": {
      if (!nameValid(c.name) || typeof c.playerId !== "string" || !c.playerId.trim())
        return "invalidName";
      if (member) return "alreadyJoined";
      if (s.phase === "lobby" && s.players.length >= 6) return "gameFull";
      const p = { id: c.playerId, name: c.name.trim(), score: 0, connected: true };
      (s.phase === "lobby" ? s.players : s.waitingPlayers).push(p);
      event(s, events, { kind: "playerJoined", playerId: p.id });
      return null;
    }
    case "renamePlayer":
      if (!member) return "unknownPlayer";
      if (!nameValid(c.name)) return "invalidName";
      member.name = c.name.trim();
      return null;
    case "removePlayer":
      if (s.phase !== "lobby") return "wrongPhase";
      if (!player) return "unknownPlayer";
      s.players = s.players.filter((p) => p.id !== c.playerId);
      return null;
    case "removeMember":
      if (!member) return "unknownPlayer";
      if (s.phase === "lobby") s.players = s.players.filter((p) => p.id !== c.playerId);
      else if (player) {
        player.connected = false;
        if (!s.departedPlayerIds.includes(player.id)) s.departedPlayerIds.push(player.id);
      } // Preserve attempts, final eligibility and scores for this game.
      s.waitingPlayers = s.waitingPlayers.filter((p) => p.id !== c.playerId);
      return null;
    case "setPresence":
      if (typeof c.connected !== "boolean" || !c.target) return "forbidden";
      if (c.target.role === "host") {
        s.hostConnected = c.connected;
        if (!c.connected && inPlay(s) && !s.paused) pause(s, "hostOffline", now, events);
      } else {
        const id = c.target.playerId;
        const p = [...s.players, ...s.waitingPlayers].find((p) => p.id === id);
        if (!p) return "unknownPlayer";
        p.connected = c.connected;
        if (c.connected) s.departedPlayerIds = s.departedPlayerIds.filter((id) => id !== p.id);
      }
      return null;
    case "startGame":
      if (s.phase !== "lobby") return "wrongPhase";
      if (!s.pack) return "noPack";
      if (s.players.length < 2) return "notEnoughPlayers";
      if (!validSettings(s.settings, s.pack)) return "invalidSettings";
      s.boards = buildBoards(s, s.pack);
      s.roundIndex = 0;
      s.controllerId = s.players[randomIndex(s, s.players.length)].id;
      s.phase = "roundIntro";
      event(s, events, { kind: "gameStarted" });
      event(s, events, { kind: "roundStarted", roundIndex: 0 });
      return null;
    case "continue":
      if (s.phase !== "roundIntro") return "wrongPhase";
      s.phase = "board";
      return null;
    case "selectClue": {
      if (s.phase !== "board") return "wrongPhase";
      const category = currentBoard(s)!.categories.find((cat) =>
        cat.cells.some((cell) => cell.clueId === c.clueId),
      );
      const cell = category?.cells.find((cell) => cell.clueId === c.clueId);
      if (!category || !cell) return "unknownClue";
      if (cell.state !== "available") return "clueCompleted";
      const clue = s
        .pack!.categories.flatMap((cat) => cat.clues)
        .find((clue) => clue.id === c.clueId)!;
      cell.state = "active";
      s.clue = {
        clueId: c.clueId,
        categoryTitle: category.title,
        value: cell.value,
        kind: cell.wager ? "wager" : "standard",
        stage: cell.wager ? "wager" : "reading",
        prompt: clue.prompt,
        answer: clue.answer,
        wager: null,
        answeringPlayerId: cell.wager ? s.controllerId : null,
        attempts: [],
        lockedOutPlayerIds: [],
        ended: false,
        opensAt: null,
        buzzResult: null,
        collection: null,
      };
      s.phase = "clue";
      event(s, events, { kind: "clueSelected", clueId: c.clueId, wager: cell.wager });
      return null;
    }
    case "openBuzzers": {
      const clue = s.clue!;
      if (clue.kind !== "standard" || !["reading", "closed"].includes(clue.stage) || clue.ended)
        return "wrongPhase";
      if (!eligibleBuzzers(s).length) return "noEligiblePlayers";
      if (!Number.isFinite(c.leadMs) || c.leadMs < 0 || c.leadMs > 400) return "forbidden";
      clue.stage = "open";
      clue.opensAt = now + (s.settings.fairBuzzing ? c.leadMs : 0);
      clue.buzzResult = null;
      startTimer(s, "buzz", clue.opensAt);
      event(s, events, { kind: "buzzersOpened", clueId: clue.clueId });
      return null;
    }
    case "buzz": {
      if (actor.kind !== "player") return "forbidden";
      const clue = s.clue!;
      if (clue.attempts.some((a) => a.playerId === actor.playerId)) return "alreadyAttempted";
      if (!s.settings.fairBuzzing) {
        acceptBuzz(s, actor.playerId, now, events);
        return null;
      }
      if (
        ![c.reactionMs, c.arrivalMs, c.uplinkBoundMs, c.maxOtherUplinkMs].every(Number.isFinite) ||
        c.reactionMs < 0 ||
        typeof c.falseStart !== "boolean" ||
        c.arrivalMs > now ||
        c.uplinkBoundMs < 0 ||
        c.maxOtherUplinkMs < 0
      )
        return "forbidden";
      const opensAt = clue.opensAt!;
      if (
        c.arrivalMs < opensAt - 40 ||
        (clue.collection && c.arrivalMs > clue.collection.decidesAt) ||
        (s.timer?.endsAt != null && c.arrivalMs > s.timer.endsAt)
      )
        return "buzzersClosed";
      if (clue.collection?.candidates.some((p) => p.playerId === actor.playerId))
        return "alreadyAttempted";
      const floor = opensAt + (s.settings.falseStartLockout && c.falseStart ? 250 : -40);
      if (c.arrivalMs < floor) return "buzzersClosed";
      const effectiveMs = Math.max(
        floor,
        Math.min(
          c.arrivalMs,
          Math.max(opensAt + c.reactionMs, c.arrivalMs - Math.min(250, c.uplinkBoundMs) - 40),
        ),
      );
      if (!clue.collection) {
        clue.collection = {
          id: `collection-${s.revision}`,
          decidesAt: Math.max(
            c.arrivalMs,
            Math.min(c.arrivalMs + 250, effectiveMs + Math.min(250, c.maxOtherUplinkMs) + 40),
          ),
          candidates: [],
        };
        s.timer = null;
      }
      clue.collection.candidates.push({
        playerId: actor.playerId,
        effectiveMs,
        arrivalMs: c.arrivalMs,
      });
      return null;
    }
    case "submitWager": {
      const clue = s.clue!;
      if (clue.stage !== "wager") return "wrongPhase";
      if (actor.kind === "player" && actor.playerId !== s.controllerId) return "notController";
      const bounds = wagerBounds(s)!;
      if (!Number.isSafeInteger(c.amount) || c.amount < bounds.min || c.amount > bounds.max)
        return "invalidWager";
      clue.wager = c.amount;
      clue.stage = "answering";
      clue.attempts.push({
        id: `attempt-${s.revision}`,
        playerId: s.controllerId!,
        result: "pending",
        timedOut: false,
        delta: null,
      });
      startTimer(s, "answer", now);
      event(s, events, {
        kind: "wagerSubmitted",
        clueId: clue.clueId,
        playerId: s.controllerId!,
        amount: c.amount,
      });
      return null;
    }
    case "judge": {
      const clue = s.clue!;
      if (clue.stage !== "answering") return "wrongPhase";
      const attempt = clue.attempts.at(-1)!;
      if (attempt.id !== c.attemptId) return "staleAttempt";
      if (typeof c.correct !== "boolean") return "forbidden";
      const delta = (c.correct ? 1 : -1) * (clue.wager ?? clue.value);
      attempt.result = c.correct ? "correct" : "incorrect";
      attempt.delta = delta;
      score(
        s,
        attempt.playerId,
        delta,
        clue.kind === "wager" ? "wager" : "clue",
        `${clue.categoryTitle}: ${clue.value}`,
        now,
      );
      if (c.correct) s.controllerId = attempt.playerId;
      clue.lockedOutPlayerIds.push(attempt.playerId);
      clue.answeringPlayerId = null;
      clue.stage = "closed";
      clue.ended = c.correct || clue.kind === "wager";
      s.timer = null;
      event(s, events, {
        kind: "judged",
        clueId: clue.clueId,
        playerId: attempt.playerId,
        correct: c.correct,
        delta,
      });
      return null;
    }
    case "endAttempts":
    case "reveal": {
      const clue = s.clue!;
      if (clue.stage === "answering" || clue.collection) return "mustJudgeFirst";
      const stages =
        c.type === "endAttempts"
          ? ["wager", "reading", "open", "closed"]
          : ["reading", "open", "closed"];
      if (!stages.includes(clue.stage)) return "wrongPhase";
      clue.stage = c.type === "endAttempts" ? "closed" : "revealed";
      clue.ended = true;
      clue.answeringPlayerId = null;
      s.timer = null;
      event(s, events, {
        kind: c.type === "endAttempts" ? "attemptsEnded" : "revealed",
        clueId: clue.clueId,
      });
      return null;
    }
    case "returnToBoard": {
      if (s.clue!.stage !== "revealed") return "wrongPhase";
      currentBoard(s)!
        .categories.flatMap((cat) => cat.cells)
        .find((cell) => cell.clueId === c.clueId)!.state = "completed";
      s.clue = null;
      s.phase = "board";
      if (
        !currentBoard(s)!.categories.some((cat) =>
          cat.cells.some((cell) => cell.state === "available"),
        )
      )
        advanceRound(s, now, events);
      return null;
    }
    case "submitFinalWager":
    case "submitFinalAnswer": {
      if (s.phase !== "final") return "wrongPhase";
      const f = s.final!;
      if (actor.kind !== "player") return "forbidden";
      if (!f.eligiblePlayerIds.includes(actor.playerId)) return "notEligible";
      if (f.stage !== (c.type === "submitFinalWager" ? "wagers" : "answering"))
        return "submissionsLocked";
      if (c.type === "submitFinalWager") {
        if (
          !Number.isSafeInteger(c.amount) ||
          c.amount < 0 ||
          c.amount > f.startingScores[actor.playerId]
        )
          return "invalidWager";
        f.wagers = { ...f.wagers, [actor.playerId]: c.amount };
      } else {
        if (typeof c.text !== "string" || c.text.length > 200) return "forbidden";
        f.answers = { ...f.answers, [actor.playerId]: c.text };
      }
      return null;
    }
    case "showFinalClue":
      if (s.phase !== "final" || s.final!.stage !== "wagers") return "wrongPhase";
      s.final!.wagers = Object.fromEntries(
        s.final!.eligiblePlayerIds.map((id) => [id, ownValue(s.final!.wagers, id) ?? 0]),
      );
      s.final!.stage = "answering";
      startTimer(s, "finalAnswer", now);
      event(s, events, { kind: "finalClueShown" });
      return null;
    case "lockFinalAnswers":
      if (s.phase !== "final" || s.final!.stage !== "answering") return "wrongPhase";
      lockFinal(s);
      return null;
    case "revealFinalResponse":
    case "judgeFinal": {
      if (s.phase !== "final" || s.final!.stage !== "judging") return "wrongPhase";
      const response = s.final!.responses.find((r) => r.status !== "judged");
      if (
        !response ||
        response.playerId !== c.playerId ||
        response.status !== (c.type === "judgeFinal" ? "revealed" : "hidden")
      )
        return "outOfOrder";
      if (c.type === "revealFinalResponse") {
        response.status = "revealed";
        event(s, events, { kind: "finalResponseRevealed", playerId: c.playerId });
      } else {
        if (typeof c.correct !== "boolean") return "forbidden";
        const delta = (c.correct ? 1 : -1) * response.wager!;
        response.status = "judged";
        response.correct = c.correct;
        response.delta = delta;
        score(s, c.playerId, delta, "final", s.final!.categoryTitle, now);
        event(s, events, { kind: "finalJudged", playerId: c.playerId, correct: c.correct, delta });
        if (s.final!.responses.every((r) => r.status === "judged")) s.final!.stage = "done";
      }
      return null;
    }
    case "finishGame":
      if (s.phase !== "final" || s.final!.stage !== "done") return "wrongPhase";
      results(s, events);
      return null;
    case "adjustScore":
      if (s.phase === "lobby") return "wrongPhase";
      if (!player) return "unknownPlayer";
      if (
        !Number.isSafeInteger(c.delta) ||
        !c.delta ||
        Math.abs(c.delta) > 100_000 ||
        typeof c.reason !== "string" ||
        !c.reason.trim() ||
        c.reason.trim().length > 120
      )
        return "invalidAdjustment";
      score(s, c.playerId, c.delta, "adjustment", c.reason.trim(), now);
      event(s, events, { kind: "scoreAdjusted", playerId: c.playerId, delta: c.delta });
      return null;
    case "pause":
      if (s.phase === "lobby") return "wrongPhase";
      pause(s, "host", now, events);
      return null;
    case "resume": {
      if (!s.paused) return "notPaused";
      const lead =
        s.clue?.stage === "open" && s.clue.opensAt !== null
          ? Math.max(0, s.clue.opensAt - s.paused.since)
          : 0;
      s.paused = null;
      if (s.clue?.collection) decideBuzz(s, now, events);
      else if (s.clue?.stage === "open") s.clue.opensAt = now + lead;
      if (s.timer) {
        s.timer.id = `timer-${s.revision}`;
        s.timer.endsAt = now + (s.timer.kind === "buzz" ? lead : 0) + s.timer.remainingMs;
      }
      event(s, events, { kind: "resumed" });
      return null;
    }
    case "endGame":
      if (s.phase === "lobby") return "wrongPhase";
      results(s, events);
      return null;
    case "playAgain":
      if (s.phase !== "results") return "wrongPhase";
      s.players = s.players.filter((p) => !s.departedPlayerIds.includes(p.id));
      s.departedPlayerIds = [];
      s.players.push(...s.waitingPlayers.splice(0, 6 - s.players.length));
      s.players.forEach((p) => {
        p.score = 0;
      });
      s.phase = "lobby";
      s.boards = [];
      s.roundIndex = 0;
      s.clue = null;
      s.final = null;
      s.timer = null;
      s.controllerId = null;
      s.scoreLog = [];
      s.lastEvent = null;
      return null;
    case "timerExpired": {
      if (s.clue?.collection) {
        if (c.timerId !== s.clue.collection.id || now < s.clue.collection.decidesAt)
          return "staleTimer";
        decideBuzz(s, now, events);
        return null;
      }
      if (!s.timer || c.timerId !== s.timer.id || s.timer.endsAt === null || now < s.timer.endsAt)
        return "staleTimer";
      const kind = s.timer.kind;
      s.timer = null;
      if (kind === "buzz") s.clue!.stage = "closed";
      else if (kind === "answer") s.clue!.attempts.at(-1)!.timedOut = true;
      else lockFinal(s);
      event(s, events, { kind: "timerExpired", timer: kind });
      return null;
    }
    case "restored":
      s.hostConnected = false;
      [...s.players, ...s.waitingPlayers].forEach((p) => {
        p.connected = false;
      });
      if (inPlay(s)) {
        if (s.timer && s.timer.endsAt !== null) {
          s.timer.remainingMs = Math.min(
            s.timer.durationMs,
            Math.max(0, s.timer.endsAt - s.updatedAt),
          );
          s.timer.endsAt = null;
        }
        if (s.paused) {
          s.paused.reason = "restored";
          event(s, events, { kind: "paused", reason: "restored" });
        } else pause(s, "restored", s.updatedAt, events);
      }
      return null;
    default: {
      const exhaustive: never = c;
      return exhaustive;
    }
  }
}
