"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  errorMessage,
  getRoom,
  joinRoom,
  leaveRoom,
} from "@/features/network/client/api";
import { useRoomConnection } from "@/features/network/client/use-room-connection";
import { ROOM_CODE_PATTERN, type RoomSummary } from "@/features/network/protocol";
import {
  ErrorNotice,
  LoadingNotice,
  NoticeShell,
  PageHeader,
  SignInNotice,
} from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { PlayerScreen } from "./player-screen";

/** /r/CODE: sign-in gate → room summary → join → live play. */
export function PlayerRoute({ code }: { code: string }) {
  const session = useSession();

  if (!ROOM_CODE_PATTERN.test(code)) {
    return (
      <ErrorNotice
        title={`“${code}” isn't a room code`}
        body="Room codes are 5 letters with no vowels, like BCDFG. Check the code on the big screen."
      />
    );
  }
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
        returnTo={`/r/${code}`}
        authMode={session.session.authMode}
        title={`Join room ${code}`}
        body="Sign in with your HAM account to grab a buzzer. You'll come straight back here."
      />
    );
  }
  return <PlayerGate code={code} csrf={session.session.csrfToken} />;
}

function PlayerGate({ code, csrf }: { code: string; csrf: string }) {
  const [room, setRoom] = useState<
    | { status: "loading" }
    | { status: "ready"; summary: RoomSummary }
    | { status: "error"; error: unknown }
  >({ status: "loading" });
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // The server said "room full": offer "Check again" instead of a Join that would fail again.
  const [full, setFull] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getRoom(code).then(
      (summary) => !cancelled && setRoom({ status: "ready", summary }),
      (error: unknown) => !cancelled && setRoom({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  if (room.status === "loading") return <LoadingNotice label={`Finding room ${code}`} />;
  if (room.status === "error") {
    if (room.error instanceof ApiError && room.error.code === "notFound") {
      return (
        <ErrorNotice
          title={`No room ${code}`}
          body="That room doesn't exist or has closed. Check the code with your host."
        />
      );
    }
    return (
      <ErrorNotice
        title="Can't load this room"
        body={errorMessage(room.error)}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  const { summary } = room;
  if (joined || summary.myRole === "player" || summary.myRole === "waiting")
    return <PlayerLive code={code} csrf={csrf} />;

  if (summary.myRole === "host") {
    return (
      <NoticeShell>
        <span className="stamp stamp--blue">You&apos;re the host</span>
        <h1>You&apos;re hosting room {code}</h1>
        <p className="muted">
          Hosts run the game and don&apos;t play. Open the control room instead.
        </p>
        <Link className="btn btn--primary btn--big" href={`/host/${code}`}>
          Open the control room
        </Link>
      </NoticeShell>
    );
  }

  /** Reads the room again so the facts on the card are current. */
  async function refresh(): Promise<RoomSummary | null> {
    try {
      const next = await getRoom(code);
      setRoom({ status: "ready", summary: next });
      return next;
    } catch (error) {
      setRoom({ status: "error", error });
      return null;
    }
  }

  async function join() {
    setJoining(true);
    setJoinError(null);
    try {
      await joinRoom(csrf, code);
      setJoined(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "roomFull") {
        setFull(true);
        void refresh(); // show the current player count
      } else {
        setJoinError(errorMessage(error));
      }
    } finally {
      setJoining(false);
    }
  }

  // Join comes back once a seat is free, or once the game has started
  // (latecomers can always wait for the next game). The server still decides.
  async function checkAgain() {
    setChecking(true);
    const next = await refresh();
    if (next && (next.status !== "lobby" || next.playerCount < next.maxPlayers)) setFull(false);
    setChecking(false);
  }

  const playing = summary.status !== "lobby";
  return (
    <>
      <PageHeader />
      <main id="main-content" className="page page--narrow">
        <section className="panel taped join-card" aria-labelledby="join-title">
          <span className="stamp stamp--red">Room {code}</span>
          <h1 id="join-title">
            {playing ? "A game is in progress" : `Join ${summary.hostName}'s game`}
          </h1>
          <dl className="join-facts">
            <div>
              <dt>Host</dt>
              <dd className="name">{summary.hostName}</dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd className="num">
                {summary.playerCount} of {summary.maxPlayers}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {summary.status === "lobby"
                  ? "In the lobby"
                  : summary.status === "playing"
                    ? "Playing"
                    : "Finished"}
              </dd>
            </div>
          </dl>
          <p className="muted">
            {playing
              ? "You can join now and you'll be in for the next game when the host chooses Play again."
              : "Your phone becomes your buzzer. The board and questions show on the big screen."}
          </p>
          {full ? (
            <div className="banner banner--bad join-alert" role="alert">
              <span>This game is full</span>
              <p>Ask the host to make room or start a new game, then check again.</p>
            </div>
          ) : joinError ? (
            <div className="banner banner--bad join-alert" role="alert">
              <span>Couldn&apos;t join</span>
              <p>{joinError}</p>
            </div>
          ) : null}
          {full ? (
            <button
              type="button"
              className="btn btn--big"
              onClick={checkAgain}
              disabled={checking}
              aria-busy={checking || undefined}
            >
              {checking ? "Checking…" : "Check again"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--big"
              onClick={join}
              disabled={joining}
              aria-busy={joining || undefined}
            >
              {joining ? "Joining…" : playing ? "Join the next game" : "Join game"}
            </button>
          )}
        </section>
      </main>
    </>
  );
}

function PlayerLive({ code, csrf }: { code: string; csrf: string }) {
  const router = useRouter();
  const connection = useRoomConnection({ code, role: "player" });
  return (
    <PlayerScreen
      code={code}
      connection={connection}
      onLeave={async () => {
        try {
          await leaveRoom(csrf, code);
        } catch (error) {
          // A room that no longer exists has nothing left to leave.
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        router.push("/");
      }}
    />
  );
}
