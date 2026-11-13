"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { QuestionPack } from "@/features/content";
import type { PlayerId, PlayerView } from "@/features/engine/contract";
import type { ConnectionStatus } from "@/features/network/connection";
import type { CloseReason } from "@/features/network/protocol";
import { DisplayScreen } from "@/features/display/display-screen";
import { packDraftKey, writeStoredDraft } from "@/features/editor/pack-autosave";
import { PackEditor } from "@/features/editor/pack-editor";
import { blankPack, newId, updateFinal } from "@/features/editor/pack-draft";
import { PACK_SCHEMA_VERSION, finalCluePath, withFinalClue } from "@/features/editor/pack-fields";
import { PacksList } from "@/features/editor/packs-list";
import { HostScreen } from "@/features/host/host-screen";
import { HomeScreen } from "@/features/lobby/home-screen";
import { PinnedBuzzerTiming } from "@/features/player/buzz-button";
import { PlayerScreen } from "@/features/player/player-screen";
import { ErrorNotice, LoadingNotice, PageHeader, SignInNotice } from "@/features/ui/page-chrome";
import { ToastProvider } from "@/features/ui/toasts";
import {
  FIXTURE_NOW,
  OPEN_ROOMS,
  PACKS,
  PINGS,
  PINGS_MIXED,
  ROOM,
  SESSION_SIGNED_IN,
  SESSION_SIGNED_OUT,
  SPECS,
  displayFixture,
  hostFixture,
  playerOf,
  type Spec,
  type SpecId,
} from "./fixtures";
import { mockConnection } from "./mock-connection";
import { Sequenced, atRevision } from "./sequenced";

export type PreviewViewport = "phone" | "laptop" | "tv";

export interface PreviewEntry {
  id: string;
  group: "Player" | "Host" | "Display" | "Home" | "Packs";
  title: string;
  viewport: PreviewViewport;
  render: () => ReactNode;
}

// Countdowns in previews run from the fixture's remaining time at page load.
const CLOCK_OFFSET = typeof window === "undefined" ? 0 : FIXTURE_NOW - Date.now();
const JOIN_URL = `https://quiz.teamham.world/r/${ROOM}`;
const log = (label: string) => (cmd: unknown) => console.info(`[preview ${label}] send`, cmd);

type ConnOpts = {
  status?: ConnectionStatus;
  closeReason?: CloseReason;
  reject?: string;
  pings?: Record<PlayerId, number | null>;
};

function player(
  id: string,
  title: string,
  spec: Spec,
  me: PlayerId,
  extra: Parameters<typeof playerOf>[2] = {},
  conn: ConnOpts = {},
): PreviewEntry {
  return {
    id: `player-${id}`,
    group: "Player",
    title,
    viewport: "phone",
    render: () => {
      const view: PlayerView | null =
        conn.status === "connecting" ? null : playerOf(spec, me, extra);
      return (
        <PlayerScreen
          code={ROOM}
          connection={mockConnection(view, {
            ...conn,
            clockOffsetMs: CLOCK_OFFSET,
            onSend: log("player"),
          })}
          onLeave={async () => console.info("[preview] leave")}
        />
      );
    },
  };
}

const DISPLAY_LINK = `https://quiz.teamham.world/display/${ROOM}#key=preview-only-key`;

