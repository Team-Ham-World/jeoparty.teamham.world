"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_PATTERN,
  type PackSummary,
  type SessionInfo,
} from "@/features/network/protocol";
import { loginUrl } from "@/features/network/client/api";
import { PageHeader } from "@/features/ui/page-chrome";

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
  /** null while loading. */
  packs: PackSummary[] | null;
  packsError?: string | null;
  onCreateGame: (packId: string | undefined) => Promise<void>;
  onJoin: (code: string) => void;
  onSignOut: () => void;
}

export function HomeScreen({
  session,
  packs,
  packsError,
  onCreateGame,
  onJoin,
  onSignOut,
}: HomeScreenProps) {
  return (
    <>
      <PageHeader session={session} onSignOut={onSignOut} />
      <main id="main-content" className="page home">
        <section className="home-hero" aria-labelledby="home-title">
          <span className="stamp stamp--red">Quiz night</span>
          <h1 id="home-title" className="home-hero__title">
            Pick a clue.
            <br />
            <span className="marker">Beat your friends</span> to the buzzer.
          </h1>
          <p className="home-hero__lede">
            One of you hosts from a laptop, the board goes up on the TV, and everyone else buzzes in
            from their phone.
          </p>
        </section>

        {session.signedIn ? (
          <div className="home-actions">
            <HostCard packs={packs} packsError={packsError ?? null} onCreateGame={onCreateGame} />
            <JoinCard onJoin={onJoin} />
          </div>
        ) : (
          <section className="panel taped home-signin" aria-labelledby="signin-title">
            <h2 id="signin-title">Sign in to host or play</h2>
            <p className="muted">
              HAM Quiz is for HAM friends. Sign in with your HAM account and you&apos;ll come right
              back here.
            </p>
            <div className="row">
              <a className="btn btn--primary btn--big" href={loginUrl("/")}>
                Sign in with HAM
              </a>
            </div>
          </section>
        )}

        <section className="home-how" aria-labelledby="how-title">
          <h2 id="how-title" className="eyebrow">
            How a game works
          </h2>
          <ol className="home-steps">
            <li>
              <strong>The host</strong> creates a game, picks a question pack and puts the board on
              a TV with the display link.
            </li>
            <li>
              <strong>Players (2–6)</strong> join with the 5-letter room code and use their phone as
              a buzzer.
            </li>
            <li>
              <strong>The host</strong> reads each clue, opens the buzzers and judges answers.
              Highest score wins.
            </li>
          </ol>
        </section>
      </main>
    </>
  );
}

function HostCard({
  packs,
  packsError,
  onCreateGame,
}: {
  packs: PackSummary[] | null;
  packsError: string | null;
  onCreateGame: (packId: string | undefined) => Promise<void>;
}) {
  const id = useId();
  const [packId, setPackId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = packId || packs?.[0]?.id || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreateGame(chosen || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="panel home-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Host a game</h2>
      <p className="muted">You run the show and keep score. Hosts don&apos;t play.</p>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-pack`}>
            Question pack
          </label>
          <select
            id={`${id}-pack`}
            className="input"
            value={chosen}
            onChange={(event) => setPackId(event.target.value)}
            disabled={!packs || packs.length === 0}
          >
            {packs === null ? <option value="">Loading packs…</option> : null}
            {packs?.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.title}
                {pack.source === "mine" ? " (mine)" : ""} · {pack.categories}×
                {pack.cluesPerCategory}
              </option>
            ))}
          </select>
          <span className="field__hint">You can change it in the lobby too.</span>
          {packsError ? <span className="field__error">{packsError}</span> : null}
        </div>
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row">
          <button
            type="submit"
            className="btn btn--primary btn--big"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? "Creating…" : "Create game"}
          </button>
          <Link className="btn btn--quiet" href="/packs">
            Make your own pack
          </Link>
        </div>
      </form>
    </section>
  );
}

function JoinCard({ onJoin }: { onJoin: (code: string) => void }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ROOM_CODE_PATTERN.test(code)) {
      setError("Room codes are 5 letters with no vowels, like BCDFG.");
      return;
    }
    onJoin(code);
  }

  return (
    <section className="panel home-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Join a game</h2>
      <p className="muted">Enter the code from the big screen.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-code`}>
            Room code
          </label>
          <input
            id={`${id}-code`}
            className="input input--code"
            value={code}
            onChange={(event) => {
              setCode(normalizeRoomCode(event.target.value));
              setError(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="BCDFG"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {error ? (
            <span id={`${id}-error`} className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
        <button type="submit" className="btn btn--primary btn--big">
          Join
        </button>
      </form>
    </section>
  );
}
