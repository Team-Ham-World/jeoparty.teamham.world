"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { loginUrl } from "@/features/network/client/api";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_PATTERN,
  type CreateRoomRequest,
  type PackSummary,
  type RoomCode,
  type RoomSummary,
  type SessionInfo,
} from "@/features/network/protocol";
import { PageHeader, useAuthErrorMessage } from "@/features/ui/page-chrome";
import { StudioHero } from "@/features/ui/studio-hero";
import { CreateLobby } from "./create-lobby";
import { OpenRooms } from "./open-rooms";

/** Keep only room-code letters, uppercased: "bc d-fg" → "BCDFG". */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join("")
    .slice(0, 5);
}

export interface HomeScreenProps {
  session: SessionInfo;
  view?: "home" | "create" | "join";
  /** null while loading. */
  packs: PackSummary[] | null;
  packsError?: string | null;
  /** Rooms this host still has open. */
  openRooms?: RoomSummary[];
  openRoomsError?: string | null;
  onRetryOpenRooms?: () => void;
  onCloseRoom?: (code: RoomCode) => Promise<void>;
  onCreateGame: (request: CreateRoomRequest) => Promise<void>;
  onJoin: (code: string) => void;
  onSignOut: () => void;
}

export function HomeScreen({
  session,
  view = "home",
  packs,
  packsError,
  openRooms = [],
  openRoomsError = null,
  onRetryOpenRooms = () => {},
  onCloseRoom = async () => {},
  onCreateGame,
  onJoin,
  onSignOut,
}: HomeScreenProps) {
  const authError = useAuthErrorMessage();
  const page = session.signedIn ? view : "signin";
  const main = useRef<HTMLElement>(null);
  const previousPage = useRef(page);

  useEffect(() => {
    if (previousPage.current !== page) main.current?.focus();
    previousPage.current = page;
  }, [page]);

  return (
    <div className="home-shell">
      <PageHeader session={session} onSignOut={onSignOut} />
      <main id="main-content" className="home" tabIndex={-1} ref={main}>
        {page === "signin" ? (
          <>
            <StudioHero
              eyebrow="Account"
              title={
                <>
                  Sign <em>in.</em>
                </>
              }
              description="Use your HAM account to host or take a seat."
            />
            <div className="home-body">
              <section className="home-card home-signin" aria-labelledby="signin-title">
                <h2 id="signin-title">Continue with HAM</h2>
                {authError ? (
                  <p className="field__error" role="alert">
                    {authError}
                  </p>
                ) : null}
                <a
                  className="btn btn--primary"
                  href={loginUrl(view === "home" ? "/" : `/?view=${view}`)}
                >
                  Sign in with HAM
                </a>
              </section>
            </div>
          </>
        ) : page === "join" ? (
          <JoinScreen onJoin={onJoin} />
        ) : (
          <>
            {page === "create" ? (
              <CreateLobby
                packs={packs}
                packsError={packsError ?? null}
                onCreateGame={onCreateGame}
              />
            ) : (
              <>
                <StudioHero
                  eyebrow="HAM Network"
                  title={
                    <>
                      HAM <em>QUIZ</em>
                    </>
                  }
                  description="One host, one big screen, and a buzzer on every phone."
                />
                <div className="home-body home-actions">
                  <section className="home-card" aria-labelledby="home-host-title">
                    <h2 id="home-host-title">Host a game</h2>
                    <p className="muted">Pick a question pack and invite your players.</p>
                    <Link className="btn btn--primary" href="/?view=create">
                      Create a lobby <span aria-hidden="true">→</span>
                    </Link>
                  </section>
                  <section className="home-card" aria-labelledby="home-join-title">
                    <h2 id="home-join-title">Join a game</h2>
                    <p className="muted">Enter the five-letter code from the TV.</p>
                    <Link className="btn btn--quiet" href="/?view=join">
                      Enter room code
                    </Link>
                  </section>
                </div>
              </>
            )}
            <OpenRooms
              rooms={openRooms}
              error={openRoomsError}
              onRetry={onRetryOpenRooms}
              onClose={onCloseRoom}
            />
          </>
        )}
      </main>
    </div>
  );
}

function JoinScreen({ onJoin }: { onJoin: (code: RoomCode) => void }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ROOM_CODE_PATTERN.test(code)) {
      setError("Room codes are 5 letters with no vowels, like BCDFG.");
      input.current?.focus();
      return;
    }
    onJoin(code);
  }

  return (
    <>
      <StudioHero
        eyebrow="Player entrance"
        title={
          <>
            Join a <em>game.</em>
          </>
        }
        description="Use the five-letter code on the host’s screen."
      />
      <div className="home-body">
        <form className="home-join" onSubmit={submit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-code`}>
              Room code
            </label>
            <input
              id={`${id}-code`}
              className="input input--code"
              value={code}
              ref={input}
              onChange={(event) => {
                setCode(normalizeRoomCode(event.target.value));
                setError(null);
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
            />
            <span id={`${id}-hint`} className="field__hint">
              5 letters, no vowels.
            </span>
            {error ? (
              <span id={`${id}-error`} className="field__error" role="alert">
                {error}
              </span>
            ) : null}
          </div>
          <button type="submit" className="btn btn--primary">
            Join <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </>
  );
}
