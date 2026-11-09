import { afterEach, describe, expect, it } from "vitest";
import { Browser, harness, type Harness } from "./test-harness";
import { loadConfig } from "./config";
import { createHamClient } from "./ham/client";
import { LEASE_MS, sessionCookie } from "./auth";

let h: Harness;
afterEach(async () => {
  await h?.stop();
});
describe("HAM OAuth port from Pusoy", () => {
  it("uses the exact contract, rotates the cookie, stores encrypted tokens and returns only public identity", async () => {
    h = await harness();
    const b = new Browser(h);
    const p = await b.beginLogin("/r/BCDFG");
    const before = b.cookie;
    expect(Object.fromEntries(p)).toMatchObject({
      client_id: "quiz",
      audience: "urn:teamham:game:quiz",
      redirect_uri: "http://127.0.0.1:3101/api/auth/callback",
      scope: "identity",
      code_challenge_method: "S256",
    });
    expect(p.get("state")).toMatch(/^[\w-]{43}$/);
    expect(p.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    const r = await b.callback(await b.decide(p));
    expect(r.headers.get("location")).toBe("/r/BCDFG");
    expect(b.cookie).not.toBe(before);
    expect(r.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Lax");
    expect(r.headers.get("set-cookie")).not.toContain("Domain=");
    const info = await (await b.request("/api/session")).json();
    expect(info).toMatchObject({
      signedIn: true,
      authMode: "fixture",
      user: { name: "alice" },
    });
    expect(JSON.stringify(info)).not.toMatch(/tha_|thc_|subject|session_hash/);
    const row = h.app.db.get<{ token_enc: Uint8Array }>(
      "SELECT token_enc FROM sessions WHERE account_id IS NOT NULL",
    )!;
    expect(Buffer.from(row.token_enc).toString()).not.toContain("tha_");
    expect(
      sessionCookie(
        loadConfig({ APP_ENV: "test", PUBLIC_ORIGIN: "https://localhost" }),
        "test",
        10000,
      ),
    ).toMatch(/^__Host-quiz_session=.*; Secure; HttpOnly/);
    expect(LEASE_MS).toBe(30_000);
  });
  it.each([
    "https://evil.invalid/",
    "//evil.invalid",
    "/r/ABCDE",
    "/packs/a?redirect=evil",
    "/host/BCDFG/../bad",
  ])("rejects unsafe return path %s", async (path) => {
    h = await harness();
    const b = new Browser(h);
    const r = await b.callback(await b.decide(await b.beginLogin(path)));
    expect(r.headers.get("location")).toBe("/");
  });
  it.each(["/", "/r/BCDFG", "/host/BCDFG", "/packs", "/packs/own-pack"])(
    "preserves allowlisted path %s",
    async (path) => {
      h = await harness();
      const b = new Browser(h);
      const r = await b.callback(await b.decide(await b.beginLogin(path)));
      expect(r.headers.get("location")).toBe(path);
    },
  );
  it("rejects mismatch and wrong-browser state without consuming the rightful attempt", async () => {
    h = await harness();
    const a = new Browser(h),
      b = new Browser(h);
    const url = await a.decide(await a.beginLogin());
    await b.beginLogin();
    expect((await b.callback(url)).headers.get("location")).toContain("auth_error=state");
    expect((await a.callback(url)).headers.get("location")).toBe("/");
  });
  it.each(["issuer", "duplicate", "state", "expired", "denied"])(
    "rejects %s callbacks",
    async (mode) => {
      h = await harness();
      const b = new Browser(h),
        url = await b.decide(await b.beginLogin(), { deny: mode === "denied" });
      if (mode === "issuer") url.searchParams.set("iss", "https://evil.invalid");
      if (mode === "duplicate") url.searchParams.append("code", "thc_" + "a".repeat(43));
      if (mode === "state") url.searchParams.set("state", "a".repeat(43));
      if (mode === "expired") h.advance(61_000);
      expect((await b.callback(url)).headers.get("location")).toContain(`auth_error=${mode}`);
      expect((await (await b.request("/api/session")).json()).signedIn).toBe(false);
    },
  );
  it("never exchanges a consumed callback and provider code replay revokes the issued token", async () => {
    h = await harness();
    const b = new Browser(h),
      url = await b.decide(await b.beginLogin());
    await b.callback(url);
    expect((await b.callback(url)).headers.get("location")).toContain("auth_error=state");
    const replay = await h.app.fixture!.handle(
      new Request("http://fixture/__ham/api/auth/game/token", {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`quiz:${h.app.config.ham.clientSecret}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          redirect_uri: h.app.config.ham.redirectUri,
          code: url.searchParams.get("code")!,
          code_verifier: "a".repeat(43),
        }),
      }),
    );
    expect(replay.status).toBe(400);
    h.advance(LEASE_MS + 1);
    expect((await b.request("/api/session")).status).toBe(401);
  });
  it("expires an attempt after ten minutes", async () => {
    h = await harness();
    const b = new Browser(h),
      p = await b.beginLogin();
    h.advance(600001);
    expect((await b.callback(await b.decide(p))).headers.get("location")).toContain(
      "auth_error=expired",
    );
  });
  it("freshly rejects inactive sessions without waiting for the socket lease", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("alice");
    h.app.fixture!.revokeUser("alice");
    expect((await b.request("/api/session")).status).toBe(401);
    expect(
      h.app.db.get<{ revoked_at: number }>(
        "SELECT revoked_at FROM sessions WHERE account_id IS NOT NULL",
      )!.revoked_at,
    ).not.toBeNull();
  });
  it("does not let a local session outlive the provider token", async () => {
    h = await harness();
    h.app.fixture!.control.tokenTtlMs = 1000;
    const b = new Browser(h);
    await b.signIn("alice");
    h.advance(1001);
    expect((await (await b.request("/api/session")).json()).signedIn).toBe(false);
    expect((await b.mutate("/api/rooms", {})).status).not.toBe(201);
  });
  it("fails closed during provider outage without extending the lease, and create forces fresh introspection", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("alice");
    h.app.fixture!.control.outage = true;
    expect((await b.mutate("/api/rooms", {})).status).toBe(503);
    h.advance(LEASE_MS + 1);
    expect((await b.request("/api/session")).status).toBe(503);
    h.app.fixture!.control.outage = false;
    expect((await b.request("/api/session")).status).toBe(200);
  });
  it("fails callback on provider outage with 503", async () => {
    h = await harness();
    const b = new Browser(h),
      url = await b.decide(await b.beginLogin());
    h.app.fixture!.control.outage = true;
    expect((await b.callback(url)).status).toBe(503);
  });
  it("uses stable fallback public names and supersedes old sessions", async () => {
    h = await harness();
    const a = new Browser(h),
      b = new Browser(h);
    await a.callback(await a.decide(await a.beginLogin(), { hide: true }));
    const first = await (await a.request("/api/session")).json();
    expect(first.user.name).toMatch(/^Player [A-Z0-9_-]{4}$/);
    await b.signIn("alice");
    const second = await (await b.request("/api/session")).json();
    expect(second.user.id).toBe(first.user.id);
    expect((await (await a.request("/api/session")).json()).signedIn).toBe(false);
  });
  it("requires CSRF and Origin for logout, then revokes locally and upstream", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("alice");
    expect(
      (
        await b.mutate("/api/auth/logout", undefined, "POST", {
          origin: "https://evil.invalid",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await b.mutate("/api/auth/logout", undefined, "POST", {
          "x-quiz-csrf": "bad",
        })
      ).status,
    ).toBe(403);
    expect((await b.mutate("/api/auth/logout")).status).toBe(204);
    expect((await (await b.request("/api/session")).json()).signedIn).toBe(false);
    expect(
      h.app.db.get<{ n: number }>("SELECT count(*) n FROM hamfx_tokens WHERE revoked_at IS NULL")!
        .n,
    ).toBe(0);
  });
  it.each([
    { APP_ENV: "production", PUBLIC_ORIGIN: "http://localhost" },
    {
      APP_ENV: "production",
      PUBLIC_ORIGIN: "https://quiz.teamham.world",
      TOKEN_ENCRYPTION_KEY: "a".repeat(64),
      HAM_MODE: "fixture",
    },
    {
      APP_ENV: "test",
      PUBLIC_ORIGIN: "https://example.com",
      HAM_MODE: "fixture",
    },
    { APP_ENV: "test", TOKEN_ENCRYPTION_KEY: "bad" },
    { APP_ENV: "production", PUBLIC_ORIGIN: "https://quiz.teamham.world" },
    { APP_ENV: "test", HAM_MODE: "wrong" },
  ])("rejects unsafe config %#", (env) => {
    expect(() => loadConfig(env)).toThrow();
  });
  it("does not resurrect a session when logout wins an in-flight introspection", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("alice");
    const session = h.app.auth.sessionFromCookieHeader(b.cookie)!;
    const original = h.app.fixture!.handle;
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.app.fixture!.handle = async (request) => {
      const result = await original(request);
      if (new URL(request.url).pathname.endsWith("/introspect")) await blocked;
      return result;
    };
    const verifying = h.app.auth.verify(session.session_hash, { fresh: true });
    await h.app.auth.logout(session);
    release();
    expect(await verifying).toEqual({ status: "revoked" });
  });
  it("refuses duplicate session cookies", async () => {
    h = await harness();
    const b = new Browser(h);
    await b.signIn("alice");
    b.cookie += `; ${b.cookie}`;
    expect((await (await b.request("/api/session")).json()).signedIn).toBe(false);
  });
  it.each(["iss", "aud", "client_id", "scope", "token_type", "sub"])(
    "rejects mismatched live introspection field %s",
    async (field) => {
      const config = loadConfig({ APP_ENV: "test" });
      const response = {
        active: true,
        iss: config.ham.issuer,
        aud: config.ham.audience,
        client_id: "quiz",
        scope: "identity",
        token_type: "Bearer",
        sub: "subject",
        username: null,
        exp: Math.floor(Date.now() / 1000) + 60,
        [field]: field === "sub" ? "" : "wrong",
      };
      const client = createHamClient(config.ham, async () => Response.json(response));
      expect(await client.introspect("tha_" + "a".repeat(43))).toEqual({
        kind: "unavailable",
      });
    },
  );
  it("live client never retries token exchange after an uncertain failure", async () => {
    const config = loadConfig({ APP_ENV: "test" });
    let calls = 0;
    const client = createHamClient(config.ham, async () => {
      calls++;
      throw new Error("network");
    });
    expect(await client.exchangeCode("thc_" + "a".repeat(43), "b".repeat(43))).toEqual({
      kind: "unavailable",
    });
    expect(calls).toBe(1);
  });
});
