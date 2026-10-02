export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

/** Optional content metadata; unknown extension fields are preserved. */
export interface ContentMetadata {
  author?: string;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** F0 supports text only. Other clue types require a later format extension. */
export interface Clue extends ContentMetadata {
  id: string;
  tier: DifficultyTier;
  type?: "text";
  prompt: string;
  answer: string;
}

export interface FinalClue extends ContentMetadata {
  id: string;
  tier: "final";
  type?: "text";
  prompt: string;
  answer: string;
}

export interface Category extends ContentMetadata {
  id: string;
  title: string;
  clues: Clue[];
  finalJeoparty: FinalClue;
}

export interface ScoringRound extends ContentMetadata {
  id: string;
  title: string;
  pointsByTier: Record<DifficultyTier, number>;
}

export interface ScoringConfig extends ContentMetadata {
  defaultRoundId: string;
  rounds: ScoringRound[];
}

export interface QuestionPack extends ContentMetadata {
  schemaVersion: "2.0.0";
  id: string;
  title: string;
  description?: string;
  custom?: boolean;
  dimensions: {
    categories: number;
    cluesPerCategory: number;
  };
  scoring: ScoringConfig;
  categories: Category[];
}

export interface ValidationError {
  /** "$" denotes the root; other paths use dot notation and array indexes. */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; data: QuestionPack }
  | { ok: false; errors: ValidationError[] };