/** Clicks these buttons, in order, to reach a state that only exists after a press. */
function PressOnOpen({ labels, children }: { labels: readonly string[]; children: ReactNode }) {
  useEffect(() => {
    const timers = labels.map((label, index) =>
      window.setTimeout(
        () => {
          const buttons = [...document.querySelectorAll("button")];
          buttons.find((button) => button.textContent?.trim() === label)?.click();
        },
        150 * (index + 1),
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [labels]);
  return <>{children}</>;
}

function host(
  id: string,
  title: string,
  spec: SpecId,
  {
    displayLink,
    press = [],
    ...conn
  }: ConnOpts & { displayLink?: string; press?: readonly string[] } = {},
): PreviewEntry {
  return {
    id: `host-${id}`,
    group: "Host",
    title,
    viewport: "laptop",
    render: () => (
      <PressOnOpen labels={press}>
        <HostScreen
          code={ROOM}
          connection={mockConnection(conn.status === "connecting" ? null : hostFixture(spec), {
            ...conn,
            pings: conn.pings ?? PINGS,
            clockOffsetMs: CLOCK_OFFSET,
            onSend: log("host"),
          })}
          packs={PACKS}
          joinUrl={JOIN_URL}
          onCreateDisplayLink={async () => DISPLAY_LINK}
          displayLink={displayLink}
          onCloseRoom={async () => {}}
        />
      </PressOnOpen>
    ),
  };
}

function display(id: string, title: string, spec: SpecId, conn: ConnOpts = {}): PreviewEntry {
  return {
    id: `display-${id}`,
    group: "Display",
    title,
    viewport: "tv",
    render: () => (
      <DisplayScreen
        connection={mockConnection(conn.status === "connecting" ? null : displayFixture(spec), {
          ...conn,
          clockOffsetMs: CLOCK_OFFSET,
        })}
        joinUrl={JOIN_URL}
      />
    ),
  };
}

/**
 * A phone buzzer held in a state that only lasts a moment in play (see
 * PinnedBuzzerTiming): the 250 ms "Too early!" lockout, or just after it.
 */
function pinnedBuzzer(
  id: string,
  title: string,
  timing: { lit: boolean; lockedOut: boolean; falseStart: boolean },
): PreviewEntry {
  return {
    id: `player-${id}`,
    group: "Player",
    title,
    viewport: "phone",
    render: () => (
      <PinnedBuzzerTiming.Provider value={timing}>
        <PlayerScreen
          code={ROOM}
          connection={mockConnection(playerOf(SPECS.open, ME, { can: { buzz: true } }), {
            clockOffsetMs: CLOCK_OFFSET,
            onSend: log("player"),
          })}
        />
      </PinnedBuzzerTiming.Provider>
    ),
  };
}

/**
 * A real opening, played once: the clue is read, then buzzers are scheduled
 * to light two seconds later. Tap during "Wait" to trigger a false start.
 */
function LightUpPreview() {
  const [view, setView] = useState(() => playerOf(SPECS.reading, ME));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const open = playerOf(SPECS.open, ME, { can: { buzz: true } });
      const opensAt = Date.now() + CLOCK_OFFSET + 2000;
      setView(atRevision({ ...open, clue: { ...open.clue!, opensAt } }, 61));
    }, 800);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <PlayerScreen
      code={ROOM}
      connection={mockConnection(view, { clockOffsetMs: CLOCK_OFFSET, onSend: log("player") })}
    />
  );
}

function samplePack(): QuestionPack {
  const pack = blankPack();
  const titles = ["Internet Lore", "Kitchen Science"];
  return {
    ...pack,
    schemaVersion: PACK_SCHEMA_VERSION,
    title: "Friday Night Brain Melt",
    description: "Internet trivia and kitchen chemistry for the group chat.",
    categories: titles.map((title, c) =>
      withFinalClue(
        {
          id: newId(),
          title,
          clues: [1, 2, 3].map((tier, k) => ({
            id: newId(),
            tier: tier as 1 | 2 | 3,
            type: "text" as const,
            prompt:
              c === 0
                ? [
                    "This 1992 browser draws pages in your terminal.",
                    "The first emoticon was posted on this university's message board.",
                    "RFC 2324 defines this protocol for coffee pots.",
                  ][k]
                : [
                    "Baking soda is this chemical compound.",
                    "This reaction browns your toast.",
                    "Cream of tartar is a byproduct of making this drink.",
                  ][k],
            answer:
              c === 0
                ? ["What is Lynx?", "What is Carnegie Mellon?", "What is HTCPCP?"][k]
                : [
                    "What is sodium bicarbonate?",
                    "What is the Maillard reaction?",
                    "What is wine?",
                  ][k],
          })),
        } as unknown as Parameters<typeof withFinalClue>[0],
        {
          id: newId(),
          tier: "final",
          type: "text",
          prompt: c === 0 ? "This chess computer beat the world champion in 1997." : "",
          answer: c === 0 ? "What is Deep Blue?" : "",
        },
      ),
    ),
    dimensions: { categories: 2, cluesPerCategory: 3 },
  };
}

