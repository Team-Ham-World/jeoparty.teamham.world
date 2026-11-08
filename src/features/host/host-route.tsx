"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createDisplayLink,
  errorMessage,
  getRoom,
  listPacks,
} from "@/features/network/client/api";
import { useRoomConnection } from "@/features/network/client/use-room-connection";
import { ROOM_CODE_PATTERN, type PackSummary, type RoomSummary } from "@/features/network/protocol";
import { ErrorNotice, LoadingNotice, NoticeShell, SignInNotice } from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { useOrigin } from "@/features/ui/use-origin";
import { HostScreen } from "./host-screen";

/** /host/CODE: only the room's host gets the control room. */
export function HostRoute({ code }: { code: string }) {
  const session = useSession();

  if (!ROOM_CODE_PATTERN.test(code))
    return (
      <ErrorNotice
        title={`“${code}” isn't a room code`}
        body="Start a new game from the home page."
      />
    );
  if (session.status === "loading") return <LoadingNotice label="Checking your sign-in" />;
  if (session.status === "error")
    return (
      <ErrorNotice
        title="Can't reach the quiz server"
        body={session.message}
        onRetry={session.reload}
      />
    );
  if (!session.session.signedIn) {
    return (
      <SignInNotice
        returnTo={`/host/${code}`}
        authMode={session.session.authMode}
        title={`Host room ${code}`}
        body="Sign in with the HAM account that created this room."
      />
    );
  }
  return <HostGate code={code} csrf={session.session.csrfToken} />;
}

function HostGate({ code, csrf }: { code: string; csrf: string }) {
  const [room, setRoom] = useState<
    | { status: "loading" }
    | { status: "ready"; summary: RoomSummary }
    | { status: "error"; error: unknown }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getRoom(code).then(
      (summary) => !cancelled && setRoom({ status: "ready", summary }),
      (error: unknown) => !cancelled && setRoom({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (room.status === "loading") return <LoadingNotice label={`Opening room ${code}`} />;
  if (room.status === "error") {
    const missing = room.error instanceof ApiError && room.error.code === "notFound";
    return (
      <ErrorNotice
        title={missing ? `No room ${code}` : "Can't load this room"}
        body={
          missing ? "It may have closed. Start a new game from home." : errorMessage(room.error)
        }
      />
    );
  }
  if (room.summary.myRole !== "host") {
    return (
      <NoticeShell>
        <span className="stamp stamp--ink">Host only</span>
        <h1>Only the host can open this page</h1>
        <p className="muted">
          {room.summary.hostName} is hosting room {code}. Want to play instead?
        </p>
        <Link className="btn btn--primary" href={`/r/${code}`}>
          Join as a player
        </Link>
      </NoticeShell>
    );
  }
  return <HostLive code={code} csrf={csrf} />;
}

function HostLive({ code, csrf }: { code: string; csrf: string }) {
  const connection = useRoomConnection({ code, role: "host" });
  const origin = useOrigin();
  const [packs, setPacks] = useState<PackSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    listPacks().then(
      (list) => !cancelled && setPacks(list),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const onCreateDisplayLink = useCallback(
    async () => (await createDisplayLink(csrf, code)).url,
    [csrf, code],
  );

  return (
    <HostScreen
      code={code}
      connection={connection}
      packs={packs}
      joinUrl={`${origin}/r/${code}`}
      onCreateDisplayLink={onCreateDisplayLink}
    />
  );
}
