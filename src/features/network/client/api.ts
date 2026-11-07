/**
 * Typed fetch helpers for every HTTP endpoint in ../protocol.ts.
 *
 * - JSON in, JSON out. Errors become an `ApiError` with the server's code,
 *   message and (for packs) validation errors.
 * - Every mutating request sends the CSRF token from GET /api/session in the
 *   `CSRF_HEADER`. Pass the token you got from `getSession()`.
 * - Requests are same-origin, so cookies travel automatically.
 */
import type { ValidationError } from "@/features/content";
import {
  CSRF_HEADER,
  type ApiErrorCode,
  type ApiError as ApiErrorBody,
  type ClaimDisplayRequest,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type DisplayLinkResponse,
  type JoinRoomResponse,
  type PackDocument,
  type PackSummary,
  type RoomCode,
  type RoomSummary,
  type SessionInfo,
} from "../protocol";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | "network";
  readonly validationErrors: ValidationError[];

  constructor(
    status: number,
    code: ApiErrorCode | "network",
    message: string,
    validationErrors: ValidationError[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.validationErrors = validationErrors;
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Required for POST/PUT/DELETE. */
  csrf?: string;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" && value !== null && typeof (value as ApiErrorBody).error === "string"
  );
}

async function request<T>(
  path: string,
  { method = "GET", body, csrf }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && csrf) headers[CSRF_HEADER] = csrf;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      "network",
      "Can't reach the quiz server. Check your connection and try again.",
    );
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(
        response.status,
        payload.error,
        payload.message,
        payload.validationErrors ?? [],
      );
    }
    throw new ApiError(
      response.status,
      response.status >= 500 ? "internal" : "badRequest",
      `The server answered ${response.status}.`,
    );
  }
  return payload as T;
}

const enc = encodeURIComponent;

// ---------------------------------------------------------------- session/auth

export function getSession(): Promise<SessionInfo> {
  return request<SessionInfo>("/api/session");
}

/** Full-page navigation target for "Sign in with HAM". */
export function loginUrl(returnTo: string): string {
  return `/api/auth/login?return_to=${enc(returnTo)}`;
}

export function logout(csrf: string): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST", csrf });
}

// ---------------------------------------------------------------------- rooms

export function createRoom(
  csrf: string,
  body: CreateRoomRequest = {},
): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>("/api/rooms", { method: "POST", body, csrf });
}

export function getRoom(code: RoomCode): Promise<RoomSummary> {
  return request<RoomSummary>(`/api/rooms/${enc(code)}`);
}

export function joinRoom(csrf: string, code: RoomCode): Promise<JoinRoomResponse> {
  return request<JoinRoomResponse>(`/api/rooms/${enc(code)}/join`, { method: "POST", csrf });
}

export function leaveRoom(csrf: string, code: RoomCode): Promise<void> {
  return request<void>(`/api/rooms/${enc(code)}/leave`, { method: "POST", csrf });
}

/** Host only. Rotates the key, so older display links stop working. */
export function createDisplayLink(csrf: string, code: RoomCode): Promise<DisplayLinkResponse> {
  return request<DisplayLinkResponse>(`/api/rooms/${enc(code)}/display-link`, {
    method: "POST",
    csrf,
  });
}

/**
 * The TV is not signed in, so it has no session CSRF token. The server checks
 * the Origin and the one-time key instead; pass a token if one exists.
 */
export function claimDisplay(body: ClaimDisplayRequest, csrf?: string): Promise<void> {
  return request<void>("/api/display/claim", { method: "POST", body, csrf });
}

// ---------------------------------------------------------------------- packs

export function listPacks(): Promise<PackSummary[]> {
  return request<PackSummary[]>("/api/packs");
}

export function getPack(id: string): Promise<PackDocument> {
  return request<PackDocument>(`/api/packs/${enc(id)}`);
}

export function createPack(csrf: string, pack: unknown): Promise<PackDocument> {
  return request<PackDocument>("/api/packs", { method: "POST", body: { pack }, csrf });
}

export function updatePack(csrf: string, id: string, pack: unknown): Promise<PackDocument> {
  return request<PackDocument>(`/api/packs/${enc(id)}`, { method: "PUT", body: { pack }, csrf });
}

export function deletePack(csrf: string, id: string): Promise<void> {
  return request<void>(`/api/packs/${enc(id)}`, { method: "DELETE", csrf });
}

export function duplicatePack(csrf: string, id: string): Promise<PackDocument> {
  return request<PackDocument>(`/api/packs/${enc(id)}/duplicate`, { method: "POST", csrf });
}

/** Plain-language message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}
