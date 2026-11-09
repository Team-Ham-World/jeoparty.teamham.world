"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/features/network/client/api";
import type { RoomCode, RoomSummary } from "@/features/network/protocol";
import { ConfirmDialog } from "@/features/ui/dialog";
import { plural } from "@/features/ui/format";

const STATUS: Record<RoomSummary["status"], { label: string; stamp: string }> = {
  lobby: { label: "In the lobby", stamp: "stamp--dashed" },
  playing: { label: "Playing", stamp: "stamp--good" },
  finished: { label: "Finished", stamp: "stamp--ink" },
};

/**
 * Rooms this host has left open, so they can go back to one or close it. A
 * host can only have a few open at once. Hidden when there's nothing to show.
 */
export function OpenRooms({
  rooms,
  error,
  onRetry,
  onClose,
}: {
  rooms: RoomSummary[];
  /** Why the list couldn't be loaded. */
  error: string | null;
  onRetry: () => void;
  onClose: (code: RoomCode) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<RoomCode | null>(null);
  const [closing, setClosing] = useState<RoomCode | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  if (rooms.length === 0 && !error) return null;

  async function close(code: RoomCode) {
    setClosing(code);
    setCloseError(null);
    try {
      await onClose(code);
    } catch (e) {
      setCloseError(`Couldn't close room ${code}. ${errorMessage(e)}`);
    } finally {
      setClosing(null);
    }
  }

  return (
    <section className="panel home-rooms" aria-labelledby="open-rooms-title">
      <h2 id="open-rooms-title">Your open rooms</h2>
      {error ? (
        <div className="row">
          <p className="field__error" role="alert">
            Couldn&apos;t load your open rooms. {error}
          </p>
          <button type="button" className="btn btn--small" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
      {closeError ? (
        <p className="field__error" role="alert">
          {closeError}
        </p>
      ) : null}
      {rooms.length > 0 ? (
        <ul className="home-rooms__list">
          {rooms.map((room) => (
            <li
              key={room.code}
              className="home-room"
              aria-busy={closing === room.code || undefined}
            >
              <span className="home-room__code">{room.code}</span>
              <span className={`stamp stamp--flat ${STATUS[room.status].stamp}`}>
                {STATUS[room.status].label}
              </span>
              <span className="muted num">{plural(room.playerCount, "player")}</span>
              <div className="row home-room__actions">
                <Link
                  className="btn btn--small btn--primary"
                  href={`/host/${room.code}`}
                  aria-label={`Open room ${room.code}`}
                >
                  Open
                </Link>
                <button
                  type="button"
                  className="btn btn--small"
                  aria-label={`Close room ${room.code}`}
                  disabled={closing !== null}
                  onClick={() => setConfirming(room.code)}
                >
                  {closing === room.code ? "Closing…" : "Close"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        title={`Close room ${confirming ?? ""}?`}
        description="Everyone in the room is disconnected and the game ends. This can't be undone."
        confirmLabel="Close room"
        cancelLabel="Keep it open"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void close(confirming);
          setConfirming(null);
        }}
      />
    </section>
  );
}
