import type { ValidationResult } from "./types";
import { validateQuestionPack } from "./validate-pack";

export type {
  Category,
  Clue,
  CluePicture,
  PictureId,
  ContentMetadata,
  DifficultyTier,
  FinalClue,
  QuestionPack,
  ScoringConfig,
  ScoringRound,
  ValidationError,
  ValidationResult,
} from "./types";
export {
  PICTURE_ROUTE,
  MAX_PICTURE_BYTES,
  MAX_PICTURE_ALT,
  parsePictureId,
  pictureSrc,
  pictureOf,
  pictureRefs,
} from "./pictures";
export { validateQuestionPack } from "./validate-pack";

/** Parse v3 pack JSON without importing answer-bearing content or doing I/O. */
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
