/**
 * HAM Quiz wire protocol shared by the server and browser code.
 * Types and constants only: safe to import from client components.
 */
import type { PictureId, QuestionPack, ValidationError } from "@/features/content";
import type {
  DisplayView,
  HostCommand,
  HostView,
  PlayerCommand,
  PlayerView,
  RejectionCode,
} from "@/features/engine/contract";

export const PROTOCOL_VERSION = 3 as const;

/** Room codes: 5 consonants (no vowels, so no accidental words). */
export const ROOM_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const ROOM_CODE_PATTERN = /^[BCDFGHJKLMNPQRSTVWXZ]{5}$/;
export type RoomCode = string;

export type ConnectionRole = "host" | "player" | "display";
export type ViewFor<R extends ConnectionRole> = R extends "host"
  ? HostView
  : R extends "player"
    ? PlayerView
    : DisplayView;
export type AnyView = HostView | PlayerView | DisplayView;

// ---------------------------------------------------------------------------
// WebSocket: GET /ws?room=CODE&role=host|player|display
//
// Identity comes from cookies (HAM session for host/player, display grant for
// display) and must match the requested role. The Origin header must equal the
// app's public origin. After connecting, the server sends `hello` and then the
// latest role-specific `view`; it sends a new view after every accepted change.

export type ClientHostCommand =
  | Exclude<HostCommand, { type: "setPack" | "openBuzzers" }>
  | { type: "openBuzzers"; clueId: string }
  | { type: "choosePack"; packId: string };
export type ClientPlayerCommand =
  | Exclude<PlayerCommand, { type: "buzz" }>
  | Omit<
      Extract<PlayerCommand, { type: "buzz" }>,
      "arrivalMs" | "uplinkBoundMs" | "maxOtherUplinkMs"
    >;
export type ClientCommand = ClientHostCommand | ClientPlayerCommand;

export type ClientMessage =
  /** `id`: a fresh UUID per user intent. Resend the same id when retrying after a reconnect. */
  | { t: "cmd"; id: string; cmd: ClientCommand }
  /** Ask for the current view again (for example after a gap in revisions). */
  | { t: "resync" }
  | { t: "ping"; at: number }
  | { t: "probeAck"; id: string };

export type TransportErrorCode =
  "badMessage" | "notAllowed" | "unknownPack" | "rateLimited" | "authUnavailable" | "internal";

export type AckError = RejectionCode | TransportErrorCode;

export type CloseReason =
  | "signedOut"
  | "signedInElsewhere"
  | "authExpired"
  | "removed"
  | "left"
  | "displayRevoked"
  | "roomClosed"
  | "serverShutdown";

export type ServerMessage =
  | { t: "hello"; protocol: typeof PROTOCOL_VERSION; role: ConnectionRole; serverNow: number }
  | { t: "view"; view: AnyView }
  | { t: "ack"; id: string; ok: true; revision: number }
  | { t: "ack"; id: string; ok: false; error: AckError; message: string }
  | { t: "pong"; at: number; serverNow: number }
  | { t: "probe"; id: string; at: number }
  /** Host only. Milliseconds RTT; null for disconnected or unsampled players. */
  | { t: "pings"; pings: Record<string, number | null> }
  /** Sent just before the server closes the socket on purpose. Do not auto-reconnect for these. */
  | { t: "closing"; reason: CloseReason };

/** WebSocket close codes used by the server. */
export const WS_CLOSE = {
  unauthorized: 4001,
  forbidden: 4003,
  roomNotFound: 4004,
  authExpired: 4005,
  rateLimited: 4008,
  intentional: 4010, // Preceded by a `closing` message.
} as const;

// ---------------------------------------------------------------------------
// HTTP API. JSON bodies, except the raw JPEG picture upload. Every mutating
// request needs the CSRF header with the token from GET /api/session plus an
// exact Origin match.
//
//   GET    /api/health                     → { ok: true }
//   GET    /api/session                     → SessionInfo
//   GET    /api/auth/login?return_to=PATH   → 302 to HAM (PATH must be allowlisted)
//   GET    /api/auth/callback               → 302 to the stored return path
//   POST   /api/auth/logout                 → 204
//   GET    /api/rooms                       → RoomSummary[] (rooms the caller hosts, most recently updated first)
//   POST   /api/rooms                       CreateRoomRequest → CreateRoomResponse (caller becomes host)
//   GET    /api/rooms/:code                 → RoomSummary
//   POST   /api/rooms/:code/join            → JoinRoomResponse
//   POST   /api/rooms/:code/leave           → 204
//   POST   /api/rooms/:code/display-link    → DisplayLinkResponse (host only; rotates the key)
//   POST   /api/display/claim               ClaimDisplayRequest → 204 + display grant cookie
//   GET    /api/packs                       → PackSummary[]
//   GET    /api/packs/:id                   → PackDocument (owner only)
//   POST   /api/packs                       SavePackRequest → PackDocument
//   PUT    /api/packs/:id                   SavePackRequest → PackDocument (owner only)
//   DELETE /api/packs/:id                   → 204 (owner only)
//   POST   /api/packs/:id/duplicate         → PackDocument (copy of a built-in or own pack)
//   POST   /api/pictures                    image/jpeg → UploadPictureResponse
//   GET    /api/pictures/:id                → image/jpeg (also HEAD; public, unguessable id)
//
// Login return paths allowed: "/", "/r/CODE", "/host/CODE", "/packs", "/packs/ID".

export const CSRF_HEADER = "x-quiz-csrf";

export type AuthMode = "live" | "fixture";

export type SessionInfo =
  | { signedIn: false; authMode: AuthMode }
  | {
      signedIn: true;
      authMode: AuthMode;
      /** `id` is this app's public account id; `name` is display-only. */
      user: { id: string; name: string };
      csrfToken: string;
    };

export interface CreateRoomRequest {
  /** Defaults to the first built-in pack. */
  packId?: string;
}

export interface CreateRoomResponse {
  code: RoomCode;
}

export interface RoomSummary {
  code: RoomCode;
  status: "lobby" | "playing" | "finished";
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  myRole: "host" | "player" | "waiting" | null;
}

export interface JoinRoomResponse {
  role: "player" | "waiting";
}

export interface DisplayLinkResponse {
  /** Absolute URL; the key travels in the fragment: `${origin}/display/${code}#key=${key}`. */
  url: string;
}

export interface ClaimDisplayRequest {
  code: RoomCode;
  key: string;
}

export interface PackSummary {
  id: string;
  title: string;
  description: string | null;
  categories: number;
  cluesPerCategory: number;
  source: "builtIn" | "mine";
  /** ISO timestamp; null for built-in packs. */
  updatedAt: string | null;
}

export interface PackDocument {
  id: string;
  pack: QuestionPack;
  updatedAt: string;
}

export interface SavePackRequest {
  /** Validated with the content validator; the server assigns the stored id. */
  pack: unknown;
  /**
   * PUT only: the `updatedAt` of the copy being edited. If the stored pack has changed since,
   * the save fails with 409 `conflict`. Omit it to overwrite unconditionally.
   */
  expectedUpdatedAt?: string;
}

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "badRequest"
  | "csrf"
  | "invalidPack"
  | "conflict"
  | "roomFull"
  | "rateLimited"
  | "authUnavailable"
  | "internal";

export interface ApiError {
  error: ApiErrorCode;
  message: string;
  validationErrors?: ValidationError[];
}

export type UploadPictureResponse = { id: PictureId };
