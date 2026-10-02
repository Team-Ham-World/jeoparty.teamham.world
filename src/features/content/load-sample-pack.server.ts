import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQuestionPackJson } from "./index";
import type { ValidationResult } from "./types";

/** filePath is developer-controlled, never a player-supplied path. */
export async function loadSamplePack(
  filePath = join(process.cwd(), "src/features/content/samples/sample-pack-3x3.json"),
): Promise<ValidationResult> {
  return parseQuestionPackJson(await readFile(filePath, "utf8"));
}
