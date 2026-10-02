import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseQuestionPackJson } from "./index";
import { loadSamplePack } from "./load-sample-pack.server";

// Vitest has no Next compiler alias. This mock allows filesystem logic tests;
// verify-server-boundary.mjs separately checks real Next enforcement without it.
vi.mock("server-only", () => ({}));

const sampleJson = await readFile(new URL("./samples/sample-pack-3x3.json", import.meta.url), "utf8");
let directory = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "jeoparty-content-loader-"));
});

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("loadSamplePack filesystem behavior", () => {
  it("loads and validates the default 3x3 sample", async () => {
    const result = await loadSamplePack();

    expect(result).toEqual(parseQuestionPackJson(sampleJson));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.data.dimensions).toEqual({ categories: 3, cluesPerCategory: 3 });
    expect(result.data.categories.flatMap((category) => category.clues)).toHaveLength(9);
    expect(result.data.categories.map((category) => category.finalJeoparty)).toHaveLength(3);
  });

  it("reads a developer-controlled file path using the same parser", async () => {
    const filePath = join(directory, "sample.json");
    await writeFile(filePath, sampleJson);

    expect(await loadSamplePack(filePath)).toEqual(parseQuestionPackJson(sampleJson));
  });

  it("returns independent objects and rereads changes without a cache", async () => {
    const filePath = join(directory, "changing-sample.json");
    await writeFile(filePath, sampleJson);
    const first = await loadSamplePack(filePath);
    const second = await loadSamplePack(filePath);
    if (!first.ok || !second.ok) throw new Error("Expected valid sample loads.");

    expect(first.data).not.toBe(second.data);
    expect(first.data.categories[0].clues[0]).not.toBe(second.data.categories[0].clues[0]);
    first.data.categories[0].clues[0].answer = "Changed in memory only";
    expect(second).toEqual(parseQuestionPackJson(sampleJson));
    expect(await readFile(filePath, "utf8")).toBe(sampleJson);

    second.data.title = "Updated developer sample";
    const updatedJson = JSON.stringify(second.data);
    await writeFile(filePath, updatedJson);
    const third = await loadSamplePack(filePath);
    expect(third).toEqual(parseQuestionPackJson(updatedJson));
    if (!third.ok) throw new Error(JSON.stringify(third.errors));
    expect(third.data.title).toBe("Updated developer sample");
  });

  it("returns the existing root error for invalid JSON", async () => {
    const filePath = join(directory, "invalid-json.json");
    await writeFile(filePath, "{");

    expect(await loadSamplePack(filePath)).toEqual({
      ok: false,
      errors: [{ path: "$", message: "Invalid JSON syntax. Supply a complete JSON document." }],
    });
  });

  it("returns existing schema and indexed field errors for invalid content", async () => {
    const parsed = parseQuestionPackJson(sampleJson);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    parsed.data.categories[1].clues[2].prompt = " ";
    const invalidJson = JSON.stringify({ ...parsed.data, schemaVersion: "1.0.0" });
    const filePath = join(directory, "invalid-content.json");
    await writeFile(filePath, invalidJson);
    const result = await loadSamplePack(filePath);

    expect(result).toEqual(parseQuestionPackJson(invalidJson));
    if (result.ok) throw new Error("Expected invalid content to fail validation.");
    expect(result.errors).toEqual([
      { path: "schemaVersion", message: 'Expected schema version "2.0.0".' },
      { path: "categories[1].clues[2].prompt", message: "Expected a non-empty string." },
    ]);
  });

  it("rejects filesystem failures rather than inventing an empty pack", async () => {
    const filePath = join(directory, "missing.json");

    await expect(loadSamplePack(filePath)).rejects.toMatchObject({
      code: "ENOENT",
      syscall: "open",
      path: filePath,
    });
  });
});
