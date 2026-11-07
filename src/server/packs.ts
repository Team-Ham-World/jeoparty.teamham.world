import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseQuestionPackJson, type QuestionPack } from "@/features/content";
import type { PackDocument, PackSummary } from "@/features/network/protocol";
import type { SqlDatabase } from "./storage";
import { HttpError } from "./http";

export function validatedPack(raw: unknown): QuestionPack {
  const result = parseQuestionPackJson(JSON.stringify(raw));
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
    const summarize = (
      id: string,
      pack: QuestionPack,
      source: PackSummary["source"],
      updatedAt: string | null,
    ): PackSummary => ({
      id,
      title: pack.title,
      description: pack.description ?? null,
      categories: pack.dimensions.categories,
      cluesPerCategory: pack.dimensions.cluesPerCategory,
      source,
      updatedAt,
    });
    return [
      ...[...this.builtIns].map(([id, pack]) =>
        summarize(id, pack, "builtIn", null),
      ),
      ...this.db
        .all<{
          id: string;
        }>("SELECT id FROM packs WHERE owner_id = ? ORDER BY updated_at DESC", ownerId)
        .map(({ id }) => {
          const doc = this.document(id, ownerId);
          return summarize(id, doc.pack, "mine", doc.updatedAt);
        }),
    ];
  }
  save(raw: unknown, ownerId: string, existingId?: string): PackDocument {
    if (existingId) this.document(existingId, ownerId);
    const id = existingId ?? randomUUID();
    if (this.builtIns.has(id))
      throw new HttpError(409, "conflict", "Built-in ids are reserved.");
    const pack = validatedPack({ ...validatedPack(raw), id });
    const updatedAt = new Date().toISOString();
    this.db.run(
      "INSERT INTO packs(id, owner_id, pack_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET pack_json = excluded.pack_json, updated_at = excluded.updated_at",
      id,
      ownerId,
      JSON.stringify(pack),
      updatedAt,
    );
    return { id, pack, updatedAt };
  }
  delete(id: string, ownerId: string): void {
    this.document(id, ownerId);
    this.db.run("DELETE FROM packs WHERE id = ? AND owner_id = ?", id, ownerId);
  }
}
