"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  createRoom,
  errorMessage,
  leaveRoom,
  listMyRooms,
  listPacks,
  logout,
} from "@/features/network/client/api";
import type { PackSummary, RoomSummary } from "@/features/network/protocol";
import { ErrorNotice, LoadingNotice } from "@/features/ui/page-chrome";
import { useSession } from "@/features/ui/session";
import { HomeScreen } from "./home-screen";

export function HomeRoute() {
  return (
    <Suspense fallback={<LoadingNotice />}>
      <HomeRouteContent />
    </Suspense>
  );
}

function HomeRouteContent() {
  const router = useRouter();
  const requestedView = useSearchParams().get("view");
  const view = requestedView === "create" || requestedView === "join" ? requestedView : "home";
  const session = useSession();
  const signedIn = session.status === "ready" && session.session.signedIn;
  const [packs, setPacks] = useState<{ list: PackSummary[] | null; error: string | null }>({
    list: null,
    error: null,
  });
  const [openRooms, setOpenRooms] = useState<{ list: RoomSummary[]; error: string | null }>({
    list: [],
    error: null,
  });
  const latestRoomsRequest = useRef(0);

  // On failure the last known list stays, so a host can still reach those rooms.
  const refreshOpenRooms = useCallback(() => {
    const request = ++latestRoomsRequest.current;
    return listMyRooms().then(
      (list) => {
        if (request === latestRoomsRequest.current) setOpenRooms({ list, error: null });
      },
      (error: unknown) => {
        if (request === latestRoomsRequest.current)
          setOpenRooms((rooms) => ({ list: rooms.list, error: errorMessage(error) }));
      },
    );
  }, []);

  useEffect(() => {
    if (signedIn) void refreshOpenRooms();
  }, [signedIn, refreshOpenRooms]);

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
      view={view}
      packs={packs.list}
      packsError={packs.error}
      openRooms={openRooms.list}
      openRoomsError={openRooms.error}
      onRetryOpenRooms={() => void refreshOpenRooms()}
      onCloseRoom={async (code) => {
        try {
          await leaveRoom(csrf, code);
        } finally {
          void refreshOpenRooms();
        }
      }}
      onCreateGame={async (request) => {
        try {
          const { code } = await createRoom(csrf, request);
          router.push(`/host/${code}`);
        } catch (error) {
          // A host at the room limit needs an up-to-date list to close one from.
          void refreshOpenRooms();
          throw error;
        }
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
