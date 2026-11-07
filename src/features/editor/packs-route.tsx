"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { QuestionPack } from "@/features/content";
import {
  createPack,
  deletePack,
  duplicatePack,
  errorMessage,
  getPack,
  listPacks,
  logout,
  updatePack,
} from "@/features/network/client/api";
import type { PackSummary, SessionInfo } from "@/features/network/protocol";
import { ErrorNotice, LoadingNotice, PageHeader, SignInNotice } from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { ToastProvider, useToast } from "@/features/ui/toasts";
import { blankPack } from "./pack-draft";
import { PackEditor } from "./pack-editor";
import { PacksList } from "./packs-list";

type SignedIn = Extract<SessionInfo, { signedIn: true }>;

/** Session gate shared by the pack pages. */
function WithSession({
  returnTo,
  children,
}: {
  returnTo: string;
  children: (session: SignedIn, signOut: () => void) => React.ReactNode;
}) {
  const session = useSession();
  if (session.status === "loading") return <LoadingNotice />;
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
        returnTo={returnTo}
        authMode={session.session.authMode}
        title="Sign in to edit packs"
        body="Your packs are saved to your HAM account."
      />
    );
  }
  const signed = session.session;
  const signOut = async () => {
    try {
      await logout(signed.csrfToken);
    } finally {
      session.reload();
    }
  };
  return (
    <ToastProvider>
      <PageHeader session={signed} onSignOut={signOut} />
      {children(signed, signOut)}
    </ToastProvider>
  );
}

export function PacksRoute() {
  return (
    <WithSession returnTo="/packs">
      {(session) => <PacksPage csrf={session.csrfToken} />}
    </WithSession>
  );
}

function PacksPage({ csrf }: { csrf: string }) {
  const router = useRouter();
  const toast = useToast();
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    listPacks().then(
      (list) => {
        setPacks(list);
        setError(null);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !packs) return <ErrorNotice title="Can't load packs" body={error} onRetry={load} />;
  if (!packs) return <LoadingNotice label="Loading packs" />;

  return (
    <main id="main-content" className="page">
      <PacksList
        packs={packs}
        busyId={busyId}
        onDuplicate={async (id) => {
          setBusyId(id);
          try {
            const doc = await duplicatePack(csrf, id);
            toast(`Copied “${doc.pack.title}”.`, "info");
            router.push(`/packs/${doc.id}`);
          } catch (e) {
            toast(errorMessage(e));
          } finally {
            setBusyId(null);
          }
        }}
        onDelete={async (id) => {
          setBusyId(id);
          try {
            await deletePack(csrf, id);
            toast("Pack deleted.", "info");
            load();
          } catch (e) {
            toast(errorMessage(e));
          } finally {
            setBusyId(null);
          }
        }}
      />
    </main>
  );
}

export function PackEditorRoute({ id }: { id: string | null }) {
  return (
    <WithSession returnTo={id ? `/packs/${id}` : "/packs"}>
      {(session) => <EditorPage id={id} csrf={session.csrfToken} />}
    </WithSession>
  );
}

function EditorPage({ id, csrf }: { id: string | null; csrf: string }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; pack: QuestionPack }
    | { status: "error"; message: string }
  >(() => (id ? { status: "loading" } : { status: "ready", pack: blankPack() }));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPack(id).then(
      (doc) => !cancelled && setState({ status: "ready", pack: { ...doc.pack, id: doc.id } }),
      (e: unknown) => !cancelled && setState({ status: "error", message: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") return <LoadingNotice label="Opening pack" />;
  if (state.status === "error")
    return (
      <ErrorNotice
        title="Can't open this pack"
        body={`${state.message} Built-in packs can't be edited directly; copy one to your packs first.`}
      />
    );

  return (
    <main id="main-content" className="page">
      <PackEditor
        key={id ?? "new"}
        initial={state.pack}
        isNew={id === null}
        onNavigate={(href) => router.push(href)}
        onSave={async (pack) => {
          if (id) {
            await updatePack(csrf, id, pack);
          } else {
            const doc = await createPack(csrf, pack);
            router.replace(`/packs/${doc.id}`);
          }
        }}
      />
    </main>
  );
}
