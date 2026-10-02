import type { QuestionPack, ValidationError, ValidationResult } from "./types";

const liveStateFields = new Set([
  "scores",
  "buzzers",
  "used",
  "currentClue",
  "players",
  "credentials",
  "usedClues",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

/** Validate content without coercion, mutation, I/O, or gameplay side effects. */
export function validateQuestionPack(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const ids = new Map<string, string>();
  const error = (path: string, message: string) => {
    errors.push({ path: path || "$", message });
  };

  function object(value: unknown, path: string): value is Record<string, unknown> {
    if (isObject(value)) return true;
    error(path, "Expected an object.");
    return false;
  }

  function text(value: unknown, path: string): value is string {
    if (typeof value === "string" && value.trim().length > 0) return true;
    error(path, "Expected a non-empty string.");
    return false;
  }

  function positiveInteger(value: unknown, path: string): value is number {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return true;
    }
    error(path, "Expected a positive safe integer.");
    return false;
  }

  function array(value: unknown, path: string): value is unknown[] {
    if (Array.isArray(value)) return true;
    error(path, "Expected an array.");
    return false;
  }

  function id(value: unknown, path: string) {
    if (!text(value, path)) return;
    const firstPath = ids.get(value);
    if (firstPath !== undefined) {
      error(path, `Duplicate ID "${value}"; first defined at ${firstPath}.`);
    } else {
      ids.set(value, path);
    }
  }

  function metadata(value: Record<string, unknown>, path: string) {
    for (const key of ["author", "notes"] as const) {
      if (Object.hasOwn(value, key) && typeof value[key] !== "string") {
        error(fieldPath(path, key), "Expected a string.");
      }
    }
    if (Object.hasOwn(value, "tags") && array(value.tags, fieldPath(path, "tags"))) {
      value.tags.forEach((tag, index) => text(tag, `${fieldPath(path, "tags")}[${index}]`));
    }
    if (Object.hasOwn(value, "metadata")) {
      object(value.metadata, fieldPath(path, "metadata"));
    }
  }

  // Check even unknown extension objects, so metadata cannot hide live state.
  const ancestors = new Set<object>();
  function checkLiveState(value: unknown, path: string) {
    if (typeof value !== "object" || value === null) return;
    if (ancestors.has(value)) {
      error(path, "Circular references are not valid JSON content.");
      return;
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      value.forEach((child, index) => checkLiveState(child, `${path}[${index}]`));
    } else {
      for (const [key, child] of Object.entries(value)) {
        const childPath = fieldPath(path, key);
        if (liveStateFields.has(key)) {
          error(childPath, `Live game state field "${key}" is not allowed in a question pack.`);
        }
        checkLiveState(child, childPath);
      }
    }
    ancestors.delete(value);
  }

  function clue(value: unknown, path: string, final: boolean) {
    if (!object(value, path)) return;
    id(value.id, `${path}.id`);
    text(value.prompt, `${path}.prompt`);
    text(value.answer, `${path}.answer`);
    metadata(value, path);
    if (final) {
      if (value.tier !== "final") error(`${path}.tier`, 'Expected the tier "final".');
    } else if (
      typeof value.tier !== "number" ||
      !Number.isInteger(value.tier) ||
      value.tier < 1 ||
      value.tier > 5
    ) {
      error(`${path}.tier`, "Expected an integer tier between 1 and 5.");
    }
    if (Object.hasOwn(value, "type") && value.type !== "text") {
      error(`${path}.type`, 'Only text clues are supported in F0; omit type or use "text".');
    }
    for (const key of ["points", "defaultPoints"] as const) {
      if (Object.hasOwn(value, key)) {
        error(`${path}.${key}`, "Static clue points are not supported; use tier and scoring.rounds.");
      }
    }
  }

  if (!object(input, "")) return { ok: false, errors };
  checkLiveState(input, "");
  id(input.id, "id");
  text(input.title, "title");
  metadata(input, "");
  if (input.schemaVersion !== "2.0.0") {
    error("schemaVersion", 'Expected schema version "2.0.0".');
  }
  if (Object.hasOwn(input, "description")) text(input.description, "description");
  if (Object.hasOwn(input, "custom") && typeof input.custom !== "boolean") {
    error("custom", "Expected a boolean.");
  }

  let categoryCount: number | undefined;
  let clueCount: number | undefined;
  if (object(input.dimensions, "dimensions")) {
    if (positiveInteger(input.dimensions.categories, "dimensions.categories")) {
      categoryCount = input.dimensions.categories;
    }
    if (positiveInteger(input.dimensions.cluesPerCategory, "dimensions.cluesPerCategory")) {
      clueCount = input.dimensions.cluesPerCategory;
    }
  }

  if (object(input.scoring, "scoring")) {
    const scoring = input.scoring;
    metadata(scoring, "scoring");
    const validDefault = text(scoring.defaultRoundId, "scoring.defaultRoundId");
    if (array(scoring.rounds, "scoring.rounds")) {
      if (scoring.rounds.length === 0) error("scoring.rounds", "Expected at least one scoring round.");
      scoring.rounds.forEach((round, index) => {
        const path = `scoring.rounds[${index}]`;
        if (!object(round, path)) return;
        id(round.id, `${path}.id`);
        text(round.title, `${path}.title`);
        metadata(round, path);
        if (object(round.pointsByTier, `${path}.pointsByTier`)) {
          for (let tier = 1; tier <= 5; tier++) {
            positiveInteger(round.pointsByTier[tier], `${path}.pointsByTier.${tier}`);
          }
        }
      });
      if (validDefault && !scoring.rounds.some((round) => isObject(round) && round.id === scoring.defaultRoundId)) {
        error("scoring.defaultRoundId", "Must reference an ID in scoring.rounds.");
      }
    }
  }

  if (array(input.categories, "categories")) {
    if (categoryCount !== undefined && input.categories.length !== categoryCount) {
      error("dimensions.categories", `Declared ${categoryCount} categories, but found ${input.categories.length}.`);
    }
    input.categories.forEach((category, index) => {
      const path = `categories[${index}]`;
      if (!object(category, path)) return;
      id(category.id, `${path}.id`);
      text(category.title, `${path}.title`);
      metadata(category, path);
      if (array(category.clues, `${path}.clues`)) {
        if (clueCount !== undefined && category.clues.length !== clueCount) {
          error(`${path}.clues`, `Expected ${clueCount} clues from dimensions.cluesPerCategory, but found ${category.clues.length}.`);
        }
        category.clues.forEach((value, clueIndex) => clue(value, `${path}.clues[${clueIndex}]`, false));
      }
      clue(category.finalJeoparty, `${path}.finalJeoparty`, true);
    });
  }

  // Every required and known optional property is checked above. Return the
  // original object, including extensions, rather than silently rewriting it.
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, data: input as unknown as QuestionPack };
}
