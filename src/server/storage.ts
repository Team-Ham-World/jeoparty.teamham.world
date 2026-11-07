export type SqlParam = string | number | bigint | null | Uint8Array;
export interface SqlDatabase {
  exec(sql: string): void;
  get<T>(sql: string, ...params: SqlParam[]): T | undefined;
  all<T>(sql: string, ...params: SqlParam[]): T[];
  run(sql: string, ...params: SqlParam[]): { changes: number };
  transaction<T>(fn: () => T): T;
}
// Append migrations after release; never change an applied migration.
export const MIGRATIONS = [
  {
    version: 1,
    sql: `
CREATE TABLE accounts (
 account_id TEXT PRIMARY KEY, issuer TEXT NOT NULL, client_id TEXT NOT NULL,
 subject TEXT NOT NULL, username TEXT, public_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(issuer, client_id, subject)
);
CREATE TABLE sessions (
 session_hash TEXT PRIMARY KEY, csrf_token TEXT NOT NULL, account_id TEXT REFERENCES accounts(account_id),
 token_enc BLOB, token_exp INTEGER, verified_at INTEGER, created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER, revoked_reason TEXT
);
CREATE INDEX sessions_by_account ON sessions(account_id);
CREATE TABLE oauth_attempts (
 state_hash TEXT PRIMARY KEY, session_hash TEXT NOT NULL, verifier_enc BLOB NOT NULL,
 return_to TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX oauth_attempts_by_session ON oauth_attempts(session_hash);
CREATE TABLE rooms (
 code TEXT PRIMARY KEY, host_id TEXT NOT NULL, state_json TEXT NOT NULL, recent_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL, display_key_hash TEXT, display_generation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE display_grants (
 grant_hash TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 generation INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE packs (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(account_id),
 pack_json TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX packs_by_owner ON packs(owner_id);
`,
  },
];
