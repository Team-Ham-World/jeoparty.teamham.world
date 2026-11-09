import type { GameEvent, PlayerId, PublicPlayer } from "@/features/engine/contract";
import { formatDelta, formatScore, listNames, nameOf } from "./format";

/**
 * One sentence for screen readers (aria-live) about a public game event.
 * `meId` lets the player screen say "You" instead of their own name.
 */
export function describeEvent(
  event: GameEvent,
  players: readonly PublicPlayer[],
  meId?: PlayerId,
): string | null {
  const who = (id: PlayerId) => (id === meId ? "You" : nameOf(players, id));
  switch (event.kind) {
    case "playerJoined":
      return `${who(event.playerId)} joined.`;
    case "gameStarted":
      return "The game has started.";
    case "roundStarted":
      return `Round ${event.roundIndex + 1} is starting.`;
    case "clueSelected":
      return event.wager ? "Hot HAM! A wager clue." : "A new clue is up.";
    case "buzzersOpened":
      return "Buzzers are opening.";
    case "buzzAccepted":
      return event.playerId === meId
        ? "You buzzed in first. You're up!"
        : `${who(event.playerId)} buzzed in.`;
    case "wagerSubmitted":
      return `${who(event.playerId)} wagered ${formatScore(event.amount)}.`;
    case "judged":
      return `${who(event.playerId)}: ${event.correct ? "correct" : "incorrect"}, ${formatDelta(event.delta)}.`;
    case "attemptsEnded":
      return "No more answers on this clue.";
    case "revealed":
      return "The answer is revealed.";
    case "timerExpired":
      return event.timer === "buzz"
        ? "Time's up. Buzzers closed."
        : event.timer === "answer"
          ? "Answer time is up."
          : "Final answers are locked.";
    case "finalStarted":
      return "The final round is starting.";
    case "finalClueShown":
      return "The final clue is up.";
    case "finalResponseRevealed":
      return `Revealing ${event.playerId === meId ? "your" : `${nameOf(players, event.playerId)}'s`} response.`;
    case "finalJudged":
      return `${who(event.playerId)}: ${event.correct ? "correct" : "incorrect"}, ${formatDelta(event.delta)}.`;
    case "scoreAdjusted":
      return event.playerId === meId
        ? `The host changed your score by ${formatDelta(event.delta)}.`
        : `The host changed ${nameOf(players, event.playerId)}'s score by ${formatDelta(event.delta)}.`;
    case "paused":
      return "The game is paused.";
    case "resumed":
      return "The game resumed.";
    case "gameOver": {
      if (meId && event.winnerIds.includes(meId))
        return event.winnerIds.length > 1 ? "Game over. You share the win!" : "Game over. You win!";
      const names = event.winnerIds.map((id) => nameOf(players, id));
      return names.length > 1
        ? `Game over. Shared win: ${listNames(names)}.`
        : `Game over. ${names[0] ?? "Nobody"} wins.`;
    }
  }
}

/** `title` for banners, `headline` for the big screen. */
export function pauseMessage(reason: "host" | "hostOffline" | "restored"): {
  title: string;
  headline: string;
  body: string;
} {
  switch (reason) {
    case "host":
      return {
        title: "Paused",
        headline: "Quick break",
        body: "The host paused the game. Timers are frozen.",
      };
    case "hostOffline":
      return {
        title: "Paused: host offline",
        headline: "Waiting for the host",
        body: "The host lost their connection. The game waits until they're back.",
      };
    case "restored":
      return {
        title: "Paused after a restart",
        headline: "Back in a moment",
        body: "The quiz server restarted. Scores are safe; the host will resume.",
      };
  }
}
