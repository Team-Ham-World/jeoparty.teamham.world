import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function parseCookies(
  header: string | undefined,
): Map<string, string[]> {
  const cookies = new Map<string, string[]>();
  if (!header || header.length > 8192) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    cookies.set(name, [...(cookies.get(name) ?? []), value]);
  }
  return cookies;
}

export const BASE_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string | string[]> = {},
): void {
  const payload = status === 204 ? "" : JSON.stringify(body);
  res.writeHead(status, {
    ...BASE_HEADERS,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

export function redirect(
  res: ServerResponse,
  location: string,
  headers: Record<string, string | string[]> = {},
): void {
  res.writeHead(302, {
    ...BASE_HEADERS,
    location,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    ...headers,
  });
  res.end();
}

export async function readBody(
  req: IncomingMessage,
  maxBytes = 4096,
): Promise<Buffer> {
  const declared = Number(req.headers["content-length"] ?? "0");
  if (declared > maxBytes)
    throw new HttpError(413, "badRequest", "Request body is too large.");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > maxBytes)
      throw new HttpError(413, "badRequest", "Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson(
  req: IncomingMessage,
  maxBytes = 4096,
): Promise<unknown> {
  const type = req.headers["content-type"] ?? "";
  const body = await readBody(req, maxBytes);
  if (body.length === 0) return {};
  if (!/^application\/json\b/i.test(type))
    throw new HttpError(415, "badRequest", "Expected JSON.");
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new HttpError(400, "badRequest", "Malformed JSON.");
  }
}

/** Convert a Node request into a Fetch Request (used for the dev fixture routes). */
export async function toFetchRequest(
  req: IncomingMessage,
  origin: string,
): Promise<Request> {
  const url = new URL(req.url ?? "/", origin);
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : new Uint8Array(await readBody(req, 8192));
  return new Request(url, { method, headers, body });
}

export async function sendFetchResponse(
  res: ServerResponse,
  response: Response,
): Promise<void> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** TRUST_PROXY=true assumes exactly one trusted proxy hop: the last X-Forwarded-For
 * entry is what that proxy appended. With two or more hops it would be an intermediate
 * proxy, and rate limits would key on the proxy instead of real clients. */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const value = Array.isArray(forwarded) ? forwarded.at(-1) : forwarded;
    const last = value?.split(",").at(-1)?.trim();
    if (last) return last.slice(0, 64);
  }
  return req.socket.remoteAddress ?? "unknown";
}
