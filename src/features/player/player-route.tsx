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
  loginUrl,
} from "@/features/network/client/api";
import { useRoomConnection } from "@/features/network/client/use-room-connection";
import { ROOM_CODE_PATTERN, type AuthMode, type RoomSummary } from "@/features/network/protocol";
import { FixtureStamp } from "@/features/ui/brand";
import {
  ErrorNotice,
  LoadingNotice,
  NoticeShell,
  useAuthErrorMessage,
} from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { PlayerHandset, PlayerHeader } from "./player-handset";
import { PlayerScreen } from "./player-screen";

/** /r/CODE: sign-in gate → room summary → join → live play. */
export function PlayerRoute({ code }: { code: string }) {
  const session = useSession();

  if (!ROOM_CODE_PATTERN.test(code)) {
    return (
      <PlayerHandset>
        <ErrorNotice
          title={`“${code}” isn't a room code`}
          body="Room codes are 5 letters with no vowels, like BCDFG. Check the code on the big screen."
        />
      </PlayerHandset>
    );
  }
  if (session.status === "loading")
    return (
      <PlayerHandset>
        <LoadingNotice label="Checking your sign-in" />
      </PlayerHandset>
    );
  if (session.status === "error")
    return (
      <PlayerHandset>
        <ErrorNotice
          title="Can't reach the quiz server"
          body={session.message}
          onRetry={session.reload}
        />
      </PlayerHandset>
    );
  if (!session.session.signedIn) {
    return <PlayerSignIn code={code} authMode={session.session.authMode} />;
  }
  return (
    <PlayerGate code={code} csrf={session.session.csrfToken} name={session.session.user.name} />
  );
}

function PlayerSignIn({ code, authMode }: { code: string; authMode: AuthMode }) {
  const authError = useAuthErrorMessage();
  return (
    <PlayerHandset className="pl--join">
      <PlayerHeader code={code} />
      <main id="main-content" className="pl-main">
        <div className="join-card stack">
          <h1 className="pl-big">Join room {code}</h1>
          <p className="muted">Sign in with HAM to join. You&apos;ll come straight back here.</p>
          {authError ? (
            <p className="field__error" role="alert">
              {authError}
            </p>
          ) : null}
          <a className="btn btn--primary btn--big" href={loginUrl(`/r/${code}`)}>
            Sign in with HAM
          </a>
          {authMode === "fixture" ? <FixtureStamp /> : null}
        </div>
      </main>
    </PlayerHandset>
  );
}

function PlayerGate({ code, csrf, name }: { code: string; csrf: string; name: string }) {
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

  if (room.status === "loading")
    return (
      <PlayerHandset>
        <LoadingNotice label={`Finding room ${code}`} />
      </PlayerHandset>
    );
  if (room.status === "error") {
    if (room.error instanceof ApiError && room.error.code === "notFound") {
      return (
        <PlayerHandset>
          <ErrorNotice
            title={`No room ${code}`}
            body="That room doesn't exist or has closed. Check the code with your host."
          />
        </PlayerHandset>
      );
    }
    return (
      <PlayerHandset>
        <ErrorNotice
          title="Can't load this room"
          body={errorMessage(room.error)}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </PlayerHandset>
    );
  }

  const { summary } = room;
  if (joined || summary.myRole === "player" || summary.myRole === "waiting")
    return <PlayerLive code={code} csrf={csrf} />;

  if (summary.myRole === "host") {
    return (
      <PlayerHandset>
        <NoticeShell>
          <h1>You&apos;re hosting room {code}</h1>
          <p className="muted">Open the control room to run the game.</p>
          <Link className="btn btn--primary btn--big" href={`/host/${code}`}>
            Open the control room
          </Link>
        </NoticeShell>
      </PlayerHandset>
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
    <PlayerHandset className="pl--join">
      <PlayerHeader code={code} />
      <main id="main-content" className="pl-main">
        <section className="join-card stack" aria-labelledby="join-title">
          <h1 id="join-title" className="pl-big">
            {playing ? "A game is in progress" : `Join ${summary.hostName}'s game`}
          </h1>
          <p className="muted">
            {playing
              ? "Join now and wait for a seat in the next game."
              : "Use your phone to buzz in. Follow the clues on the big screen."}
          </p>
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
          <p className="pl-join-account muted">
            Playing as <strong className="name">{name}</strong>
          </p>
        </section>
      </main>
    </PlayerHandset>
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
