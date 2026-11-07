import type { PlayerId, PublicPlayer } from "@/features/engine/contract";

const numberFormat = new Intl.NumberFormat("en-US");

/** 1200 → "1,200"; −400 → "−400" (true minus sign, reads better on a TV). */
export function formatScore(score: number): string {
  const text = numberFormat.format(Math.abs(score));
  return score < 0 ? `−${text}` : text;
}

/** Signed change: +400 / −400. */
export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${numberFormat.format(delta)}` : `−${numberFormat.format(-delta)}`;
}

export function nameOf(players: readonly PublicPlayer[], id: PlayerId | null | undefined): string {
  if (!id) return "Someone";
  return players.find((player) => player.id === id)?.name ?? "A player who left";
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