/** Valid, so pressing Save reaches onSave and shows its conflict rather than field errors. */
function saveablePack(): QuestionPack {
  return updateFinal(samplePack(), 1, {
    prompt: "This leavening agent is sold in a small orange box.",
    answer: "What is baking soda?",
  });
}

/** A pack with unsaved edits waiting in this tab, the way a return visit finds it. */
function StoredDraftEditor({
  onSave = async () => {},
}: {
  onSave?: (pack: QuestionPack) => Promise<void>;
}) {
  const draftKey = packDraftKey("preview", "stored-draft");
  const [initial] = useState(() => {
    const pack = saveablePack();
    writeStoredDraft(draftKey, { ...pack, title: `${pack.title} (edited)` });
    return pack;
  });
  return (
    <PackEditor
      initial={initial}
      isNew={false}
      draftKey={draftKey}
      onSave={onSave}
      onNavigate={() => {}}
    />
  );
}

const ME = "p-medchu";

const RESTORE_THEN_SAVE = ["Restore", "Save changes"];

export const PREVIEWS: PreviewEntry[] = [
  // ---------------------------------------------------------------- home
  {
    id: "home-signed-out",
    group: "Home",
    title: "Signed out (dev fixture)",
    viewport: "laptop",
    render: () => (
      <HomeScreen
        session={SESSION_SIGNED_OUT}
        packs={null}
        onCreateGame={async () => {}}
        onJoin={() => {}}
        onSignOut={() => {}}
      />
    ),
  },
  {
    id: "home-signed-in",
    group: "Home",
    title: "Signed in",
    viewport: "laptop",
    render: () => (
      <HomeScreen
        session={SESSION_SIGNED_IN}
        packs={PACKS}
        onCreateGame={async () => {}}
        onJoin={() => {}}
        onSignOut={() => {}}
      />
    ),
  },
  {
    id: "home-open-rooms",
    group: "Home",
    title: "Signed in, with open rooms",
    viewport: "laptop",
    render: () => (
      <HomeScreen
        session={SESSION_SIGNED_IN}
        packs={PACKS}
        openRooms={OPEN_ROOMS}
        onCreateGame={async () => {}}
        onJoin={() => {}}
        onSignOut={() => {}}
      />
    ),
  },

  // -------------------------------------------------------------- player
  player("lobby", "Lobby", SPECS.lobby, ME),
  player("waiting", "Waiting for the next game", SPECS.board, "p-john"),
  player("round-intro", "Round intro", SPECS.roundIntro, ME),
  player("board", "Board: someone else picks", SPECS.board, ME),
  player("board-you-pick", "Board: you pick", SPECS.board, "p-ivvy"),
  player("reading", "Clue: reading", SPECS.reading, ME),
  player("open", "Clue: buzz now", SPECS.open, ME, { can: { buzz: true } }),
  {
    id: "player-light-up",
    group: "Player",
    title: "Clue: buzzer lights up (plays it; tap early to false-start)",
    viewport: "phone",
    render: () => <LightUpPreview />,
  },
  pinnedBuzzer("too-early", "Clue: too early (250 ms lockout, held)", {
    lit: true,
    lockedOut: true,
    falseStart: true,
  }),
  pinnedBuzzer("after-early", "Clue: buzz after a false start", {
    lit: true,
    lockedOut: false,
    falseStart: true,
  }),
  player("open-locked", "Clue: locked out", SPECS.closed, "p-scarlet"),
  player("answering-you", "Clue: you're up", SPECS.answering, ME),
  player("answering-other", "Clue: someone else answering", SPECS.answering, "p-ivvy"),
  player("answering-you-race", "Clue: you won the race by 0.04 s", SPECS.answeringRace, ME),
  player("answering-other-race", "Clue: someone else won by 0.04 s", SPECS.answeringRace, "p-ivvy"),
  player("closed", "Clue: buzzers closed", SPECS.closed, ME),
  player("revealed", "Clue: answer revealed", SPECS.revealed, ME),
  {
    id: "player-judged",
    group: "Player",
    title: "Clue: you got it (plays the effect)",
    viewport: "phone",
    render: () => (
      <Sequenced
        steps={[
          { at: 0, view: playerOf(SPECS.answering, ME) },
          { at: 500, view: atRevision(playerOf(SPECS.judgedCorrect, ME), 61) },
        ]}
        clockOffsetMs={CLOCK_OFFSET}
      >
        {(connection) => <PlayerScreen code={ROOM} connection={connection} />}
      </Sequenced>
    ),
  },
  player("wager-you", "Wager clue: your wager", SPECS.wager, "p-ivvy", {
    can: { wager: { min: 5, max: 1200 } },
  }),
  player("wager-other", "Wager clue: watching", SPECS.wager, ME),
  player("wager-answering", "Wager clue: you're up", SPECS.wagerAnswering, "p-ivvy"),
  player("long", "Long name + 300-character prompt", SPECS.longClue, "p-max"),
  player(
    "picture-reading",
    "Picture clue: reading (no picture beside a buzzer)",
    SPECS.pictureReading,
    ME,
  ),
  player("picture-wager", "Picture clue: wager, you're up", SPECS.pictureWagerAnswering, "p-ivvy"),
  player("picture-final", "Picture clue: final, type your answer", SPECS.pictureFinal, ME, {
    can: { finalAnswer: true },
    myFinal: { wager: 800, answer: null },
  }),
  player("final-wager", "Final: wager", SPECS.finalWagers, "p-ivvy", {
    can: { finalWager: { min: 0, max: 1200 } },
  }),
  player("final-wager-submitted", "Final: wager locked in", SPECS.finalWagers, "p-ivvy", {
    can: { finalWager: { min: 0, max: 1200 } },
    myFinal: { wager: 500, answer: null },
  }),
  player("final-ineligible", "Final: sitting out", SPECS.finalAnswering, "p-scarlet"),
  player("final-answer", "Final: type your answer", SPECS.finalAnswering, "p-medchu", {
    can: { finalAnswer: true },
    myFinal: { wager: 800, answer: null },
  }),
  player("final-answer-submitted", "Final: answer submitted", SPECS.finalAnswering, "p-ivvy", {
    can: { finalAnswer: true },
    myFinal: { wager: 1200, answer: "What is HAL 9000?" },
  }),
  player("final-judging", "Final: judging", SPECS.finalJudging, "p-ivvy", {
    myFinal: { wager: 1200, answer: "What is HAL 9000?" },
  }),
  player("final-done", "Final: done", SPECS.finalDone, ME, {
    myFinal: { wager: 800, answer: "Deep Blue" },
  }),
  player("results-win", "Results: shared win", SPECS.results, ME),
  player("results-lose", "Results: 3rd place", SPECS.results, "p-ivvy"),
  player("paused", "Paused by host", SPECS.paused, ME),
  player("host-offline", "Host offline", SPECS.hostOffline, ME),
  player("restored", "Restored after restart", SPECS.restored, ME),
  player(
    "stale",
    "Reconnecting (actions off)",
    SPECS.open,
    ME,
    { can: { buzz: true } },
    { status: "reconnecting" },
  ),
  player(
    "rejected",
    "Rejected command toast",
    SPECS.open,
    ME,
    { can: { buzz: true } },
    { reject: "Buzzers are closed for this clue." },
  ),
  player("connecting", "Connecting", SPECS.lobby, ME, {}, { status: "connecting" }),
  player(
    "closed-removed",
    "Closed: removed",
    SPECS.lobby,
    ME,
    {},
    { status: "closed", closeReason: "removed" },
  ),
  player(
    "closed-elsewhere",
    "Closed: signed in elsewhere",
    SPECS.lobby,
    ME,
    {},
    { status: "closed", closeReason: "signedInElsewhere" },
  ),
  player(
    "closed-auth",
    "Closed: sign-in expired",
    SPECS.lobby,
    ME,
    {},
    { status: "closed", closeReason: "authExpired" },
  ),
  player(
    "closed-room",
    "Closed: room closed",
    SPECS.lobby,
    ME,
    {},
    { status: "closed", closeReason: "roomClosed" },
  ),
  player(
    "closed-left",
    "Closed: you left",
    SPECS.lobby,
    ME,
    {},
    { status: "closed", closeReason: "left" },
  ),
  {
    id: "player-gate-signin",
    group: "Player",
    title: "Gate: sign in to join",
    viewport: "phone",
    render: () => (
      <SignInNotice
        returnTo={`/r/${ROOM}`}
        authMode="fixture"
        title={`Join room ${ROOM}`}
        body="Sign in with your HAM account to grab a buzzer. You'll come straight back here."
      />
    ),
  },
  {
    id: "player-gate-loading",
    group: "Player",
    title: "Gate: finding the room",
    viewport: "phone",
    render: () => <LoadingNotice label={`Finding room ${ROOM}`} />,
  },
  {
    id: "player-gate-missing",
    group: "Player",
    title: "Gate: no such room",
    viewport: "phone",
    render: () => (
      <ErrorNotice
        title={`No room ${ROOM}`}
        body="That room doesn't exist or has closed. Check the code with your host."
      />
    ),
  },

  // ---------------------------------------------------------------- host
  host("lobby", "Lobby: ready to start", "lobby"),
  host("lobby-blocked", "Lobby: start blocked", "lobbyAlone"),
  host("lobby-pings", "Lobby: pings, one slow, one measuring", "lobby", { pings: PINGS_MIXED }),
  host("round-intro", "Round intro", "roundIntro"),
  host("board", "Board (wager cell marked)", "board"),
  host("board-pings", "Board: pings, one slow, one measuring", "board", { pings: PINGS_MIXED }),
  host("reading", "Clue: reading", "reading"),
  host("open", "Clue: buzzers open", "open"),
  host("answering", "Clue: judge the answer", "answering"),
  host("answering-race", "Clue: judge, won the race by 0.04 s", "answeringRace"),
  host("closed", "Clue: closed after a miss", "closed"),
  host("judged", "Clue: judged correct", "judgedCorrect"),
  host("revealed", "Clue: revealed", "revealed"),
  host("wager", "Wager clue: enter wager", "wager"),
  host("wager-answering", "Wager clue: judge", "wagerAnswering"),
  host("long", "Long name + 300-character prompt", "longClue"),
  host("picture-reading", "Picture clue: reading", "pictureReading"),
  host("picture-wager", "Picture clue: wager, only the host sees it", "pictureWager"),
  host("picture-final", "Picture clue: final, answering", "pictureFinal"),
  host("final-wagers", "Final: wagers", "finalWagers"),
  host("final-answering", "Final: answering", "finalAnswering"),
  host("final-judging", "Final: reveal + judge", "finalJudging"),
  host("final-done", "Final: done", "finalDone"),
  host("results", "Results", "results"),
  host("paused", "Paused", "paused"),
  host("restored", "Restored after restart", "restored"),
  host("close-confirm", "Close room: confirm", "lobby", { press: ["Close room"] }),
  host("tv-link-confirm", "TV link: confirm replacing it", "board", {
    displayLink: DISPLAY_LINK,
    press: ["TV link", "Make a new link"],
  }),
  host("tv-link-confirm-unknown", "TV link: confirm, link not remembered", "board", {
    press: ["TV link", "Get display link"],
  }),
  host("stale", "Reconnecting (actions off)", "answering", { status: "reconnecting" }),
  host("room-closed", "Closed: room closed", "lobby", {
    status: "closed",
    closeReason: "roomClosed",
  }),
  {
    id: "host-gate-signin",
    group: "Host",
    title: "Gate: sign in to host",
    viewport: "laptop",
    render: () => (
      <SignInNotice
        returnTo={`/host/${ROOM}`}
        authMode="fixture"
        title={`Host room ${ROOM}`}
        body="Sign in with the HAM account that created this room."
      />
    ),
  },

  // ------------------------------------------------------------- display
  display("lobby", "Lobby: join instructions", "lobby"),
  display("lobby-empty", "Lobby: nobody yet", "lobbyAlone"),
  display("round-intro", "Round intro", "roundIntro"),
  display("board", "Board", "board"),
  display("reading", "Clue: reading", "reading"),
  display("open", "Clue: buzzers open", "open"),
  display("answering", "Clue: someone buzzed", "answering"),
  display("answering-race", "Clue: buzzed in, won by 0.04 s", "answeringRace"),
  display("answering-race-close", "Clue: buzzed in, won by a hair", "answeringRaceClose"),
  {
    id: "display-judged",
    group: "Display",
    title: "Clue: judged correct (plays the effect)",
    viewport: "tv",
    render: () => (
      <Sequenced
        steps={[
          { at: 0, view: displayFixture("answering") },
          { at: 500, view: atRevision(displayFixture("judgedCorrect"), 61) },
        ]}
        clockOffsetMs={CLOCK_OFFSET}
      >
        {(connection) => <DisplayScreen connection={connection} joinUrl={JOIN_URL} />}
      </Sequenced>
    ),
  },
  display("closed", "Clue: incorrect, closed", "closed"),
  display("revealed", "Clue: revealed", "revealed"),
  display("wager", "Wager clue: Hot HAM!", "wager"),
  display("wager-answering", "Wager clue: answering", "wagerAnswering"),
  display("long", "Long name + 300-character prompt", "longClue"),
  display("picture-reading", "Picture clue: reading", "pictureReading"),
  display("picture-wager", "Picture clue: wager, answering", "pictureWagerAnswering"),
  display("picture-final", "Picture clue: final, answering", "pictureFinal"),
  display("final-wagers", "Final: wagers", "finalWagers"),
  display("final-answering", "Final: answering", "finalAnswering"),
  display("final-judging", "Final: reveal + judge", "finalJudging"),
  display("final-done", "Final: done", "finalDone"),
  display("results", "Results: shared win", "results"),
  display("paused", "Paused", "paused"),
  display("host-offline", "Host offline", "hostOffline"),
  display("restored", "Restored after restart", "restored"),
  display("stale", "Reconnecting", "board", { status: "reconnecting" }),
  display("connecting", "Connecting", "lobby", { status: "connecting" }),
  display("link-replaced", "Closed: display link replaced", "lobby", {
    status: "closed",
    closeReason: "displayRevoked",
  }),

  // --------------------------------------------------------------- packs
  {
    id: "packs-list",
    group: "Packs",
    title: "My packs",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <PacksList packs={PACKS} busyId={null} onDuplicate={() => {}} onDelete={() => {}} />
        </main>
      </ToastProvider>
    ),
  },
  {
    id: "packs-editor",
    group: "Packs",
    title: "Editor",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <PackEditor
            initial={samplePack()}
            isNew={false}
            onSave={async () => {}}
            onNavigate={() => {}}
          />
        </main>
      </ToastProvider>
    ),
  },
  {
    id: "packs-editor-errors",
    group: "Packs",
    title: "Editor: validation errors",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <PackEditor
            initial={samplePack()}
            isNew={false}
            onSave={async () => {}}
            onNavigate={() => {}}
            initialErrors={[
              { path: "categories[0].clues[2].answer", message: "Expected a non-empty string." },
              { path: `${finalCluePath(1)}.prompt`, message: "Expected a non-empty string." },
              { path: `${finalCluePath(1)}.answer`, message: "Expected a non-empty string." },
            ]}
          />
        </main>
      </ToastProvider>
    ),
  },
  {
    id: "packs-editor-restore",
    group: "Packs",
    title: "Editor: restore unsaved edits",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <StoredDraftEditor />
        </main>
      </ToastProvider>
    ),
  },
  {
    id: "packs-editor-conflict",
    group: "Packs",
    title: "Editor: save conflict (restores, then presses Save)",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <PressOnOpen labels={RESTORE_THEN_SAVE}>
            <StoredDraftEditor
              onSave={async () => {
                throw Object.assign(new Error("This pack changed in another tab."), {
                  code: "conflict",
                });
              }}
            />
          </PressOnOpen>
        </main>
      </ToastProvider>
    ),
  },
  {
    id: "packs-new",
    group: "Packs",
    title: "New pack",
    viewport: "laptop",
    render: () => (
      <ToastProvider>
        <PageHeader session={SESSION_SIGNED_IN} onSignOut={() => {}} />
        <main id="main-content" className="page">
          <PackEditor initial={blankPack()} isNew onSave={async () => {}} onNavigate={() => {}} />
        </main>
      </ToastProvider>
    ),
  },
];

export function findPreview(id: string): PreviewEntry | undefined {
  return PREVIEWS.find((entry) => entry.id === id);
}
