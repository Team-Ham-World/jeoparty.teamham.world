import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseQuestionPackJson, validateQuestionPack } from "./index";
import { parsePictureId, pictureOf, pictureRefs, pictureSrc } from "./pictures";
import type { QuestionPack, ValidationError } from "./types";

// Node-only test fixture: never import the answer-bearing pack in a UI module.
const sampleJson = readFileSync(
  new URL("./samples/ham-starter-pack.json", import.meta.url),
  "utf8",
);

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
    expect(pack.categories.map((category) => category.finalClue)).toHaveLength(12);
  });

  it("accepts a smaller custom pack with omitted text types and optional metadata", () => {
    const pack = sample();
    pack.categories = pack.categories.slice(0, 3);
    pack.dimensions = { categories: 3, cluesPerCategory: 3 };
    for (const category of pack.categories) {
      category.clues = category.clues.slice(0, 3);
      for (const clue of category.clues) delete clue.type;
      delete category.finalClue.type;
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
    expect(errorsFor(pack)).toContainEqual({
      path: field,
      message: "Expected a non-empty string.",
    });
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
    pack.categories[0].finalClue.id = pack.id;
    const errors = errorsFor(pack);
    for (const path of ["scoring.rounds[0].id", "categories[0].id", "categories[0].finalClue.id"]) {
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
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "dimensions.categories", message: "Declared 11 categories, but found 12." },
        {
          path: "categories[0].clues",
          message: "Expected 5 clues from dimensions.cluesPerCategory, but found 4.",
        },
      ]),
    );
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

  it.each(["scores", "buzzers", "used", "currentClue", "players", "credentials", "usedClues"])(
    "rejects live state field %s even when empty",
    (field) => {
      const pack = sample();
      pack[field] = null;
      expect(errorsFor(pack)).toContainEqual({
        path: field,
        message: `Live game state field "${field}" is not allowed in a question pack.`,
      });
    },
  );

  it("checks for live state inside clues and nested extension metadata", () => {
    const pack = sample();
    pack.categories[0].clues[1].used = false;
    pack.metadata = { extension: [{ scores: {} }] };
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        {
          path: "categories[0].clues[1].used",
          message: 'Live game state field "used" is not allowed in a question pack.',
        },
        {
          path: "metadata.extension[0].scores",
          message: 'Live game state field "scores" is not allowed in a question pack.',
        },
      ]),
    );
  });

  it("rejects invalid final clues", () => {
    const pack = sample();
    const final: Record<string, unknown> = pack.categories[0].finalClue;
    final.tier = 5;
    final.answer = " ";
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "categories[0].finalClue.tier", message: 'Expected the tier "final".' },
        { path: "categories[0].finalClue.answer", message: "Expected a non-empty string." },
      ]),
    );
  });

  it("requires final clues and arrays rather than malformed containers", () => {
    const pack = sample();
    const firstCategory: Record<string, unknown> = pack.categories[0];
    const secondCategory: Record<string, unknown> = pack.categories[1];
    delete firstCategory.finalClue;
    secondCategory.clues = null;
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "categories[0].finalClue", message: "Expected an object." },
        { path: "categories[1].clues", message: "Expected an array." },
      ]),
    );
  });

  it("rejects missing tier scoring and unknown default rounds", () => {
    const pack = sample();
    const points: Record<string, unknown> = pack.scoring.rounds[0].pointsByTier;
    delete points[3];
    pack.scoring.defaultRoundId = "missing-round";
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "scoring.rounds[0].pointsByTier.3", message: "Expected a positive safe integer." },
        { path: "scoring.defaultRoundId", message: "Must reference an ID in scoring.rounds." },
      ]),
    );
  });

  it("caps each point value at 1,000,000 and still accepts small values", () => {
    const pack = sample();
    pack.scoring.rounds[0].pointsByTier[1] = 1_000_000;
    pack.scoring.rounds[0].pointsByTier[2] = 1;
    expect(validateQuestionPack(pack).ok).toBe(true);
    pack.scoring.rounds[0].pointsByTier[1] = 1_000_001;
    pack.scoring.rounds[0].pointsByTier[2] = 5e15;
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "scoring.rounds[0].pointsByTier.1", message: "Must be at most 1,000,000 points." },
        { path: "scoring.rounds[0].pointsByTier.2", message: "Must be at most 1,000,000 points." },
      ]),
    );
  });

  it("rejects empty rounds and non-integer round points", () => {
    const pack = sample();
    pack.scoring.rounds[0].pointsByTier[1] = 1.5;
    expect(errorsFor(pack)).toContainEqual({
      path: "scoring.rounds[0].pointsByTier.1",
      message: "Expected a positive safe integer.",
    });
    pack.scoring.rounds = [];
    expect(errorsFor(pack)).toContainEqual({
      path: "scoring.rounds",
      message: "Expected at least one scoring round.",
    });
  });

  it("rejects unsupported schema versions, reserved clue types, and static points", () => {
    const pack = sample();
    const root: Record<string, unknown> = pack;
    root.schemaVersion = "1.0.0";
    const clue: Record<string, unknown> = pack.categories[0].clues[0];
    clue.type = "daily_double";
    clue.points = 200;
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "schemaVersion", message: 'Expected schema version "3.0.0".' },
        {
          path: "categories[0].clues[0].type",
          message: 'Only text clues are supported; omit type or use "text".',
        },
        {
          path: "categories[0].clues[0].points",
          message: "Static clue points are not supported; use tier and scoring.rounds.",
        },
      ]),
    );
  });

  it("checks known optional metadata fields", () => {
    const pack = sample();
    pack.categories[0].clues[0].tags = [" "];
    const root: Record<string, unknown> = pack;
    root.metadata = [];
    expect(errorsFor(pack)).toEqual(
      expect.arrayContaining([
        { path: "categories[0].clues[0].tags[0]", message: "Expected a non-empty string." },
        { path: "metadata", message: "Expected an object." },
      ]),
    );
  });

  it("reports cyclic unknown input rather than recursing indefinitely", () => {
    const pack = sample();
    pack.extension = pack;
    expect(errorsFor(pack)).toContainEqual({
      path: "extension",
      message: "Circular references are not valid JSON content.",
    });
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

describe("content resource limits", () => {
  it.each(["ham-starter-pack.json", "sample-pack-3x3.json"])("keeps built-in %s valid", (file) => {
    expect(
      parseQuestionPackJson(readFileSync(new URL(`./samples/${file}`, import.meta.url), "utf8")).ok,
    ).toBe(true);
  });
  it.each([
    ["title", 120],
    ["categoryTitle", 120],
    ["roundTitle", 120],
    ["prompt", 500],
    ["answer", 500],
    ["finalPrompt", 500],
    ["finalAnswer", 500],
    ["notes", 1000],
    ["description", 1000],
  ] as const)("bounds %s at %i characters", (field, max) => {
    const pack = sample();
    function set(value: string) {
      switch (field) {
        case "title":
          pack.title = value;
          return;
        case "categoryTitle":
          pack.categories[0].title = value;
          return;
        case "roundTitle":
          pack.scoring.rounds[0].title = value;
          return;
        case "prompt":
          pack.categories[0].clues[0].prompt = value;
          return;
        case "answer":
          pack.categories[0].clues[0].answer = value;
          return;
        case "finalPrompt":
          pack.categories[0].finalClue.prompt = value;
          return;
        case "finalAnswer":
          pack.categories[0].finalClue.answer = value;
          return;
        case "notes":
          pack.categories[0].clues[0].notes = value;
          return;
        case "description":
          pack.description = value;
          return;
      }
    }
    set("x".repeat(max));
    expect(validateQuestionPack(pack).ok).toBe(true);
    set("x".repeat(max + 1));
    expect(errorsFor(pack)).toContainEqual(
      expect.objectContaining({
        message: `Must be at most ${max} characters.`,
      }),
    );
  });
  it("bounds declared dimensions and arrays independently", () => {
    const pack = sample();
    pack.dimensions.categories = 13;
    pack.dimensions.cluesPerCategory = 6;
    pack.categories.push({
      ...structuredClone(pack.categories[0]),
      id: "extra-category",
    });
    pack.categories[0].clues.push({
      ...pack.categories[0].clues[0],
      id: "extra-clue",
    });
    pack.scoring.rounds = Array.from({ length: 5 }, (_, i) => ({
      ...pack.scoring.rounds[0],
      id: `round-${i}`,
    }));
    const errors = errorsFor(pack);
    for (const path of [
      "dimensions.categories",
      "dimensions.cluesPerCategory",
      "categories",
      "categories[0].clues",
      "scoring.rounds",
    ])
      expect(errors).toContainEqual(
        expect.objectContaining({
          path,
          message: expect.stringContaining("Must be at most"),
        }),
      );
  });
});

describe("picture references", () => {
  const id = parsePictureId(`pic_${"a".repeat(43)}`)!;
  it.each(["clue", "final"])(
    "accepts an optional picture on a %s and copies only its fields",
    (kind) => {
      const pack = sample();
      const clue = kind === "clue" ? pack.categories[0].clues[0] : pack.categories[0].finalClue;
      expect(pictureOf(clue)).toBeNull();
      clue.picture = undefined;
      expect(validateQuestionPack(pack).ok).toBe(true);
      clue.picture = { id, alt: "" };
      expect(validateQuestionPack(pack).ok).toBe(true);
      const copy = pictureOf(clue);
      expect(copy).toEqual({ id, alt: "" });
      expect(copy).not.toBe(clue.picture);
      expect(pictureRefs(pack)).toEqual([
        {
          path:
            kind === "clue" ? "categories[0].clues[0].picture" : "categories[0].finalClue.picture",
          id,
        },
      ]);
      expect(pictureSrc(id)).toBe(`/api/pictures/${id}`);
      clue.picture.alt = "a".repeat(200);
      expect(validateQuestionPack(pack).ok).toBe(true);
    },
  );
  it.each([
    [null, "", "A picture needs an id and a description."],
    [[], "", "A picture needs an id and a description."],
    [
      { id: "bad", alt: "" },
      "",
      "This picture reference isn't valid. Remove the picture and add it again.",
    ],
    [{ id, alt: "", src: "/x" }, "", 'Unknown picture field "src".'],
    [{ id }, ".alt", "Expected a string."],
    [{ id, alt: 1 }, ".alt", "Expected a string."],
    [{ id, alt: "a".repeat(201) }, ".alt", "Must be at most 200 characters."],
  ])("rejects malformed pictures %# on ordinary and final clues", (picture, suffix, message) => {
    const pack = sample();
    for (const [clue, path] of [
      [pack.categories[0].clues[0], "categories[0].clues[0]"],
      [pack.categories[0].finalClue, "categories[0].finalClue"],
    ] as const) {
      const raw: Record<string, unknown> = clue;
      raw.picture = picture;
      expect(errorsFor(pack)).toContainEqual({ path: `${path}.picture${suffix}`, message });
    }
  });
  it.each([
    null,
    1,
    "a".repeat(43),
    `pic_${"a".repeat(42)}`,
    `pic_${"a".repeat(44)}`,
    `pic_${"a".repeat(42)}!`,
  ])("rejects invalid id %s", (value) => {
    expect(parsePictureId(value)).toBeNull();
  });
});
