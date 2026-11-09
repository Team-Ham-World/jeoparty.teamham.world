import { z } from "zod";
import type { ClientCommand, ClientMessage, ConnectionRole } from "@/features/network/protocol";
import { ROOM_CODE_PATTERN } from "@/features/network/protocol";

export function isSafeReturnPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/packs" ||
    /^\/packs\/[A-Za-z0-9_-]{1,128}$/.test(path) ||
    (/^\/(r|host)\/[^/]+$/.test(path) && ROOM_CODE_PATTERN.test(path.split("/")[2]))
  );
}
const id = z.string().min(1).max(128);
const integer = z.number().int().safe();
const clue = { clueId: id };
const player = { playerId: id };
const empty = (type: string) => z.object({ type: z.literal(type) }).strict();
const patch = z
  .object({
    rounds: z.union([z.literal(1), z.literal(2)]).optional(),
    categoriesPerRound: integer.optional(),
    wagerClues: z.tuple([integer, integer]).optional(),
    finalRound: z.boolean().optional(),
    fairBuzzing: z.boolean().optional(),
    falseStartLockout: z.boolean().optional(),
    timers: z
      .object({
        enabled: z.boolean().optional(),
        buzzWindowMs: integer.optional(),
        answerWindowMs: integer.optional(),
        finalAnswerMs: integer.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export const commandSchema = z.union([
  ...[
    "startGame",
    "continue",
    "showFinalClue",
    "lockFinalAnswers",
    "finishGame",
    "pause",
    "resume",
    "endGame",
    "playAgain",
  ].map(empty),
  ...["selectClue", "openBuzzers", "endAttempts", "reveal", "returnToBoard"].map((type) =>
    z.object({ type: z.literal(type), ...clue }).strict(),
  ),
  ...["removePlayer", "revealFinalResponse"].map((type) =>
    z.object({ type: z.literal(type), ...player }).strict(),
  ),
  z
    .object({
      type: z.literal("buzz"),
      ...clue,
      reactionMs: z.number().finite().min(0).max(86_400_000),
      falseStart: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("choosePack"), packId: id }).strict(),
  z.object({ type: z.literal("updateSettings"), patch }).strict(),
  z
    .object({
      type: z.literal("judge"),
      ...clue,
      attemptId: id,
      correct: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("judgeFinal"), ...player, correct: z.boolean() }).strict(),
  z
    .object({
      type: z.literal("adjustScore"),
      ...player,
      delta: integer,
      reason: z.string().min(1).max(120),
    })
    .strict(),
  z.object({ type: z.literal("submitWager"), ...clue, amount: integer }).strict(),
  z.object({ type: z.literal("submitFinalWager"), amount: integer }).strict(),
  z.object({ type: z.literal("submitFinalAnswer"), text: z.string().max(200) }).strict(),
]);
const messageSchema = z.union([
  z.object({ t: z.literal("cmd"), id: z.uuid(), cmd: commandSchema }).strict(),
  z.object({ t: z.literal("resync") }).strict(),
  z.object({ t: z.literal("probeAck"), id }).strict(),
  z.object({ t: z.literal("ping"), at: z.number().finite() }).strict(),
]);
export function parseClientMessage(raw: unknown): ClientMessage | null {
  const parsed = messageSchema.safeParse(raw);
  // Schemas built from mapped literal arrays widen to string; validation above is exhaustive.
  return parsed.success ? (parsed.data as ClientMessage) : null;
}
export function commandAllowed(role: ConnectionRole, command: ClientCommand): boolean {
  const playerOnly = ["buzz", "submitFinalWager", "submitFinalAnswer"];
  if (role === "display") return false;
  return role === "player"
    ? playerOnly.includes(command.type) || command.type === "submitWager"
    : !playerOnly.includes(command.type);
}
