import type {
  CommandOutcome,
  ConnectionStatus,
  RoomConnection,
} from "@/features/network/connection";
import type { ClientCommand, CloseReason } from "@/features/network/protocol";

export interface MockOptions {
  status?: ConnectionStatus;
  closeReason?: CloseReason | null;
  clockOffsetMs?: number;
  /** Called with every command the screen sends. */
  onSend?: (cmd: ClientCommand) => void;
  /** Make every command fail with this message (to preview rejection toasts). */
  reject?: string;
}

/** A RoomConnection that never touches the network, for previews and tests. */
export function mockConnection<V extends { revision: number } | null>(
  view: V,
  options: MockOptions = {},
): RoomConnection<NonNullable<V>> {
  const status = options.status ?? (view ? "live" : "connecting");
  return {
    status,
    view: (view ?? null) as NonNullable<V> | null,
    stale: status !== "live",
    closeReason: options.closeReason ?? null,
    clockOffsetMs: options.clockOffsetMs ?? 0,
    async send(cmd): Promise<CommandOutcome> {
      options.onSend?.(cmd);
      if (options.reject) return { ok: false, error: "wrongPhase", message: options.reject };
      return { ok: true, revision: (view?.revision ?? 0) + 1 };
    },
  };
}
