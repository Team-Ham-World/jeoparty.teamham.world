"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createRoom, errorMessage, listPacks, logout } from "@/features/network/client/api";
import type { PackSummary } from "@/features/network/protocol";
import { ErrorNotice, LoadingNotice } from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { HomeScreen } from "./home-screen";

export function HomeRoute() {
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === "ready" && session.session.signedIn;
  const [packs, setPacks] = useState<{ list: PackSummary[] | null; error: string | null }>({
    list: null,
    error: null,
  });

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    listPacks().then(
      (list) => !cancelled && setPacks({ list, error: null }),
      (error: unknown) => !cancelled && setPacks({ list: [], error: errorMessage(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (session.status === "loading") return <LoadingNotice />;
  if (session.status === "error")
    return (
      <ErrorNotice
        title="Can't reach the quiz server"
        body={session.message}
        onRetry={session.reload}
      />
    );

  const info = session.session;
  const csrf = info.signedIn ? info.csrfToken : "";

  return (
    <HomeScreen
      session={info}
      packs={packs.list}
      packsError={packs.error}
      onCreateGame={async (packId) => {
        const { code } = await createRoom(csrf, packId ? { packId } : {});
        router.push(`/host/${code}`);
      }}
      onJoin={(code) => router.push(`/r/${code}`)}
      onSignOut={async () => {
        try {
          await logout(csrf);
        } finally {
          session.reload();
        }
      }}
    />
  );
}
