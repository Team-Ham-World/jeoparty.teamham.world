/** PROPOSED presentation inputs only, not agreed engine/network contracts.
 * Availability, scores and winners are supplied, never decided here.
 * Public inputs must be filtered upstream, not hidden in the component.
 */
export type PublicScore = { readonly id: string; readonly name: string; readonly score: number };
export type PublicClue = {
  readonly category: string;
  readonly value: number;
  readonly prompt: string;
  readonly answer?: never;
};
export type PublicCategory = {
  readonly id: string;
  readonly name: string;
  readonly clues: readonly { readonly id: string; readonly value: number; readonly availability: "available" | "completed" }[];
};
type Unrevealed = { readonly clue: PublicClue; readonly answer?: never };
export type ProposedDisplayView = {
  readonly scores: readonly PublicScore[];
  readonly connection: "current" | "offline" | "stale";
} & (
  | { readonly phase: "board"; readonly categories: readonly PublicCategory[]; readonly answer?: never }
  | ({ readonly phase: "reading" | "open" } & Unrevealed)
  | ({ readonly phase: "answering"; readonly answeringPlayer: string } & Unrevealed)
  | { readonly phase: "reveal"; readonly clue: PublicClue; readonly answer: string }
  | { readonly phase: "results"; readonly winners: readonly { readonly id: string; readonly name: string }[]; readonly answer?: never }
);
