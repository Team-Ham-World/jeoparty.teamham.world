import type { ClueView, PlayerId, PublicPlayer, ViewCommon } from "@/features/engine/contract";

const numberFormat = new Intl.NumberFormat("en-US");

/** 1200 → "1,200"; −400 → "−400" (true minus sign, reads better on a TV). */
export function formatScore(score: number): string {
  const text = numberFormat.format(Math.abs(score));
  return score < 0 ? `−${text}` : text;
}

/** Signed change: +400 / −400. */
export function formatDelta(delta: number): string {
  // Math.abs also turns -0 (a zero stake, negated) into a plain 0.
  return `${delta < 0 ? "−" : "+"}${numberFormat.format(Math.abs(delta))}`;
}

export function nameOf(players: readonly PublicPlayer[], id: PlayerId | null | undefined): string {
  if (!id) return "Someone";
  return players.find((player) => player.id === id)?.name ?? "A player who left";
}

/**
 * Everyone an event can name: the seated players plus late joiners waiting for
 * the next game, so a waiting player isn't announced as someone who left.
 */
export function namedInEvents(
  view: Pick<ViewCommon, "players" | "waitingPlayers">,
): PublicPlayer[] {
  return [
    ...view.players,
    ...view.waitingPlayers.map((waiting) => ({ ...waiting, score: 0, connected: true })),
  ];
}

/** "Ivvy", "Ivvy and Medchu", "Ivvy, Medchu and John". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * How far ahead a fair-buzzing winner was: "by 0.04 s", or "by a hair" under
 * 10 ms. Hundredths of a second are how people already read race results, and
 * finer digits would claim more precision than phone timing has. Rounding
 * would turn anything under 10 ms into "by 0.00 s" or "0.01 s", so those read
 * "by a hair" (the server breaks exact ties by arrival). Null means nobody
 * else buzzed, so there is no margin to show.
 */
export function formatMargin(marginMs: number | null): string | null {
  if (marginMs === null || !Number.isFinite(marginMs)) return null;
  if (marginMs < 10) return "by a hair";
  // 995 ms and up would round to "1.00 s"; whole tenths read better there.
  if (marginMs < 995) return `by ${(Math.round(marginMs / 10) / 100).toFixed(2)} s`;
  return `by ${(Math.round(marginMs / 100) / 10).toFixed(1)} s`;
}

/**
 * The winning margin to show beside the player who is answering, or null.
 * Only while they answer the buzz they won: a wager clue has no race, and a
 * result from an earlier opening never describes the current answerer.
 */
export function answeringMargin(clue: ClueView): string | null {
  const result = clue.buzzResult;
  if (clue.stage !== "answering" || !result || result.winnerId !== clue.answeringPlayerId)
    return null;
  return formatMargin(result.marginMs);
}
