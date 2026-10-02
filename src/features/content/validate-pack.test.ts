import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseQuestionPackJson, validateQuestionPack } from "./index";
import type { QuestionPack, ValidationError } from "./types";

// Node-only test fixture: never import the answer-bearing pack in a UI module.
const sampleJson = readFileSync(new URL("../../../docs/sample-pack.json", import.meta.url), "utf8");

function sample(): QuestionPack {
  const result = parseQuestionPackJson(sampleJson);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.data;
}

function errorsFor(input: unknown): ValidationError[] {
  const result = validateQuestionPack(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected validation to fail.");
  return result.errors;
}

describe("validateQuestionPack", () => {
  it("accepts the expanded sample without changing any content", () => {
    const pack = sample();
    const before = structuredClone(pack);
    const result = validateQuestionPack(pack);
    expect(result).toEqual({ ok: true, data: pack });
    expect(result).not.toHaveProperty("errors");
    if (result.ok) expect(result.data).toBe(pack);
    expect(pack).toEqual(before);
    expect(pack.categories).toHaveLength(12);
    expect(pack.categories.flatMap((category) => category.clues)).toHaveLength(60);
    expect(pack.categories.map((category) => category.finalJeoparty)).toHaveLength(12);
  });

  it("accepts a smaller custom pack with omitted text types and optional metadata", () => {
    const pack = sample();
    pack.categories = pack.categories.slice(0, 3);
    pack.dimensions = { categories: 3, cluesPerCategory: 3 };
    for (const category of pack.categories) {
      category.clues = category.clues.slice(0, 3);
      for (const clue of category.clues) delete clue.type;
      delete category.finalJeoparty.type;
    }
    pack.author = "A custom author";
    pack.tags = ["playtest"];
    pack.categories[0].clues[0].metadata = { futureAttachment: { url: "https://example.com" } };
    expect(validateQuestionPack(pack)).toEqual({ ok: true, data: pack });
  });

  for (const input of [null, [], "not a pack", 42]) {
    it(`rejects a non-object root: ${JSON.stringify(input)}`, () => {
      expect(errorsFor(input)).toEqual([{ path: "$", message: "Expected an object." }]);
    });
  }

  it.each(["id", "title"] as const)("rejects blank root %s", (field) => {
    const pack = sample();
    pack[field] = " \t ";
    expect(errorsFor(pack)).toContainEqual({ path: field, message: "Expected a non-empty string." });
  });

  it.each(["prompt", "answer"] as const)("rejects empty, blank, or missing %s", (field) => {
    for (const value of ["", " \n\t ", undefined]) {
      const pack = sample();
      const clue: Record<string, unknown> = pack.categories[0].clues[1];
      if (value === undefined) delete clue[field];
      else clue[field] = value;
      expect(errorsFor(pack)).toContainEqual({
        path: `categories[0].clues[1].${field}`,
        message: "Expected a non-empty string.",
      });
    }
  });

  it("rejects duplicate clue IDs and reports the first occurrence", () => {
    const pack = sample();
    pack.categories[0].clues[1].id = pack.categories[0].clues[0].id;
    expect(errorsFor(pack)).toContainEqual({
      path: "categories[0].clues[1].id",
      message: 'Duplicate ID "clue-web-200"; first defined at categories[0].clues[0].id.',
    });
  });

  it("rejects duplicate category IDs", () => {
    const pack = sample();
    pack.categories[1].id = pack.categories[0].id;
    expect(errorsFor(pack)).toContainEqual({
      path: "categories[1].id",
      message: 'Duplicate ID "cat-web-technologies"; first defined at categories[0].id.',
    });
  });

  it("checks ID uniqueness across pack, rounds, categories, and final clues", () => {
    const pack = sample();
    pack.scoring.rounds[0].id = pack.id;
    pack.scoring.defaultRoundId = pack.id;
    pack.categories[0].id = pack.id;
    pack.categories[0].finalJeoparty.id = pack.id;
    const errors = errorsFor(pack);
    for (const path of ["scoring.rounds[0].id", "categories[0].id", "categories[0].finalJeoparty.id"]) {
      expect(errors).toContainEqual({
        path,
        message: `Duplicate ID "${pack.id}"; first defined at id.`,
      });
    }
  });

  it.each([0, 6, -1, 1.5, "1", NaN, Infinity, undefined])("rejects invalid tier %s", (tier) => {
    const pack = sample();
    const clue: Record<string, unknown> = pack.categories[0].clues[0];
    clue.tier = tier;
    expect(errorsFor(pack)).toContainEqual({
      path: "categories[0].clues[0].tier",
      message: "Expected an integer tier between 1 and 5.",
    });
  });

  it("reports both category and clue dimension mismatches", () => {
    const pack = sample();
    pack.dimensions.categories = 11;
    pack.categories[0].clues.pop();
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "dimensions.categories", message: "Declared 11 categories, but found 12." },
      { path: "categories[0].clues", message: "Expected 5 clues from dimensions.cluesPerCategory, but found 4." },
    ]));
  });

  it.each([0, -1, 2.5, "5"])("rejects invalid dimensions %s", (value) => {
    const pack = sample();
    const dimensions: Record<string, unknown> = pack.dimensions;
    dimensions.cluesPerCategory = value;
    expect(errorsFor(pack)).toContainEqual({
      path: "dimensions.cluesPerCategory",
      message: "Expected a positive safe integer.",
    });
  });

  it.each(["scores", "buzzers", "used", "currentClue", "players", "credentials", "usedClues"])("rejects live state field %s even when empty", (field) => {
    const pack = sample();
    pack[field] = null;
    expect(errorsFor(pack)).toContainEqual({
      path: field,
      message: `Live game state field "${field}" is not allowed in a question pack.`,
    });
  });

  it("checks for live state inside clues and nested extension metadata", () => {
    const pack = sample();
    pack.categories[0].clues[1].used = false;
    pack.metadata = { extension: [{ scores: {} }] };
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "categories[0].clues[1].used", message: 'Live game state field "used" is not allowed in a question pack.' },
      { path: "metadata.extension[0].scores", message: 'Live game state field "scores" is not allowed in a question pack.' },
    ]));
  });

  it("rejects invalid final clues", () => {
    const pack = sample();
    const final: Record<string, unknown> = pack.categories[0].finalJeoparty;
    final.tier = 5;
    final.answer = " ";
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "categories[0].finalJeoparty.tier", message: 'Expected the tier "final".' },
      { path: "categories[0].finalJeoparty.answer", message: "Expected a non-empty string." },
    ]));
  });

  it("requires final clues and arrays rather than malformed containers", () => {
    const pack = sample();
    const firstCategory: Record<string, unknown> = pack.categories[0];
    const secondCategory: Record<string, unknown> = pack.categories[1];
    delete firstCategory.finalJeoparty;
    secondCategory.clues = null;
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "categories[0].finalJeoparty", message: "Expected an object." },
      { path: "categories[1].clues", message: "Expected an array." },
    ]));
  });

  it("rejects missing tier scoring and unknown default rounds", () => {
    const pack = sample();
    const points: Record<string, unknown> = pack.scoring.rounds[0].pointsByTier;
    delete points[3];
    pack.scoring.defaultRoundId = "missing-round";
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "scoring.rounds[0].pointsByTier.3", message: "Expected a positive safe integer." },
      { path: "scoring.defaultRoundId", message: "Must reference an ID in scoring.rounds." },
    ]));
  });

  it("rejects empty rounds and non-integer round points", () => {
    const pack = sample();
    pack.scoring.rounds[0].pointsByTier[1] = 1.5;
    expect(errorsFor(pack)).toContainEqual({ path: "scoring.rounds[0].pointsByTier.1", message: "Expected a positive safe integer." });
    pack.scoring.rounds = [];
    expect(errorsFor(pack)).toContainEqual({ path: "scoring.rounds", message: "Expected at least one scoring round." });
  });

  it("rejects unsupported schema versions, reserved clue types, and static points", () => {
    const pack = sample();
    const root: Record<string, unknown> = pack;
    root.schemaVersion = "1.0.0";
    const clue: Record<string, unknown> = pack.categories[0].clues[0];
    clue.type = "daily_double";
    clue.points = 200;
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "schemaVersion", message: 'Expected schema version "2.0.0".' },
      { path: "categories[0].clues[0].type", message: 'Only text clues are supported in F0; omit type or use "text".' },
      { path: "categories[0].clues[0].points", message: "Static clue points are not supported; use tier and scoring.rounds." },
    ]));
  });

  it("checks known optional metadata fields", () => {
    const pack = sample();
    pack.categories[0].clues[0].tags = [" "];
    const root: Record<string, unknown> = pack;
    root.metadata = [];
    expect(errorsFor(pack)).toEqual(expect.arrayContaining([
      { path: "categories[0].clues[0].tags[0]", message: "Expected a non-empty string." },
      { path: "metadata", message: "Expected an object." },
    ]));
  });

  it("reports cyclic unknown input rather than recursing indefinitely", () => {
    const pack = sample();
    pack.extension = pack;
    expect(errorsFor(pack)).toContainEqual({ path: "extension", message: "Circular references are not valid JSON content." });
  });
});

describe("parseQuestionPackJson", () => {
  it("validates parsed sample JSON", () => {
    expect(parseQuestionPackJson(sampleJson).ok).toBe(true);
  });

  it("reports invalid JSON at the root without leaking input", () => {
    expect(parseQuestionPackJson("{secret input")).toEqual({
      ok: false,
      errors: [{ path: "$", message: "Invalid JSON syntax. Supply a complete JSON document." }],
    });
  });

  it("uses the same validator for syntactically valid but invalid content", () => {
    expect(parseQuestionPackJson("null")).toEqual(validateQuestionPack(null));
  });
});
