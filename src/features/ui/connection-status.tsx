"use client";

import Link from "next/link";
import type { ConnectionStatus } from "@/features/network/connection";
import type { CloseReason } from "@/features/network/protocol";

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
  closed: "Disconnected",
};

/** Dot + word. The word carries the meaning; the dot is a quick glance. */
export function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const tone = status === "live" ? "" : status === "closed" ? "conn--closed" : "conn--stale";
  return <span className={`conn ${tone}`}>{STATUS_TEXT[status]}</span>;
}

/** Shown while the view is stale: everything still renders, actions are off. */
export function StaleBanner({
  status,
  className = "",
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  if (status === "live" || status === "closed") return null;
  return (
    <div className={`banner banner--warn ${className}`} role="status">
      <span>
        {status === "connecting" ? "Connecting to the room…" : "Connection lost. Reconnecting…"}
      </span>
      <p>Buttons are off until we catch up with the game.</p>
    </div>
  );
}

export interface ClosedCopy {
  title: string;
  body: string;
  action: "home" | "signIn" | "reload";
  actionLabel: string;
}

export function closedCopy(
  reason: CloseReason | null,
  role: "host" | "player" | "display",
): ClosedCopy {
  switch (reason) {
    case "removed":
      return {
        title: "You were removed from this room",
        body: "The host took you off the player list. You can join a different game from home.",
        action: "home",
        actionLabel: "Go home",
      };
    case "signedInElsewhere":
      return {
        title: "This room is open somewhere else",
        body: "You opened this room in another tab or device, so this one stepped aside.",
        action: "reload",
        actionLabel: "Use this tab instead",
      };
    case "authExpired":
      return {
        title: "Your HAM sign-in expired",
        body: "Sign in again to pick up where you left off. Your score is safe.",
        action: "signIn",
        actionLabel: "Sign in with HAM",
      };
    case "signedOut":
      return {
        title: "You signed out",
        body: "Sign in with HAM to come back to this room.",
        action: "signIn",
        actionLabel: "Sign in with HAM",
      };
    case "displayRevoked":
      return {
        title: "This screen was disconnected",
        body: "The host made a new display link. Open the new link on this screen to keep showing the game.",
        action: "home",
        actionLabel: "Go home",
      };
    case "roomClosed":
      return {
        title: "This room has closed",
        body:
          role === "host"
            ? "Start a new game from home whenever you like."
            : "Thanks for playing! Ask the host for a new room code.",
        action: "home",
        actionLabel: "Go home",
      };
    case "serverShutdown":
      return {
        title: "The quiz server is restarting",
        body: "Games are saved and come back paused. Reload in a moment.",
        action: "reload",
        actionLabel: "Reload",
      };
    default:
      return {
        title: "Disconnected",
        body:
          role === "display"
            ? "This display can't reach the room. Ask the host for a new display link."
            : "We can't reach this room right now.",
        action: "reload",
        actionLabel: "Try again",
      };
  }
}

/** Full-screen notice for a connection closed on purpose. */
export function ClosedNotice({
  reason,
  role,
  returnTo,
  tone = "paper",
}: {
  reason: CloseReason | null;
  role: "host" | "player" | "display";
  returnTo: string;
  tone?: "paper" | "stage";
}) {
  const copy = closedCopy(reason, role);
  return (
    <main id="main-content" className={`notice ${tone === "stage" ? "notice--stage" : ""}`}>
      <span className="stamp stamp--ink">Room disconnected</span>
      <h1>{copy.title}</h1>
      <p className="muted">{copy.body}</p>
      <div className="row">
        {copy.action === "home" ? (
          <Link className="btn btn--primary" href="/">
            {copy.actionLabel}
          </Link>
        ) : copy.action === "signIn" ? (
          <a
            className="btn btn--primary"
            href={`/api/auth/login?return_to=${encodeURIComponent(returnTo)}`}
          >
            {copy.actionLabel}
          </a>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            {copy.actionLabel}
          </button>
        )}
        {copy.action !== "home" && role !== "display" ? (
          <Link className="btn btn--quiet" href="/">
            Go home
          </Link>
        ) : null}
      </div>
    </main>
  );
}
