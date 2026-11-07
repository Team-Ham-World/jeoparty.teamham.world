/**
 * Pure helpers for editing a QuestionPack: create blank parts, move and
 * remove items, and keep `dimensions` in sync. Every helper returns a new
 * pack and never mutates its input.
 */
import type { Category, Clue, DifficultyTier, QuestionPack, ScoringRound, ValidationError } from "@/features/content";
import { PACK_SCHEMA_VERSION, finalClueOf, withFinalClue } from "./pack-fields";

export const TIERS: DifficultyTier[] = [1, 2, 3, 4, 5];

/** Random id that also works on plain-http LAN addresses (no randomUUID there). */
export function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function blankClue(tier: DifficultyTier): Clue {
  return { id: newId(), tier, type: "text", prompt: "", answer: "" };
}

export function blankCategory(cluesPerCategory = 5): Category {
  const base = {
    id: newId(),
    title: "",
    clues: Array.from({ length: cluesPerCategory }, (_, i) => blankClue(TIERS[Math.min(i, 4)])),
  };
  return withFinalClue(base as Category, { id: newId(), tier: "final", type: "text", prompt: "", answer: "" });
}

export function blankRound(title: string, multiplier = 1): ScoringRound {
  return {
    id: newId(),
    title,
    pointsByTier: { 1: 200 * multiplier, 2: 400 * multiplier, 3: 600 * multiplier, 4: 800 * multiplier, 5: 1000 * multiplier },
  };
}

export function blankPack(): QuestionPack {
  const round = blankRound("Round 1");
  return syncDimensions({
    schemaVersion: PACK_SCHEMA_VERSION,
    id: newId(),
    title: "",
    description: "",
    custom: true,
    dimensions: { categories: 1, cluesPerCategory: 5 },
    scoring: { defaultRoundId: round.id, rounds: [round] },
    categories: [blankCategory()],
  });
}

/** `dimensions` follows the content: category count, and the first category's clue count. */
export function syncDimensions(pack: QuestionPack): QuestionPack {
  return {
    ...pack,
    dimensions: {
      categories: pack.categories.length,
      cluesPerCategory: pack.categories[0]?.clues.length ?? 0,
    },
  };
}

/** What gets saved: dimensions synced, empty optional description dropped. */
export function packForSave(pack: QuestionPack): QuestionPack {
  const synced = syncDimensions(pack);
  if (synced.description !== undefined && synced.description.trim() === "") {
    const rest = { ...synced };
    delete rest.description;
    return rest;
  }
  return synced;
}

export function move<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((existing, i) => (i === index ? item : existing));
}

export function updateCategory(pack: QuestionPack, index: number, update: (category: Category) => Category): QuestionPack {
  return { ...pack, categories: replaceAt(pack.categories, index, update(pack.categories[index])) };
}

export function updateClue(pack: QuestionPack, categoryIndex: number, clueIndex: number, patch: Partial<Clue>): QuestionPack {
  return updateCategory(pack, categoryIndex, (category) => ({
    ...category,
    clues: replaceAt(category.clues, clueIndex, { ...category.clues[clueIndex], ...patch }),
  }));
}

export function updateFinal(pack: QuestionPack, categoryIndex: number, patch: { prompt?: string; answer?: string }): QuestionPack {
  return updateCategory(pack, categoryIndex, (category) => withFinalClue(category, { ...finalClueOf(category), ...patch }));
}

/**
 * The shared validator speaks in schema terms ("Expected a non-empty
 * string."). Translate the common ones into what a pack author would say;
 * anything else passes through unchanged.
 */
export function friendlyMessage(message: string): string {
  if (message === "Expected a non-empty string.") return "Can't be empty.";
  if (message === "Expected a positive safe integer.") return "Use a whole number above 0.";
  if (message === "Expected an integer tier between 1 and 5.") return "Pick a tier from 1 to 5.";
  const clues = /^Expected (\d+) clues from dimensions\.cluesPerCategory, but found (\d+)\.$/.exec(message);
  if (clues) return `Every category needs the same number of clues as the first one (${clues[1]}); this one has ${clues[2]}.`;
  return message;
}

/** Index validation errors by path for quick field lookup. */
export function errorsByPath(errors: readonly ValidationError[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const error of errors) if (!map.has(error.path)) map.set(error.path, friendlyMessage(error.message));
  return map;
}

/** Stable DOM id for the input that edits `path` (so error links can focus it). */
export function fieldId(path: string): string {
  return `f-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

/** Plain-language label for a validator path, used in the error summary. */
export function describePath(path: string, pack: QuestionPack, finalField: string): string {
  if (path === "$") return "Pack";
  if (path === "title") return "Pack title";
  if (path === "description") return "Description";
  const cat = /^categories\[(\d+)\](.*)$/.exec(path);
  if (cat) {
    const i = Number(cat[1]);
    const name = pack.categories[i]?.title.trim() || `Category ${i + 1}`;
    const rest = cat[2];
    const clue = /^\.clues\[(\d+)\]\.?(\w*)/.exec(rest);
    if (clue) return `${name} · clue ${Number(clue[1]) + 1}${clue[2] ? ` ${clue[2]}` : ""}`;
    if (rest.startsWith(`.${finalField}`)) return `${name} · final clue ${rest.split(".").pop() ?? ""}`;
    if (rest === ".clues") return `${name} · clues`;
    if (rest === ".title") return `${name} · title`;
    return name;
  }
  const round = /^scoring\.rounds\[(\d+)\]\.?(.*)$/.exec(path);
  if (round) return `Scoring round ${Number(round[1]) + 1}${round[2] ? ` · ${round[2].replace("pointsByTier.", "tier ")}` : ""}`;
  if (path.startsWith("dimensions")) return "Board size";
  return path;
}
