import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuestionPackJson, validateQuestionPack } from "./index";
import type { QuestionPack, ValidationError } from "./types";

// Read answer-bearing fixtures in Node tests, never through UI imports.
const smallSampleJson = readFileSync(new URL("./samples/sample-pack-3x3.json", import.meta.url), "utf8");
const expandedSampleJson = readFileSync(new URL("./samples/ham-starter-pack.json", import.meta.url), "utf8");

function validatedSample(json: string): QuestionPack {
  const result = parseQuestionPackJson(json);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}

type InvalidVariant = {
  name: string;
  change: (pack: QuestionPack) => void;
  error: ValidationError;
};

const invalidVariants: InvalidVariant[] = [
  {
    name: "missing pack title",
    change(pack) {
      const root: Record<string, unknown> = pack;
      delete root.title;
    },
    error: { path: "title", message: "Expected a non-empty string." },
  },
  {
    name: "missing category title",
    change(pack) {
      const category: Record<string, unknown> = pack.categories[1];
      delete category.title;
    },
    error: { path: "categories[1].title", message: "Expected a non-empty string." },
  },
  {
    name: "missing clue prompt",
    change(pack) {
      const clue: Record<string, unknown> = pack.categories[1].clues[2];
      delete clue.prompt;
    },
    error: { path: "categories[1].clues[2].prompt", message: "Expected a non-empty string." },
  },
  {
    name: "missing clue answer",
    change(pack) {
      const clue: Record<string, unknown> = pack.categories[2].clues[1];
      delete clue.answer;
    },
    error: { path: "categories[2].clues[1].answer", message: "Expected a non-empty string." },
  },
  {
    name: "duplicate clue and final IDs",
    change(pack) {
      pack.categories[1].clues[1].id = pack.categories[0].finalClue.id;
    },
    error: {
      path: "categories[1].clues[1].id",
      message: 'Duplicate ID "666ac83b-1b5f-4307-a9b8-8927dc3a7611"; first defined at categories[0].finalClue.id.',
    },
  },
  {
    name: "wrong declared category count",
    change(pack) {
      pack.dimensions.categories = 4;
    },
    error: { path: "dimensions.categories", message: "Declared 4 categories, but found 3." },
  },
  {
    name: "incomplete ordinary category",
    change(pack) {
      pack.categories[2].clues.pop();
    },
    error: {
      path: "categories[2].clues",
      message: "Expected 3 clues from dimensions.cluesPerCategory, but found 2.",
    },
  },
  {
    name: "fractional tier",
    change(pack) {
      const clue: Record<string, unknown> = pack.categories[0].clues[1];
      clue.tier = 1.5;
    },
    error: {
      path: "categories[0].clues[1].tier",
      message: "Expected an integer tier between 1 and 5.",
    },
  },
  {
    name: "missing unused tier scoring",
    change(pack) {
      const points: Record<string, unknown> = pack.scoring.rounds[0].pointsByTier;
      delete points[5];
    },
    error: {
      path: "scoring.rounds[0].pointsByTier.5",
      message: "Expected a positive safe integer.",
    },
  },
  {
    name: "fractional scoring",
    change(pack) {
      pack.scoring.rounds[0].pointsByTier[2] = 400.5;
    },
    error: {
      path: "scoring.rounds[0].pointsByTier.2",
      message: "Expected a positive safe integer.",
    },
  },
  {
    name: "missing final content",
    change(pack) {
      const category: Record<string, unknown> = pack.categories[2];
      delete category.finalClue;
    },
    error: { path: "categories[2].finalClue", message: "Expected an object." },
  },
];

describe("sample pack inventory", () => {
  it("parses the complete 3x3 sample without rewriting its content", () => {
    const input: unknown = JSON.parse(smallSampleJson);
    const pack = validatedSample(smallSampleJson);

    expect(pack).toEqual(input);
    expect(pack.schemaVersion).toBe("3.0.0");
    expect(pack.dimensions).toEqual({ categories: 3, cluesPerCategory: 3 });
    expect(pack.categories).toHaveLength(3);
    expect(pack.categories.flatMap((category) => category.clues)).toHaveLength(9);
    expect(pack.categories.map((category) => category.finalClue)).toHaveLength(3);
    for (const category of pack.categories) {
      expect(category.clues.map((clue) => clue.tier)).toEqual([1, 2, 3]);
      expect(category.finalClue.tier).toBe("final");
      expect(category.finalClue.notes).toBe("Final-round content; separate from the ordinary board.");
    }
    expect(pack.scoring.rounds).toHaveLength(1);
    expect(pack.scoring.defaultRoundId).toBe(pack.scoring.rounds[0].id);
    expect(pack.scoring.rounds[0].pointsByTier).toEqual({
      1: 200, 2: 400, 3: 600, 4: 800, 5: 1000,
    });
  });

  it("uses distinct definition IDs within each pack", () => {
    const packs = [validatedSample(smallSampleJson), validatedSample(expandedSampleJson)];
    for (const pack of packs) {
      const ids = [
        pack.id,
        ...pack.scoring.rounds.map((round) => round.id),
        ...pack.categories.flatMap((category) => [
          category.id,
          ...category.clues.map((clue) => clue.id),
          category.finalClue.id,
        ]),
      ];

      // defaultRoundId is a reference, not a second ID definition.
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("returns the same valid sample object without mutation", () => {
    const pack = validatedSample(smallSampleJson);
    const before = structuredClone(pack);
    const result = validateQuestionPack(pack);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.data).toBe(pack);
    expect(pack).toEqual(before);
  });

  it.each(invalidVariants)("rejects $name at $error.path", ({ change, error }) => {
    const pack = validatedSample(smallSampleJson);
    change(pack);
    const before = structuredClone(pack);
    const result = validateQuestionPack(pack);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected the invalid sample variant to fail validation.");
    expect(result.errors).toContainEqual(error);
    expect(pack).toEqual(before);
    expect(parseQuestionPackJson(JSON.stringify(pack))).toEqual(result);
  });
});
