"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { AuthMode, SessionInfo } from "@/features/network/protocol";
import { loginUrl } from "@/features/network/client/api";
import { FixtureStamp, Lockup } from "./brand";

/** Top bar for the paper pages (home, packs, gates). */
export function PageHeader({ session, onSignOut, children }: { session?: SessionInfo | null; onSignOut?: () => void; children?: ReactNode }) {
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

export function LoadingNotice({ label = "Loading" }: { label?: string }) {
  return (
    <main id="main-content" className="notice" aria-busy="true">
      <h1>
        {label}
        <span className="loading-dots" />
      </h1>
    </main>
  );
}

export function ErrorNotice({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main id="main-content" className="notice">
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
    </main>
  );
}

/** "Sign in with HAM" card that brings you back to `returnTo` afterwards. */
export function SignInNotice({ returnTo, authMode, title, body }: { returnTo: string; authMode: AuthMode; title: string; body: string }) {
  return (
    <main id="main-content" className="notice">
      <span className="stamp stamp--red">Sign in</span>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <a className="btn btn--primary btn--big" href={loginUrl(returnTo)}>
        Sign in with HAM
      </a>
      {authMode === "fixture" ? <FixtureStamp /> : null}
    </main>
  );
}
