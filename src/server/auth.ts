import { isSafeReturnPath } from "./validation";
import type { Config } from "./config.js";
import { decrypt, encrypt, pkceChallenge, randomToken, sha256Hex } from "./crypto.js";
import type { SqlDatabase } from "./storage.js";
import { HAM_CODE_PATTERN, type HamClient } from "./ham/client.js";
import { parseCookies } from "./http.js";

export const SESSION_COOKIE = "__Host-quiz_session";
const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;
const ANON_SESSION_MS = 30 * 60_000;
const MAX_SESSION_MS = 24 * 3_600_000;
/** Cached verification during connected play: at most 30 seconds or token expiry. */
export const LEASE_MS = 30_000;
const ATTEMPT_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS_PER_SESSION = 5;

export interface SessionRow {
  session_hash: string;
  csrf_token: string;
  account_id: string | null;
  token_enc: Uint8Array | null;
  token_exp: number | null;
  verified_at: number | null;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
  revoked_reason: string | null;
}

export interface Account {
  account_id: string;
  issuer: string;
  client_id: string;
  subject: string;
  username: string | null;
  public_id: string;
}

export interface Identity {
  sessionHash: string;
  csrf: string;
  account: Account;
  displayName: string;
}

export type VerifyResult =
  | { status: "active"; until: number }
  | { status: "inactive" }
  | { status: "revoked" }
  | { status: "unavailable" };

export type CallbackError =
  "denied" | "state" | "issuer" | "invalid" | "expired" | "unavailable" | "duplicate";

/** A stable, friendly label when HAM returns no username. */
export function displayNameFor(account: Pick<Account, "username" | "public_id">): string {
  if (account.username) return account.username.slice(0, 32);
  return `Player ${account.public_id.slice(-4).toUpperCase()}`;
}

export function sessionCookie(config: Config, sessionId: string, maxAgeMs: number): string {
  return `${config.publicOrigin.startsWith("https:") ? SESSION_COOKIE : "quiz_session"}=${sessionId}; Path=/; ${config.publicOrigin.startsWith("https:") ? "Secure; " : ""}HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`;
}

export const clearedSessionCookie = (config: Config): string =>
  `${config.publicOrigin.startsWith("https:") ? SESSION_COOKIE : "quiz_session"}=; Path=/; ${config.publicOrigin.startsWith("https:") ? "Secure; " : ""}HttpOnly; SameSite=Lax; Max-Age=0`;

export interface AuthHooks {
  /** A session was revoked (logout, superseded login, provider inactive). Close its sockets. */
  onSessionEnded(sessionHash: string, reason: string): void;
}

export class AuthService {
  private readonly inflight = new Map<string, Promise<VerifyResult>>();

  constructor(
    private readonly db: SqlDatabase,
    private readonly config: Config,
    private readonly ham: HamClient | null,
    private readonly hooks: AuthHooks,
    private readonly now: () => number = Date.now,
  ) {}

  get available(): boolean {
    return this.ham !== null;
  }

  /** Resolve the session cookie. Duplicate or malformed cookies resolve to no session. */
  sessionFromCookieHeader(header: string | undefined): SessionRow | null {
    const values = parseCookies(header).get(
      this.config.publicOrigin.startsWith("https:") ? SESSION_COOKIE : "quiz_session",
    );
    if (!values || values.length !== 1 || !SESSION_ID.test(values[0]!)) return null;
    const row = this.db.get<SessionRow>(
      "SELECT * FROM sessions WHERE session_hash = ?",
      sha256Hex(values[0]!),
    );
    if (!row || row.revoked_at !== null || row.expires_at <= this.now()) return null;
    return row;
  }

  revokedReasonFromCookieHeader(header: string | undefined): string | null {
    const values = parseCookies(header).get(
      this.config.publicOrigin.startsWith("https:") ? SESSION_COOKIE : "quiz_session",
    );
    if (!values || values.length !== 1 || !SESSION_ID.test(values[0]!)) return null;
    const row = this.db.get<SessionRow>(
      "SELECT * FROM sessions WHERE session_hash = ?",
      sha256Hex(values[0]!),
    );
    if (!row) return null;
    if (row.revoked_at !== null) return row.revoked_reason ?? "revoked";
    if (row.expires_at <= this.now() && row.account_id) return "expired";
    return null;
  }

  identityFor(session: SessionRow | null): Identity | null {
    if (!session?.account_id) return null;
    const account = this.db.get<Account>(
      "SELECT * FROM accounts WHERE account_id = ?",
      session.account_id,
    );
    if (!account) return null;
    return {
      sessionHash: session.session_hash,
      csrf: session.csrf_token,
      account,
      displayName: displayNameFor(account),
    };
  }

