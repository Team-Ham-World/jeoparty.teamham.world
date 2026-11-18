import type { QuestionPack } from "@/features/content";
import type { GameSettings } from "./contract";

export function defaultSettingsForBoard(dimensions: QuestionPack["dimensions"]): GameSettings {
  const categoriesPerRound = Math.min(6, dimensions.categories);
  const rounds = dimensions.categories >= 2 * categoriesPerRound ? 2 : 1;
  const cells = categoriesPerRound * dimensions.cluesPerCategory;
  return {
    categoriesPerRound,
    rounds,
    wagerClues: [Math.min(1, cells), Math.min(2, cells)],
    finalRound: true,
    fairBuzzing: true,
    falseStartLockout: true,
    timers: { enabled: true, buzzWindowMs: 10_000, answerWindowMs: 10_000, finalAnswerMs: 45_000 },
  };
}
