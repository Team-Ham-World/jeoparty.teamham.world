/**
 * The interface screens use to talk to a room. Screens receive a
 * `RoomConnection` as a prop, so previews and tests can pass a mock, and the
 * real implementation (`useRoomConnection`) is a hook over the WebSocket.
 */
import type {
  AckError,
  ClientCommand,
  CloseReason,
  ConnectionRole,
  RoomCode,
  ViewFor,
} from "./protocol";

export type ConnectionStatus =
  | "connecting" // First connection attempt; no view yet.
  | "live" // Socket open and the view is current.
  | "reconnecting" // Lost the socket; retrying with backoff. The last view is stale.
  | "closed"; // Closed on purpose (see `closeReason`); no automatic retry.

export type CommandOutcome =
  | { ok: true; revision: number }
  | { ok: false; error: AckError | "offline" | "timeout"; message: string };

export interface RoomConnection<V> {
  status: ConnectionStatus;
  /** Latest view; never replaced by an older revision. */
  view: V | null;
  /** True whenever status is not "live". Screens disable game actions while stale. */
  stale: boolean;
  closeReason: CloseReason | null;
  /** Estimated `serverNow - Date.now()` for countdowns. */
  clockOffsetMs: number;
  /** Resolves with the server's ack. Retries reuse the same command id. */
  send(cmd: ClientCommand): Promise<CommandOutcome>;
}

export interface UseRoomConnectionOptions<R extends ConnectionRole> {
  code: RoomCode;
  role: R;
}

/** Implemented in ./client/use-room-connection.ts. */
export type UseRoomConnection = <R extends ConnectionRole>(
  options: UseRoomConnectionOptions<R>,
) => RoomConnection<ViewFor<R>>;
