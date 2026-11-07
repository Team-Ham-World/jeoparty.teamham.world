"use client";
// Placeholder until the network task lands the real WebSocket hook; it replaces this file at merge.

import { useMemo } from "react";
import type { RoomConnection, UseRoomConnection } from "../connection";

export const useRoomConnection: UseRoomConnection = () => {
  return useMemo<RoomConnection<never>>(
    () => ({
      status: "connecting",
      view: null,
      stale: true,
      closeReason: null,
      clockOffsetMs: 0,
      send: async () => ({ ok: false, error: "offline", message: "Not connected yet." }),
    }),
    [],
  );
};
