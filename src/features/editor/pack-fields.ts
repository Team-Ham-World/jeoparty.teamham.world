/**
 * The only place the editor names two content-format details that the
 * content task is renaming (category final clue field and schema version).
 * When that lands, change these two constants; the `satisfies` checks fail
 * the typecheck until you do.
 */
import type { Category, FinalClue, QuestionPack } from "@/features/content";

export const FINAL_CLUE_FIELD = "finalJeoparty" as const satisfies keyof Category;
export const PACK_SCHEMA_VERSION = "2.0.0" as const satisfies QuestionPack["schemaVersion"];

export function finalClueOf(category: Category): FinalClue {
  return category[FINAL_CLUE_FIELD];
}

export function withFinalClue(category: Category, finalClue: FinalClue): Category {
  return { ...category, [FINAL_CLUE_FIELD]: finalClue };
}

/** Validator path of a category's final clue, e.g. `categories[2].<field>`. */
export function finalCluePath(categoryIndex: number): string {
  return `categories[${categoryIndex}].${FINAL_CLUE_FIELD}`;
}
