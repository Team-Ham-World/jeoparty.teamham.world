"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { AuthMode, SessionInfo } from "@/features/network/protocol";
import { loginUrl } from "@/features/network/client/api";
import { FixtureStamp, Lockup } from "./brand";

/** Plain words for the `auth_error` code the sign-in callback adds to the return address. */
function authErrorMessage(code: string): string {
  if (code === "denied") return "Sign-in was cancelled.";
  if (code === "expired") return "That sign-in took too long. Try again.";
  return "We couldn't finish signing you in. Try again.";
}

/**
 * Why the last sign-in failed, or null. Read after mount so the server and
 * first client render match, then dropped from the address so a reload or a
 * shared link doesn't repeat it.
 */
export function useAuthErrorMessage(): string | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("auth_error");
    if (code === null) return;
    url.searchParams.delete("auth_error");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A one-time read of the address, which only exists after mount.
    setMessage(authErrorMessage(code));
  }, []);

  return message;
}

/** Top bar for the paper pages (home, packs, gates). */
export function PageHeader({
  session,
  onSignOut,
  children,
}: {
  session?: SessionInfo | null;
  onSignOut?: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="topbar">
      <Lockup href="/" />
      <div className="topbar__mid">{children}</div>
      <div className="topbar__end">
        {session?.authMode === "fixture" ? <FixtureStamp /> : null}
        {session?.signedIn ? (
          <>
            <Link className="btn btn--quiet btn--small" href="/packs">
              My packs
            </Link>
            <span className="account name" title="Signed in with HAM">
              {session.user.name}
            </span>
            {onSignOut ? (
              <button type="button" className="btn btn--small" onClick={onSignOut}>
                Sign out
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Frame for a full-screen notice: loading, sign-in, errors, closed rooms.
 * On paper it draws the same top bar as the other paper pages (lockup only),
 * then a narrow column for the message. `tone="stage"` leaves the top bar out
 * for a notice drawn on the TV's ink stage.
 */
export function NoticeShell({
  children,
  busy = false,
  homeLink = true,
  tone = "paper",
}: {
  children: ReactNode;
  /** True while waiting for something; sets aria-busy on <main>. */
  busy?: boolean;
  /** Link the lockup to home. Pass false where leaving would interrupt a game. */
  homeLink?: boolean;
  tone?: "paper" | "stage";
}) {
  return (
    <>
      {tone === "paper" ? (
        <header className="topbar">
          <Lockup href={homeLink ? "/" : undefined} />
        </header>
      ) : null}
      <main
        id="main-content"
        className={tone === "stage" ? "notice notice--stage" : "notice"}
        aria-busy={busy || undefined}
      >
        {children}
      </main>
    </>
  );
}

export function LoadingNotice({ label = "Loading" }: { label?: string }) {
  return (
    <NoticeShell busy>
      <h1>
        {label}
        <span className="loading-dots" />
      </h1>
    </NoticeShell>
  );
}

export function ErrorNotice({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <NoticeShell>
      <span className="stamp stamp--ink">Hmm</span>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <div className="row">
        {onRetry ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <Link className="btn btn--quiet" href="/">
          Go home
        </Link>
      </div>
    </NoticeShell>
  );
}

/** "Sign in with HAM" card that brings you back to `returnTo` afterwards. */
export function SignInNotice({
  returnTo,
  authMode,
  title,
  body,
}: {
  returnTo: string;
  authMode: AuthMode;
  title: string;
  body: string;
}) {
  const authError = useAuthErrorMessage();
  return (
    <NoticeShell>
      <span className="stamp stamp--red">Sign in</span>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      {authError ? (
        <p className="field__error" role="alert">
          {authError}
        </p>
      ) : null}
      <a className="btn btn--primary btn--big" href={loginUrl(returnTo)}>
        Sign in with HAM
      </a>
      {authMode === "fixture" ? <FixtureStamp /> : null}
    </NoticeShell>
  );
}
