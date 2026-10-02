import type { ProposedDisplayView, PublicClue, PublicScore } from "./presentation-types";

// Invented public examples, not a question pack or private engine state.
const scores: readonly PublicScore[] = [
  { id: "ada", name: "Ada", score: 1200 },
  { id: "robin", name: "Robin", score: -200 },
  { id: "sam", name: "Sam", score: 800 },
];
const clue: PublicClue = {
  category: "The natural world", value: 400,
  prompt: "This ocean covers more of Earth’s surface than all of its land combined.",
};
const board: ProposedDisplayView = {
  phase: "board", connection: "current", scores,
  categories: [
    { id: "nature", name: "The natural world", clues: [
      { id: "n1", value: 200, availability: "completed" },
      { id: "n2", value: 400, availability: "available" },
      { id: "n3", value: 600, availability: "available" },
    ] },
    { id: "table", name: "At the table", clues: [
      { id: "t1", value: 200, availability: "available" },
      { id: "t2", value: 400, availability: "completed" },
      { id: "t3", value: 600, availability: "available" },
    ] },
    { id: "words", name: "Word for word", clues: [
      { id: "w1", value: 200, availability: "available" },
      { id: "w2", value: 400, availability: "available" },
      { id: "w3", value: 600, availability: "available" },
    ] },
  ],
};
export const previewFixtures = [
  { id: "board", label: "Ordinary board", view: board },
  { id: "reading", label: "Reading a clue", view: { phase: "reading", connection: "current", scores, clue } },
  { id: "open", label: "Buzzers open", view: { phase: "open", connection: "current", scores, clue } },
  { id: "answering", label: "Player answering", view: { phase: "answering", connection: "current", scores, clue, answeringPlayer: "Robin" } },
  // The answer is supplied only in this explicitly revealed example.
  { id: "reveal", label: "Answer revealed", view: { phase: "reveal", connection: "current", scores, clue, answer: "The Pacific Ocean" } },
  { id: "results", label: "Results · tied winners", view: {
    phase: "results", connection: "current",
    scores: [{ id: "ada", name: "Ada", score: 1600 }, { id: "robin", name: "Robin", score: -200 }, { id: "sam", name: "Sam", score: 1600 }],
    winners: [{ id: "ada", name: "Ada" }, { id: "sam", name: "Sam" }],
  } },
  { id: "offline", label: "Offline display", view: { ...board, connection: "offline" } },
  { id: "stale", label: "Stale display", view: { phase: "open", connection: "stale", scores, clue } },
  { id: "long", label: "Long text & large scores", view: {
    phase: "answering", connection: "current",
    answeringPlayer: "Alexandra of the exceptionally enthusiastic quiz team",
    scores: [
      { id: "alex", name: "Alexandra of the exceptionally enthusiastic quiz team", score: -123456789 },
      { id: "chris", name: "ChristopherWithAnUnusuallyLongUnbrokenDisplayName", score: 987654321 },
    ],
    clue: { category: "Places, landscapes and the world around us", value: 600, prompt: "From a quiet shore, a traveller looks out across an ocean stretching between Asia and Australia to the west and the Americas to the east. Name this vast body of water, whose surface is larger than all of Earth’s land put together." },
  } },
] as const satisfies readonly { id: string; label: string; view: ProposedDisplayView }[];
