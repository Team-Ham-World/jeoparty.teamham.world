import { createHash } from "node:crypto";
import { parsePictureId, type PictureId } from "@/features/content";
import { randomToken } from "./crypto";
import { HttpError } from "./http";
import type { SqlDatabase } from "./storage";

export class Pictures {
  constructor(
    private db: SqlDatabase,
    private now: () => number,
    private limits = { maxAccountBytes: 100 * 1024 * 1024, graceMs: 7 * 24 * 3_600_000 },
  ) {}

  add(ownerId: string, contentType: string | undefined, bytes: Uint8Array): PictureId {
    if (bytes.length === 0) throw new HttpError(400, "badRequest", "The picture is empty.");
    if (contentType !== "image/jpeg" || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
      throw new HttpError(415, "badRequest", "Pictures must be JPEG files.");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    return this.db.transaction(() => {
      const existing = this.db.get<{ id: string }>(
        "SELECT id FROM pictures WHERE owner_id = ? AND sha256 = ?",
        ownerId,
        sha256,
      );
      if (existing) {
        this.db.run("UPDATE pictures SET created_at = ? WHERE id = ?", this.now(), existing.id);
        return parsePictureId(existing.id)!;
      }
      const used = this.db.get<{ n: number }>(
        "SELECT coalesce(sum(length(bytes)), 0) n FROM pictures WHERE owner_id = ?",
        ownerId,
      )!.n;
      if (used + bytes.length > this.limits.maxAccountBytes)
        throw new HttpError(
          409,
          "conflict",
          "Your account can store at most 100 MiB of pictures. Remove pictures from packs you no longer use; unused pictures are cleared after 7 days.",
        );
      const id = parsePictureId(`pic_${randomToken(32)}`)!;
      this.db.run(
        "INSERT INTO pictures(id, owner_id, sha256, bytes, created_at) VALUES (?, ?, ?, ?, ?)",
        id,
        ownerId,
        sha256,
        bytes,
        this.now(),
      );
      return id;
    });
  }

  bytes(id: PictureId): Uint8Array | null {
    return (
      this.db.get<{ bytes: Uint8Array }>("SELECT bytes FROM pictures WHERE id = ?", id)?.bytes ??
      null
    );
  }

  ownedIds(ownerId: string): Set<string> {
    return new Set(
      this.db
        .all<{ id: string }>("SELECT id FROM pictures WHERE owner_id = ?", ownerId)
        .map((row) => row.id),
    );
  }

  sweep(): number {
    return this.db.transaction(() => {
      const refs = new Set<string>();
      function visit(value: unknown): void {
        if (typeof value === "string") {
          const id = parsePictureId(value);
          if (id) refs.add(id);
        } else if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (value && typeof value === "object") {
          Object.values(value).forEach(visit);
        }
      }
      for (const row of this.db.all<{ text: string }>(
        "SELECT pack_json AS text FROM packs UNION ALL SELECT state_json FROM rooms UNION ALL SELECT state_json FROM quarantined_rooms",
      )) {
        let value: unknown;
        try {
          value = JSON.parse(row.text);
        } catch {
          for (const match of row.text.matchAll(/pic_[A-Za-z0-9_-]{43}/g)) refs.add(match[0]);
          continue;
        }
        visit(value);
      }
      let deleted = 0;
      for (const { id } of this.db.all<{ id: string }>(
        "SELECT id FROM pictures WHERE created_at < ?",
        this.now() - this.limits.graceMs,
      )) {
        if (!refs.has(id)) deleted += this.db.run("DELETE FROM pictures WHERE id = ?", id).changes;
      }
      return deleted;
    });
  }
}