  private createSession(
    accountId: string | null,
    expiresAt: number,
    token?: { value: string; exp: number },
  ): { id: string; row: SessionRow } {
    const id = randomToken(32);
    const hash = sha256Hex(id);
    const now = this.now();
    this.db.run(
      `INSERT INTO sessions (session_hash, csrf_token, account_id, token_enc, token_exp, verified_at, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      hash,
      randomToken(24),
      accountId,
      token ? encrypt(this.config.encryptionKey, token.value, `token:${hash}`) : null,
      token?.exp ?? null,
      token ? now : null,
      now,
      expiresAt,
    );
    return {
      id,
      row: this.db.get<SessionRow>("SELECT * FROM sessions WHERE session_hash = ?", hash)!,
    };
  }

  /**
   * Begin an authorization attempt bound to this browser's server-side session.
   * Returns the HAM authorize URL and, when a session had to be created, its cookie.
   */
  startLogin(
    existing: SessionRow | null,
    returnTo: string,
  ): { location: string; setCookie: string | null } {
    if (!this.ham) throw new Error("Sign-in is not configured");
    let session = existing;
    let setCookie: string | null = null;
    if (!session) {
      const created = this.createSession(null, this.now() + ANON_SESSION_MS);
      session = created.row;
      setCookie = sessionCookie(this.config, created.id, ANON_SESSION_MS);
    }
    const state = randomToken(32);
    const verifier = randomToken(32);
    const stateHash = sha256Hex(state);
    const target = isSafeReturnPath(returnTo) ? returnTo : "/";
    this.db.transaction(() => {
      this.db.run("DELETE FROM oauth_attempts WHERE created_at < ?", this.now() - ATTEMPT_TTL_MS);
      const attempts = this.db.all<{ state_hash: string }>(
        "SELECT state_hash FROM oauth_attempts WHERE session_hash = ? ORDER BY created_at DESC",
        session.session_hash,
      );
      for (const old of attempts.slice(MAX_ATTEMPTS_PER_SESSION - 1)) {
        this.db.run("DELETE FROM oauth_attempts WHERE state_hash = ?", old.state_hash);
      }
      this.db.run(
        "INSERT INTO oauth_attempts (state_hash, session_hash, verifier_enc, return_to, created_at) VALUES (?, ?, ?, ?, ?)",
        stateHash,
        session.session_hash,
        encrypt(this.config.encryptionKey, verifier, `pkce:${stateHash}`),
        target,
        this.now(),
      );
    });
    return {
      location: this.ham.authorizeUrl({
        state,
        codeChallenge: pkceChallenge(verifier),
      }),
      setCookie,
    };
  }

  /**
   * Complete the callback. Always consumes the attempt once; never retries the
   * code exchange. On success, rotates to a fresh authenticated session.
   */
  async handleCallback(
    query: URLSearchParams,
    session: SessionRow | null,
  ): Promise<
    | { ok: true; setCookie: string; returnTo: string }
    | { ok: false; error: CallbackError; returnTo: string }
  > {
    // A recognized state may identify the destination even in the wrong browser.
    // It never authenticates that browser or consumes the real browser's attempt.
    const state = query.getAll("state").length === 1 ? query.get("state") : null;
    const destination =
      state && /^[A-Za-z0-9_-]{43}$/.test(state)
        ? this.db.get<{ return_to: string }>(
            "SELECT return_to FROM oauth_attempts WHERE state_hash = ?",
            sha256Hex(state),
          )
        : null;
    const browserDestination = session
      ? this.db.get<{ return_to: string }>(
          "SELECT return_to FROM oauth_attempts WHERE session_hash = ? ORDER BY created_at DESC LIMIT 1",
          session.session_hash,
        )
      : null;
    const intended = destination?.return_to ?? browserDestination?.return_to ?? "/";
    const fallback =
      isSafeReturnPath(intended) && /^\/r\/[A-Za-z0-9]{5}\/?(?:[?#]|$)/.test(intended)
        ? intended
        : "/";
    const fail = (error: CallbackError, returnTo = fallback) => ({
      ok: false as const,
      error,
      returnTo,
    });
    if (!this.ham || !this.config.ham) return fail("unavailable");
    for (const key of new Set(query.keys())) {
      if (query.getAll(key).length > 1) return fail("duplicate");
    }
    if (!session || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)) return fail("state");

    const stateHash = sha256Hex(state);
    const attempt = this.db.transaction(() => {
      const row = this.db.get<{
        session_hash: string;
        verifier_enc: Uint8Array;
        return_to: string;
        created_at: number;
      }>(
        "SELECT session_hash, verifier_enc, return_to, created_at FROM oauth_attempts WHERE state_hash = ?",
        stateHash,
      );
      if (!row || row.session_hash !== session.session_hash) return null;
      this.db.run("DELETE FROM oauth_attempts WHERE state_hash = ?", stateHash);
      return row;
    });
    if (!attempt) return fail("state");
    const returnTo = isSafeReturnPath(attempt.return_to) ? attempt.return_to : "/";
    if (attempt.created_at + ATTEMPT_TTL_MS < this.now()) return fail("expired", returnTo);
    if (query.get("iss") !== this.config.ham.issuer) return fail("issuer", returnTo);
    if (query.has("error")) return fail("denied", returnTo);
    const code = query.get("code");
    if (!code || !HAM_CODE_PATTERN.test(code)) return fail("invalid", returnTo);
    const verifier = decrypt(this.config.encryptionKey, attempt.verifier_enc, `pkce:${stateHash}`);
    if (!verifier) return fail("invalid", returnTo);

    const exchanged = await this.ham.exchangeCode(code, verifier);
    if (exchanged.kind === "invalidGrant") return fail("expired", returnTo);
    if (exchanged.kind === "unavailable") return fail("unavailable", returnTo);

    let accepted = false;
    try {
      const info = await this.ham.introspect(exchanged.token);
      if (info.kind !== "active")
        return fail(info.kind === "inactive" ? "expired" : "unavailable", returnTo);
      if (info.sub !== exchanged.sub) return fail("invalid", returnTo);

      const now = this.now();
      const tokenExp = Math.min(
        info.expSeconds * 1000,
        now + exchanged.expiresIn * 1000,
        now + MAX_SESSION_MS,
      );
      const stillBound = this.db.get<SessionRow>(
        "SELECT * FROM sessions WHERE session_hash = ?",
        session.session_hash,
      );
      if (!stillBound || stillBound.revoked_at !== null || stillBound.expires_at <= now)
        return fail("state", returnTo);
      const { id, superseded } = this.db.transaction(() => {
        const ham = this.config.ham!;
        let account = this.db.get<Account>(
          "SELECT * FROM accounts WHERE issuer = ? AND client_id = ? AND subject = ?",
          ham.issuer,
          ham.clientId,
          info.sub,
        );
        if (!account) {
          const accountId = `a_${randomToken(16)}`;
          this.db.run(
            `INSERT INTO accounts (account_id, issuer, client_id, subject, username, public_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            accountId,
            ham.issuer,
            ham.clientId,
            info.sub,
            info.username,
            `p_${randomToken(9)}`,
            now,
            now,
          );
          account = this.db.get<Account>("SELECT * FROM accounts WHERE account_id = ?", accountId)!;
        } else {
          this.db.run(
            "UPDATE accounts SET username = ?, updated_at = ? WHERE account_id = ?",
            info.username,
            now,
            account.account_id,
          );
        }
        // HAM keeps one live token per account/client, so older sessions are now dead upstream.
        const others = this.db.all<{ session_hash: string }>(
          "SELECT session_hash FROM sessions WHERE account_id = ? AND revoked_at IS NULL",
          account.account_id,
        );
        this.db.run(
          "UPDATE sessions SET revoked_at = ?, revoked_reason = 'superseded' WHERE account_id = ? AND revoked_at IS NULL",
          now,
          account.account_id,
        );
        // Rotate the browser session (fixation defence); the pre-login session is retired.
        this.db.run(
          "DELETE FROM sessions WHERE session_hash = ? AND account_id IS NULL",
          session.session_hash,
        );
        this.db.run(
          "UPDATE sessions SET revoked_at = ?, revoked_reason = 'rotated' WHERE session_hash = ? AND revoked_at IS NULL",
          now,
          session.session_hash,
        );
        const created = this.createSession(account.account_id, tokenExp, {
          value: exchanged.token,
          exp: tokenExp,
        });
        // Signing in as someone else ends the old account's session in this browser too.
        const replacedAccount =
          session.account_id && session.account_id !== account.account_id
            ? [session.session_hash]
            : [];
        return {
          id: created.id,
          superseded: [...others.map((o) => o.session_hash), ...replacedAccount],
        };
      });
      for (const hash of superseded) this.hooks.onSessionEnded(hash, "superseded");
      accepted = true;
      return {
        ok: true,
        setCookie: sessionCookie(this.config, id, tokenExp - now),
        returnTo,
      };
    } finally {
      // A token issued to an interrupted/failed callback must not be left live.
      if (!accepted) await this.ham.revoke(exchanged.token).catch(() => undefined);
    }
  }

  private token(row: SessionRow): string | null {
    if (!row.token_enc) return null;
    return decrypt(this.config.encryptionKey, row.token_enc, `token:${row.session_hash}`);
  }

  /**
   * Verify an authenticated session. Reuses a verification for at most 30
   * seconds (or token expiry). `fresh` forces introspection (every protected HTTP request,
   * socket connection and game start). Provider outages never extend authorization.
   */
  verify(sessionHash: string, options: { fresh?: boolean } = {}): Promise<VerifyResult> {
    const key = `${sessionHash}:${options.fresh ? "f" : "c"}`;
    const running = this.inflight.get(key);
    if (running) return running;
    const promise = this.verifyNow(sessionHash, options).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private async verifyNow(
    sessionHash: string,
    options: { fresh?: boolean },
  ): Promise<VerifyResult> {
    const row = this.db.get<SessionRow>(
      "SELECT * FROM sessions WHERE session_hash = ?",
      sessionHash,
    );
    const now = this.now();
    if (
      !row ||
      !row.account_id ||
      row.revoked_at !== null ||
      row.expires_at <= now ||
      !row.token_exp ||
      row.token_exp <= now
    ) {
      if (row?.account_id && row.revoked_at === null) {
        this.db.run(
          "UPDATE sessions SET revoked_at = ?, revoked_reason = 'expired', token_enc = NULL WHERE session_hash = ?",
          now,
          sessionHash,
        );
        this.hooks.onSessionEnded(sessionHash, "expired");
      }
      return { status: "revoked" };
    }
    if (!options.fresh && row.verified_at !== null && now - row.verified_at < LEASE_MS) {
      return {
        status: "active",
        until: Math.min(row.verified_at + LEASE_MS, row.token_exp),
      };
    }
    if (!this.ham) return { status: "unavailable" };
    const token = this.token(row);
    if (!token) return { status: "revoked" };
    const result = await this.ham.introspect(token);
    const checked = this.now();
    // An in-flight provider response cannot resurrect a session ended by logout or a newer login.
    const currentSession = this.db.get<SessionRow>(
      "SELECT * FROM sessions WHERE session_hash = ?",
      sessionHash,
    );
    if (
      !currentSession ||
      currentSession.revoked_at !== null ||
      currentSession.expires_at <= checked
    )
      return { status: "revoked" };
    if (result.kind === "active") {
      if (checked >= Math.min(now + LEASE_MS, row.token_exp, result.expSeconds * 1000))
        return { status: "unavailable" };
      const account = this.db.get<Account>(
        "SELECT * FROM accounts WHERE account_id = ?",
        row.account_id,
      );
      if (!account || account.subject !== result.sub) {
        this.db.run(
          "UPDATE sessions SET revoked_at = ?, revoked_reason = 'inactive' WHERE session_hash = ?",
          checked,
          sessionHash,
        );
        this.hooks.onSessionEnded(sessionHash, "inactive");
        return { status: "inactive" };
      }
      if (account.username !== result.username) {
        this.db.run(
          "UPDATE accounts SET username = ?, updated_at = ? WHERE account_id = ?",
          result.username,
          checked,
          account.account_id,
        );
      }
      const exp = Math.min(row.token_exp, result.expSeconds * 1000);
      this.db.run(
        "UPDATE sessions SET verified_at = ?, token_exp = ?, expires_at = MIN(expires_at, ?) WHERE session_hash = ?",
        now,
        exp,
        exp,
        sessionHash,
      );
      return { status: "active", until: Math.min(now + LEASE_MS, exp) };
    }
    if (result.kind === "inactive") {
      const current = this.db.get<SessionRow>(
        "SELECT revoked_at FROM sessions WHERE session_hash = ?",
        sessionHash,
      );
      if (current && current.revoked_at === null) {
        this.db.run(
          "UPDATE sessions SET revoked_at = ?, revoked_reason = 'inactive' WHERE session_hash = ?",
          checked,
          sessionHash,
        );
        this.hooks.onSessionEnded(sessionHash, "inactive");
      }
      return { status: "inactive" };
    }
    return { status: "unavailable" };
  }

  /** Sign out of the game: revoke the upstream token (best effort) and the local session. */
  async logout(session: SessionRow): Promise<void> {
    const token = this.token(session);
    this.db.run(
      "UPDATE sessions SET revoked_at = ?, revoked_reason = 'logout', token_enc = NULL WHERE session_hash = ?",
      this.now(),
      session.session_hash,
    );
    this.hooks.onSessionEnded(session.session_hash, "logout");
    if (token && this.ham) await this.ham.revoke(token);
  }

  /** Housekeeping: drop long-dead sessions and stale attempts. */
  sweep(): void {
    const cutoff = this.now() - 7 * 24 * 3_600_000;
    this.db.run(
      "DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",
      cutoff,
      cutoff,
    );
    this.db.run("DELETE FROM oauth_attempts WHERE created_at < ?", this.now() - ATTEMPT_TTL_MS);
    this.db.run(
      "UPDATE sessions SET token_enc = NULL WHERE revoked_at IS NOT NULL AND token_enc IS NOT NULL",
    );
  }
}
