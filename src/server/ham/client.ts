import { z } from "zod";
import type { HamSettings } from "../config.js";

export const HAM_CODE_PATTERN = /^thc_[A-Za-z0-9_-]{43}$/;
export const HAM_TOKEN_PATTERN = /^tha_[A-Za-z0-9_-]{43}$/;
const MAX_BODY_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 10_000;

export type FetchLike = (request: Request) => Promise<Response>;

export type ExchangeResult =
  | { kind: "ok"; token: string; sub: string; expiresIn: number }
  | { kind: "invalidGrant" }
  | { kind: "unavailable" };

export type IntrospectResult =
  | { kind: "active"; sub: string; username: string | null; expSeconds: number }
  | { kind: "inactive" }
  | { kind: "unavailable" };

export interface HamClient {
  authorizeUrl(input: { state: string; codeChallenge: string }): string;
  /** Called at most once per code. Never retried: a replayed code revokes the issued token. */
  exchangeCode(code: string, codeVerifier: string): Promise<ExchangeResult>;
  introspect(token: string): Promise<IntrospectResult>;
  revoke(token: string): Promise<"ok" | "unavailable">;
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  audience: z.string(),
  sub: z.string(),
  scope: z.string(),
});

const activeSchema = z.object({
  active: z.literal(true),
  sub: z.string(),
  username: z.string().nullable().optional(),
  client_id: z.string(),
  aud: z.string(),
  iss: z.string(),
  exp: z.number().int(),
  scope: z.string(),
  token_type: z.string(),
});

const inactiveSchema = z.object({ active: z.literal(false) });

export function createHamClient(
  settings: HamSettings,
  fetchImpl: FetchLike,
  now: () => number = Date.now,
): HamClient {
  const basic = Buffer.from(
    `${settings.clientId}:${settings.clientSecret}`,
    "utf8",
  ).toString("base64");

  async function post(
    path: string,
    fields: Record<string, string>,
  ): Promise<Response | null> {
    const request = new Request(`${settings.issuer}${path}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams(fields).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    try {
      const response = await fetchImpl(request);
      if (
        Number(response.headers.get("content-length") ?? "0") > MAX_BODY_BYTES
      ) {
        await response.body?.cancel();
        return null;
      }
      return response;
    } catch {
      return null;
    }
  }

  async function readJson(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) return undefined;
      return JSON.parse(text) as unknown;
    } catch {
      return undefined;
    }
  }

  return {
    authorizeUrl({ state, codeChallenge }) {
      const url = new URL(`${settings.authorizeBase}/api/auth/game/authorize`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", settings.clientId);
      url.searchParams.set("redirect_uri", settings.redirectUri);
      url.searchParams.set("scope", "identity");
      url.searchParams.set("audience", settings.audience);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },

    async exchangeCode(code, codeVerifier) {
      const response = await post("/api/auth/game/token", {
        grant_type: "authorization_code",
        code,
        redirect_uri: settings.redirectUri,
        code_verifier: codeVerifier,
      });
      if (!response) return { kind: "unavailable" };
      if (response.status === 400 || response.status === 401) {
        await response.body?.cancel();
        return { kind: "invalidGrant" };
      }
      if (response.status !== 200) {
        await response.body?.cancel();
        return { kind: "unavailable" };
      }
      const parsed = tokenResponseSchema.safeParse(await readJson(response));
      if (!parsed.success) return { kind: "unavailable" };
      const data = parsed.data;
      if (
        !HAM_TOKEN_PATTERN.test(data.access_token) ||
        data.token_type !== "Bearer" ||
        !Number.isInteger(data.expires_in) ||
        data.expires_in <= 0 ||
        data.audience !== settings.audience ||
        data.scope !== "identity" ||
        data.sub.length === 0 ||
        data.sub.length > 256
      ) {
        return { kind: "unavailable" };
      }
      return {
        kind: "ok",
        token: data.access_token,
        sub: data.sub,
        expiresIn: data.expires_in,
      };
    },

    async introspect(token) {
      const response = await post("/api/auth/game/introspect", { token });
      if (!response) return { kind: "unavailable" };
      if (response.status !== 200) {
        await response.body?.cancel();
        return { kind: "unavailable" };
      }
      const body = await readJson(response);
      if (inactiveSchema.safeParse(body).success) return { kind: "inactive" };
      const active = activeSchema.safeParse(body);
      if (!active.success) return { kind: "unavailable" };
      const v = active.data;
      // A response for another client, audience or issuer is never trusted.
      if (
        v.sub.length === 0 ||
        v.sub.length > 256 ||
        v.client_id !== settings.clientId ||
        v.aud !== settings.audience ||
        v.iss !== settings.issuer ||
        v.scope !== "identity" ||
        v.token_type !== "Bearer"
      ) {
        return { kind: "unavailable" };
      }
      if (v.exp * 1000 <= now()) return { kind: "inactive" };
      const username =
        typeof v.username === "string" && v.username.length <= 64
          ? v.username
          : null;
      return { kind: "active", sub: v.sub, username, expSeconds: v.exp };
    },

    async revoke(token) {
      const response = await post("/api/auth/game/revoke", { token });
      if (!response) return "unavailable";
      await response.body?.cancel();
      return response.status === 200 ? "ok" : "unavailable";
    },
  };
}
