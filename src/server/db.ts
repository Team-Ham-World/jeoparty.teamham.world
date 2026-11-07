import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { MIGRATIONS, type SqlDatabase, type SqlParam } from "./storage.js";
export type { SqlParam } from "./storage.js";

export class Database implements SqlDatabase {
  readonly raw: DatabaseSync;
  private readonly cache = new Map<string, StatementSync>();

  constructor(file: string) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec(
      "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
    );
    this.migrate();
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  private migrate(): void {
    this.raw.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)",
    );
    const applied = new Set(
      (
        this.raw.prepare("SELECT version FROM schema_migrations").all() as {
          version: number;
        }[]
      ).map((r) => r.version),
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.transaction(() => {
        this.raw.exec(migration.sql);
        this.raw
          .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(migration.version, Date.now());
      });
    }
  }

  /** Cached prepared statement. The cache is bounded by the fixed set of SQL strings in this codebase. */
  stmt(sql: string): StatementSync {
    let statement = this.cache.get(sql);
    if (!statement) {
      statement = this.raw.prepare(sql);
      this.cache.set(sql, statement);
    }
    return statement;
  }

  get<T>(sql: string, ...params: SqlParam[]): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, ...params: SqlParam[]): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  run(sql: string, ...params: SqlParam[]): { changes: number } {
    const result = this.stmt(sql).run(...params);
    return { changes: Number(result.changes) };
  }

  /** Synchronous, atomic transaction. Rolls back on any thrown error. */
  transaction<T>(fn: () => T): T {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.raw.exec("COMMIT");
      return result;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.raw.close();
  }
}
