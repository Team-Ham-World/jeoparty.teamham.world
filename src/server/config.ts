import path from "node:path";

export interface HamSettings {
  mode: "live" | "fixture";
  issuer: string;
  authorizeBase: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  redirectUri: string;
}
export interface Config {
  environment: "development" | "test" | "production";
  publicOrigin: string;
  host: string;
  port: number;
  databasePath: string;
  encryptionKey: Buffer;
  ham: HamSettings;
}
export const FIXTURE_ISSUER = "https://ham-fixture.invalid";
export const FIXTURE_CLIENT_SECRET = `ths_${"f".repeat(43)}`;
export function isLocalOrigin(origin: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname);
}
function exactOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Expected a bare HTTP(S) origin");
  }
  return url.origin;
}
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const environment = env.APP_ENV ?? env.NODE_ENV ?? "development";
  if (
    environment !== "production" &&
    environment !== "development" &&
    environment !== "test"
  )
    throw new Error("Invalid APP_ENV");
  const production = environment === "production";
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Invalid PORT");
  const publicOrigin = exactOrigin(
    env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`,
  );
  if (production && !publicOrigin.startsWith("https:"))
    throw new Error("Production requires HTTPS PUBLIC_ORIGIN");
  const key = env.TOKEN_ENCRYPTION_KEY;
  if (key && !/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex characters");
  if (production && !key)
    throw new Error("TOKEN_ENCRYPTION_KEY is required in production");
  const mode = env.HAM_MODE || (production ? "live" : "fixture");
  if (mode !== "live" && mode !== "fixture")
    throw new Error("HAM_MODE must be live or fixture");
  if (mode === "fixture" && (production || !isLocalOrigin(publicOrigin)))
    throw new Error("Fixture requires non-production localhost origin");
  const issuer =
    mode === "fixture"
      ? FIXTURE_ISSUER
      : exactOrigin(env.HAM_ISSUER || "https://teamham.world");
  if (mode === "live" && !issuer.startsWith("https:"))
    throw new Error("Live HAM requires HTTPS");
  const clientId = env.HAM_CLIENT_ID || "quiz";
  if (clientId !== "quiz") throw new Error("HAM_CLIENT_ID must be quiz");
  const clientSecret =
    mode === "fixture" ? FIXTURE_CLIENT_SECRET : env.HAM_CLIENT_SECRET || "";
  if (!/^ths_[A-Za-z0-9_-]{43}$/.test(clientSecret))
    throw new Error("HAM_CLIENT_SECRET is required with ths_ format");
  return {
    environment,
    publicOrigin,
    port,
    host: env.HOST || "127.0.0.1",
    databasePath:
      env.DATABASE_PATH === ":memory:"
        ? ":memory:"
        : path.resolve(env.DATABASE_PATH || ".data/quiz.sqlite"),
    encryptionKey: key ? Buffer.from(key, "hex") : Buffer.alloc(32, 7),
    ham: {
      mode,
      issuer,
      authorizeBase: mode === "fixture" ? `${publicOrigin}/__ham` : issuer,
      clientId,
      clientSecret,
      audience: "urn:teamham:game:quiz",
      redirectUri: `${publicOrigin}/api/auth/callback`,
    },
  };
}
