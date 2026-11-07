import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseQuestionPackJson, type QuestionPack } from "@/features/content";
import type { PackDocument, PackSummary } from "@/features/network/protocol";
import type { SqlDatabase } from "./storage";
import { HttpError } from "./http";

const MAX_PACK_BYTES = 256 * 1024;
const MAX_PACKS_PER_ACCOUNT = 50;
function serializePack(raw: unknown): string {
  const json = JSON.stringify(raw);
  if (Buffer.byteLength(json) > MAX_PACK_BYTES)
    throw new HttpError(413, "badRequest", "Packs must be at most 256 KiB.");
  return json;
}
function summarize(pack: QuestionPack) {
  return {
    title: pack.title,
    description: pack.description ?? null,
    categories: pack.dimensions.categories,
    cluesPerCategory: pack.dimensions.cluesPerCategory,
  };
}
export function validatedPack(raw: unknown): QuestionPack {
  const result = parseQuestionPackJson(serializePack(raw));
  if (!result.ok)
    throw new HttpError(400, "invalidPack", "The pack is invalid.", {
      validationErrors: result.errors,
    });
  return result.data;
}
export class Packs {
  readonly builtIns = new Map<string, QuestionPack>();
  constructor(
    private db: SqlDatabase,
    directory = path.resolve("src/features/content/samples"),
  ) {
    for (const file of readdirSync(directory)
      .sort()
      .filter((file) => file.endsWith(".json"))) {
      const result = parseQuestionPackJson(
        readFileSync(path.join(directory, file), "utf8"),
      );
      if (!result.ok) throw new Error(`Invalid built-in pack: ${file}`);
      if (this.builtIns.has(result.data.id))
        throw new Error("Duplicate built-in pack id");
      this.builtIns.set(result.data.id, result.data);
    }
    // Backfill once on upgrade. Listing never parses answer-bearing documents.
    this.db.run(`UPDATE packs SET summary_json = json_object(
      'title', json_extract(pack_json, '$.title'),
      'description', json_extract(pack_json, '$.description'),
      'categories', json_extract(pack_json, '$.dimensions.categories'),
      'cluesPerCategory', json_extract(pack_json, '$.dimensions.cluesPerCategory')
    ) WHERE summary_json IS NULL`);
    if (!this.builtIns.size) throw new Error("No built-in packs found");
  }
  document(id: string, ownerId: string): PackDocument {
    const row = this.db.get<{ pack_json: string; updated_at: string }>(
      "SELECT pack_json, updated_at FROM packs WHERE id = ? AND owner_id = ?",
      id,
      ownerId,
    );
    if (!row) throw new HttpError(404, "notFound", "Pack not found.");
    return {
      id,
      pack: validatedPack(JSON.parse(row.pack_json)),
      updatedAt: row.updated_at,
    };
  }
  resolve(id: string | undefined, ownerId: string): QuestionPack {
    const selected = id ?? this.builtIns.keys().next().value;
    if (!selected) throw new HttpError(404, "notFound", "Pack not found.");
    return structuredClone(
      this.builtIns.get(selected) ?? this.document(selected, ownerId).pack,
    );
  }
  list(ownerId: string): PackSummary[] {
    return [
      ...[...this.builtIns].map(([id, pack]): PackSummary => ({
        id,
        ...summarize(pack),
        source: "builtIn",
        updatedAt: null,
      })),
      ...this.db
        .all<{ id: string; summary_json: string; updated_at: string }>(
          "SELECT id, summary_json, updated_at FROM packs WHERE owner_id = ? ORDER BY updated_at DESC",
          ownerId,
        )
        .map((row): PackSummary => ({
          ...JSON.parse(row.summary_json),
          id: row.id,
          source: "mine",
          updatedAt: row.updated_at,
        })),
    ];
  }

  /** Copy a built-in or own pack into the owner's packs, marking the title as a copy. */
  duplicate(id: string, ownerId: string): PackDocument {
    const source = this.resolve(id, ownerId);
    const title = `${source.title} (copy)`.slice(0, 120);
    return this.save({ ...source, title }, ownerId);
  }

  save(raw: unknown, ownerId: string, existingId?: string): PackDocument {
    if (
      existingId &&
      !this.db.get(
        "SELECT 1 FROM packs WHERE id = ? AND owner_id = ?",
        existingId,
        ownerId,
      )
    )
      throw new HttpError(404, "notFound", "Pack not found.");
    if (
      !existingId &&
      this.db.get<{ n: number }>(
        "SELECT count(*) n FROM packs WHERE owner_id = ?",
        ownerId,
      )!.n >= MAX_PACKS_PER_ACCOUNT
    )
      throw new HttpError(
        409,
        "conflict",
        "An account can save at most 50 packs. Delete a pack first.",
      );
    const id = existingId ?? randomUUID();
    if (this.builtIns.has(id))
      throw new HttpError(409, "conflict", "Built-in ids are reserved.");
    const pack = validatedPack({ ...validatedPack(raw), id });
    const updatedAt = new Date().toISOString();
    this.db.run(
      "INSERT INTO packs(id, owner_id, pack_json, updated_at, summary_json) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET pack_json = excluded.pack_json, updated_at = excluded.updated_at, summary_json = excluded.summary_json",
      id,
      ownerId,
      serializePack(pack),
      updatedAt,
      JSON.stringify(summarize(pack)),
    );
    return { id, pack, updatedAt };
  }
  delete(id: string, ownerId: string): void {
    const deleted = this.db.run(
      "DELETE FROM packs WHERE id = ? AND owner_id = ?",
      id,
      ownerId,
    );
    if (!deleted.changes)
      throw new HttpError(404, "notFound", "Pack not found.");
  }
}
