import crypto from "node:crypto";
import type { HamSettings } from "../config.js";
import { pkceChallenge, randomToken, sha256Hex, timingSafeEqualText } from "../crypto.js";
import type { SqlDatabase } from "../storage.js";

/**
 * DEVELOPMENT-ONLY stand-in for HAM's game OAuth provider.
 *
 * It implements the same contract as teamham.world's /api/auth/game/* routes
 * closely enough to exercise the complete sign-in path locally: PKCE S256,
 * 60-second single-use codes, replay revocation, one live token per
 * account/client, nullable usernames and an outage switch. It is mounted only
 * when configuration allows fixture mode, which production refuses.
 * A fixture sign-in is not evidence of a verified live HAM sign-in.
 */

const CODE_TTL_MS = 60_000;
const PARAM = /^[A-Za-z0-9_-]{43}$/;

interface FixtureControl {
  outage: boolean;
  tokenTtlMs: number;
}

export interface HamFixture {
  /** Handles /__ham/* browser routes and /api/auth/game/* backend routes. */
  handle(request: Request): Promise<Response>;
  control: FixtureControl;
  /** Test helper: revoke every live token for a username, as HAM would on central logout. */
  revokeUser(username: string): void;
}

export function createHamFixture(
  db: SqlDatabase,
  settings: HamSettings,
  now: () => number = Date.now,
): HamFixture {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hamfx_accounts (username TEXT PRIMARY KEY, sub TEXT NOT NULL, hide_username INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS hamfx_codes (code_hash TEXT PRIMARY KEY, sub TEXT NOT NULL, challenge TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER, token_hash TEXT);
    CREATE TABLE IF NOT EXISTS hamfx_tokens (token_hash TEXT PRIMARY KEY, sub TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER);
  `);
  const control: FixtureControl = { outage: false, tokenTtlMs: 24 * 3_600_000 };
  const basic = `Basic ${Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString("base64")}`;

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  const oauthError = (error: string, status = 400): Response => json({ error }, status);

  function uniqueParams(params: URLSearchParams): boolean {
    return [...new Set(params.keys())].every((key) => params.getAll(key).length === 1);
  }

  function validAuthorizeParams(p: URLSearchParams): boolean {
    return (
      uniqueParams(p) &&
      p.get("response_type") === "code" &&
      p.get("client_id") === settings.clientId &&
      p.get("redirect_uri") === settings.redirectUri &&
      p.get("scope") === "identity" &&
      p.get("audience") === settings.audience &&
      PARAM.test(p.get("state") ?? "") &&
      PARAM.test(p.get("code_challenge") ?? "") &&
      p.get("code_challenge_method") === "S256"
    );
  }

  function redirect(location: string): Response {
    return new Response(null, {
      status: 302,
      headers: {
        location,
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
      },
    });
  }

  function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  }

  function authorizePage(p: URLSearchParams): Response {
    const hidden = [...p.entries()]
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
      .join("");
    const presets = ["Alice", "Bea", "Carlo", "Dani"]
      .map((n) => `<button name="username" value="${n.toLowerCase()}" type="submit">${n}</button>`)
      .join("");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Development sign-in fixture</title>
<style>
:root {
  --ink: #191621;
  --cream: #faf4e9;
  --rule: #d4c9b9;
  --purple: #504388;
  --peach: #ff9864;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: clamp(12px, 4vw, 32px);
  background: #eee6d8;
  color: var(--ink);
  font: 16px/1.45 system-ui, sans-serif;
}
main {
  max-width: 640px;
  margin: clamp(0px, 4vh, 40px) auto;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: 16px;
  background: var(--cream);
}
header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 25%;
  align-items: center;
  gap: 12px;
  padding: 32px clamp(16px, 5vw, 36px);
  background: radial-gradient(ellipse at 84% 66%, #534472, transparent 65%), var(--ink);
  color: var(--cream);
}
h1 {
  margin: 0;
  font-size: clamp(27px, 5vw, 44px);
  line-height: 1.02;
  letter-spacing: -0.055em;
}
h1 em { color: var(--peach); }
.receiver {
  position: relative;
  aspect-ratio: 1.65;
  margin-top: 14%;
  padding: 7% 21% 7% 7%;
  border: 2px solid #1d1929;
  border-radius: 12% / 17%;
  background:
    radial-gradient(circle, #473a3d 52%, #e8bc97 53% 61%, transparent 63%) 95% 28% / 15% 28% no-repeat,
    radial-gradient(circle, #473a3d 52%, #e8bc97 53% 61%, transparent 63%) 95% 70% / 15% 28% no-repeat,
    linear-gradient(160deg, #f3c49c 8%, #dc9471 9% 65%, #af654f);
  box-shadow: 3px 4px 0 #8a584a, 5px 7px 0 #191421;
  transform: rotate(-6deg);
}
.receiver::before {
  position: absolute;
  bottom: 100%;
  left: 27%;
  width: 45%;
  height: 43%;
  background: #c3aeb1;
  clip-path: polygon(0 0, 5% 0, 50% 90%, 95% 0, 100% 0, 50% 100%);
  content: "";
}
.glass {
  height: 100%;
  border: 2px solid #352d38;
  border-radius: 16% / 23%;
  background:
    repeating-linear-gradient(0deg, transparent 0 2px, #24173333 2px 3px),
    radial-gradient(ellipse at 37% 40%, #9d91d2, #6c5aa3 62%, #332949);
}
.panel { padding: clamp(16px, 5vw, 36px); }
.warn {
  margin: 0 0 24px;
  padding: 10px 12px;
  border-left: 4px solid var(--purple);
  background: #e9e2f4;
  font-weight: 650;
}
form p { margin: 0 0 6px; font-weight: 700; }
.presets { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
label { display: block; margin: 16px 0 4px; font-weight: 700; }
.toggle { display: flex; align-items: center; gap: 8px; min-height: 44px; margin: 4px 0 12px; }
input[type=checkbox] { width: 18px; height: 18px; margin: 0; accent-color: var(--purple); }
input[type=text], button {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid #8c7e88;
  border-radius: 6px;
  background: #fffdf8;
  color: var(--ink);
  font: inherit;
}
input[type=text] { width: 100%; }
button { cursor: pointer; font-weight: 700; }
button:hover { background: #eee6d8; }
button.primary {
  border-color: #934e33;
  background: var(--peach);
  box-shadow: 0 2px 0 #773d2b;
}
button.primary:hover { background: #ffac84; }
:focus-visible { outline: 3px solid #175ab2; outline-offset: 3px; }
@media (max-width: 480px) {
  .presets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .actions button { width: 100%; }
}
</style></head><body><main>
<header>
<h1>Development <em>sign-in fixture</em></h1>
<div class="receiver" aria-hidden="true"><div class="glass"></div></div>
</header>
<div class="panel">
<p class="warn">This is not HAM. It is a local test provider for HAM Quiz development. Production refuses it.</p>
<form method="post" action="/__ham/authorize/decide">${hidden}
<p>Quick accounts:</p><div class="presets">${presets}</div>
<label for="custom">Or any test username</label>
<input id="custom" type="text" name="custom" maxlength="32" pattern="[A-Za-z0-9_.\\-]{1,32}" placeholder="e.g. tita_nena">
<label class="toggle"><input type="checkbox" name="hide_username" value="1"> Return a null username</label>
<div class="actions">
<button class="primary" type="submit" name="action" value="allow">Continue with custom name</button>
<button type="submit" name="action" value="deny">Deny access</button>
</div>
</form></div></main></body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    });
  }

  function subjectFor(username: string, hide: boolean): string {
    const row = db.get<{ sub: string }>(
      "SELECT sub FROM hamfx_accounts WHERE username = ?",
      username,
    );
    if (row) {
      db.run(
        "UPDATE hamfx_accounts SET hide_username = ? WHERE username = ?",
        hide ? 1 : 0,
        username,
      );
      return row.sub;
    }
    const sub = crypto.randomUUID();
    db.run(
      "INSERT INTO hamfx_accounts (username, sub, hide_username) VALUES (?, ?, ?)",
      username,
      sub,
      hide ? 1 : 0,
    );
    return sub;
  }

  async function decide(request: Request): Promise<Response> {
    const form = new URLSearchParams(await request.text());
    // The decide form repeats the authorize parameters plus the choice.
    const authz = new URLSearchParams();
    for (const key of [
      "response_type",
      "client_id",
      "redirect_uri",
      "scope",
      "audience",
      "state",
      "code_challenge",
      "code_challenge_method",
    ]) {
      const values = form.getAll(key);
      if (values.length !== 1) return new Response("Invalid request", { status: 400 });
      authz.set(key, values[0]!);
    }
    if (!validAuthorizeParams(authz)) return new Response("Invalid request", { status: 400 });
    const target = new URL(settings.redirectUri);
    target.searchParams.set("state", authz.get("state")!);
    target.searchParams.set("iss", settings.issuer);
    if (form.get("action") === "deny") {
      target.searchParams.set("error", "access_denied");
      return redirect(target.toString());
    }
    const username = (form.get("username") || form.get("custom") || "").trim().toLowerCase();
    if (!/^[a-z0-9_.-]{1,32}$/.test(username))
      return new Response("Choose a test username", { status: 400 });
    const sub = subjectFor(username, form.get("hide_username") === "1");
    const code = `thc_${randomToken(32)}`;
    db.run(
      "INSERT INTO hamfx_codes (code_hash, sub, challenge, expires_at) VALUES (?, ?, ?, ?)",
      sha256Hex(code),
      sub,
      authz.get("code_challenge")!,
      now() + CODE_TTL_MS,
    );
    target.searchParams.set("code", code);
    return redirect(target.toString());
  }

  async function backendForm(request: Request): Promise<URLSearchParams | Response> {
    if (control.outage) return oauthError("temporarily_unavailable", 503);
    const auth = request.headers.get("authorization");
    if (!auth || !timingSafeEqualText(auth, basic)) return oauthError("invalid_client", 401);
    if (!/^application\/x-www-form-urlencoded/i.test(request.headers.get("content-type") ?? "")) {
      return oauthError("invalid_request", 415);
    }
    const params = new URLSearchParams(await request.text());
    if (!uniqueParams(params)) return oauthError("invalid_request");
    return params;
  }

  async function token(request: Request): Promise<Response> {
    const params = await backendForm(request);
    if (params instanceof Response) return params;
    if (params.get("grant_type") !== "authorization_code")
      return oauthError("unsupported_grant_type");
    if (params.get("redirect_uri") !== settings.redirectUri) return oauthError("invalid_grant");
    const code = params.get("code") ?? "";
    const verifier = params.get("code_verifier") ?? "";
    const codeHash = sha256Hex(code);
    const row = db.get<{
      sub: string;
      challenge: string;
      expires_at: number;
      consumed_at: number | null;
      token_hash: string | null;
    }>(
      "SELECT sub, challenge, expires_at, consumed_at, token_hash FROM hamfx_codes WHERE code_hash = ?",
      codeHash,
    );
    if (!row) return oauthError("invalid_grant");
    if (row.consumed_at !== null) {
      // Replay: revoke whatever the first exchange issued.
      if (row.token_hash)
        db.run(
          "UPDATE hamfx_tokens SET revoked_at = ? WHERE token_hash = ?",
          now(),
          row.token_hash,
        );
      return oauthError("invalid_grant");
    }
    db.run("UPDATE hamfx_codes SET consumed_at = ? WHERE code_hash = ?", now(), codeHash);
    if (
      row.expires_at <= now() ||
      !PARAM.test(verifier) ||
      pkceChallenge(verifier) !== row.challenge
    ) {
      return oauthError("invalid_grant");
    }
    // One live token per account/client: a fresh login supersedes older tokens.
    db.run(
      "UPDATE hamfx_tokens SET revoked_at = ? WHERE sub = ? AND revoked_at IS NULL",
      now(),
      row.sub,
    );
    const accessToken = `tha_${randomToken(32)}`;
    const tokenHash = sha256Hex(accessToken);
    db.run(
      "INSERT INTO hamfx_tokens (token_hash, sub, expires_at) VALUES (?, ?, ?)",
      tokenHash,
      row.sub,
      now() + control.tokenTtlMs,
    );
    db.run("UPDATE hamfx_codes SET token_hash = ? WHERE code_hash = ?", tokenHash, codeHash);
    return json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(control.tokenTtlMs / 1000),
      audience: settings.audience,
      sub: row.sub,
      scope: "identity",
    });
  }

  async function introspect(request: Request): Promise<Response> {
    const params = await backendForm(request);
    if (params instanceof Response) return params;
    const row = db.get<{
      sub: string;
      expires_at: number;
      revoked_at: number | null;
      username: string;
      hide_username: number;
    }>(
      `SELECT t.sub, t.expires_at, t.revoked_at, a.username, a.hide_username
       FROM hamfx_tokens t JOIN hamfx_accounts a ON a.sub = t.sub WHERE t.token_hash = ?`,
      sha256Hex(params.get("token") ?? ""),
    );
    if (!row || row.revoked_at !== null || row.expires_at <= now()) return json({ active: false });
    return json({
      active: true,
      sub: row.sub,
      username: row.hide_username ? null : row.username,
      client_id: settings.clientId,
      aud: settings.audience,
      iss: settings.issuer,
      exp: Math.floor(row.expires_at / 1000),
      scope: "identity",
      token_type: "Bearer",
    });
  }

  async function revoke(request: Request): Promise<Response> {
    const params = await backendForm(request);
    if (params instanceof Response) return params;
    db.run(
      "UPDATE hamfx_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
      now(),
      sha256Hex(params.get("token") ?? ""),
    );
    return json({});
  }

  function revokeUser(username: string): void {
    db.run(
      "UPDATE hamfx_tokens SET revoked_at = ? WHERE revoked_at IS NULL AND sub = (SELECT sub FROM hamfx_accounts WHERE username = ?)",
      now(),
      username,
    );
  }

  return {
    control,
    revokeUser,
    async handle(request) {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/__ham/, "");
      if (request.method === "GET" && path === "/api/auth/game/authorize") {
        if (!validAuthorizeParams(url.searchParams))
          return new Response("Invalid authorization request", { status: 400 });
        return authorizePage(url.searchParams);
      }
      if (request.method === "POST" && path === "/authorize/decide") return decide(request);
      if (request.method === "POST" && path === "/api/auth/game/token") return token(request);
      if (request.method === "POST" && path === "/api/auth/game/introspect")
        return introspect(request);
      if (request.method === "POST" && path === "/api/auth/game/revoke") return revoke(request);
      if (request.method === "POST" && path === "/control") {
        const body = (await request.json().catch(() => ({}))) as Partial<{
          outage: boolean;
          tokenTtlSeconds: number;
          revokeUser: string;
        }>;
        if (typeof body.outage === "boolean") control.outage = body.outage;
        if (typeof body.tokenTtlSeconds === "number")
          control.tokenTtlMs = Math.max(1, body.tokenTtlSeconds) * 1000;
        if (typeof body.revokeUser === "string") revokeUser(body.revokeUser);
        return json({
          outage: control.outage,
          tokenTtlSeconds: control.tokenTtlMs / 1000,
        });
      }
      return new Response("Not found", { status: 404 });
    },
  };
}
