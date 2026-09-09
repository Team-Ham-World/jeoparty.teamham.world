/** Onboarding metadata only; these are not game-state or permission contracts. */
export type TeamArea = {
  id: string;
  owner: string;
  title: string;
  summary: string;
  href: string;
  sourcePath: string;
  guidePath: string;
  nextStep: string;
};

export const team = {
  engine: {
    id: "engine",
    owner: "Happy",
    title: "Engine & rules",
    summary: "Game phases, legal actions, and scoring calculations.",
    href: "/workbench/engine",
    sourcePath: "src/features/engine/",
    guidePath: "docs/pointers/happy/README.md",
    nextStep: "Agree on pack inputs and the minimum action/state interface with Fante and John. H1 follows the milestone-0 authority proof.",
  },
  board: {
    id: "board",
    owner: "Ivvy",
    title: "Board & presentation",
    summary: "The shared display, clues, and public scores.",
    href: "/display",
    sourcePath: "src/features/board/",
    guidePath: "docs/pointers/ivvy/README.md",
    nextStep: "Review public-view examples and basic styles with the team. I1 begins after milestone 0; this is not a live board.",
  },
  player: {
    id: "player",
    owner: "Scarlet",
    title: "Player experience",
    summary: "Phone joining, buzzer feedback, and score display.",
    href: "/play",
    sourcePath: "src/features/player/",
    guidePath: "docs/pointers/scarlet/README.md",
    nextStep: "Agree on player-view and buzz-request examples with Happy and John. S1 begins after milestone 0; no player session exists yet.",
  },
  host: {
    id: "host",
    owner: "Medchu",
    title: "Host controls",
    summary: "Clue controls, judging, and host feedback.",
    href: "/host",
    sourcePath: "src/features/host/",
    guidePath: "docs/pointers/medchu/README.md",
    nextStep: "Agree on host views and judgment inputs with Happy and John. M1 begins after milestone 0; this page has no host permissions.",
  },
  content: {
    id: "content",
    owner: "Fante",
    title: "Question content",
    summary: "Pack format, validation, and later the editor.",
    href: "/editor",
    sourcePath: "src/features/content/",
    guidePath: "docs/pointers/fante/README.md",
    nextStep: "Agree on pack fields and validation with Happy, and server-only loading with John. Then implement F0; an editor comes later.",
  },
  network: {
    id: "network",
    owner: "John",
    title: "Network & integration",
    summary: "Room identity, authoritative delivery, and persistence.",
    href: "/workbench/network",
    sourcePath: "src/features/network/",
    guidePath: "docs/pointers/john/README.md",
    nextStep: "Verify J0 setup with a teammate, then work with Happy on J1: prove one ordered, authorized command path before choosing the runtime.",
  },
} satisfies Record<string, TeamArea>;

export const teamAreas: readonly TeamArea[] = Object.values(team);
