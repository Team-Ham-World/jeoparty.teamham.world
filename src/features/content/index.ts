import type { ValidationResult } from "./types";
import { validateQuestionPack } from "./validate-pack";

export type {
  Category,
  Clue,
  ContentMetadata,
  DifficultyTier,
  FinalClue,
  QuestionPack,
  ScoringConfig,
  ScoringRound,
  ValidationError,
  ValidationResult,
} from "./types";
export { validateQuestionPack } from "./validate-pack";

/** Parse supplied JSON without importing an answer-bearing pack or doing I/O. */
export function parseQuestionPackJson(json: string): ValidationResult {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return {
      ok: false,
      errors: [{ path: "$", message: "Invalid JSON syntax. Supply a complete JSON document." }],
    };
  }
  return validateQuestionPack(input);
}
