"use client";

import type { ReactNode } from "react";
import type { QuestionPack } from "@/features/content";
import type { PlayerId, PlayerView } from "@/features/engine/contract";
import type { ConnectionStatus } from "@/features/network/connection";
import type { CloseReason } from "@/features/network/protocol";
import { DisplayScreen } from "@/features/display/display-screen";
import { PackEditor } from "@/features/editor/pack-editor";
import { blankPack, newId } from "@/features/editor/pack-draft";
import { PACK_SCHEMA_VERSION, finalCluePath, withFinalClue } from "@/features/editor/pack-fields";
import { PacksList } from "@/features/editor/packs-list";
import { HostScreen } from "@/features/host/host-screen";
import { HomeScreen } from "@/features/lobby/home-screen";
import { PlayerScreen } from "@/features/player/player-screen";
import { ErrorNotice, LoadingNotice, PageHeader, SignInNotice } from "@/features/ui/page-chrome";
import { ToastProvider } from "@/features/ui/toasts";
import {
  FIXTURE_NOW,
  PACKS,
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

type ConnOpts = { status?: ConnectionStatus; closeReason?: CloseReason; reject?: string };

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
          onLeave={() => console.info("[preview] leave")}
        />
      );
    },
  };
}

function host(id: string, title: string, spec: SpecId, conn: ConnOpts = {}): PreviewEntry {
  return {
    id: `host-${id}`,
    group: "Host",
    title,
    viewport: "laptop",
    render: () => (
      <HostScreen
        code={ROOM}
        connection={mockConnection(conn.status === "connecting" ? null : hostFixture(spec), {
          ...conn,
          clockOffsetMs: CLOCK_OFFSET,
          onSend: log("host"),
        })}
        packs={PACKS}
        joinUrl={JOIN_URL}
        onCreateDisplayLink={async () =>
          `https://quiz.teamham.world/display/${ROOM}#key=preview-only-key`
        }
      />
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

const ME = "p-medchu";

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

  // -------------------------------------------------------------- player
  player("lobby", "Lobby", SPECS.lobby, ME),
  player("waiting", "Waiting for the next game", SPECS.board, "p-john"),
  player("round-intro", "Round intro", SPECS.roundIntro, ME),
  player("board", "Board: someone else picks", SPECS.board, ME),
  player("board-you-pick", "Board: you pick", SPECS.board, "p-ivvy"),
  player("reading", "Clue: reading", SPECS.reading, ME),
  player("open", "Clue: buzz now", SPECS.open, ME, { can: { buzz: true } }),
  player("open-locked", "Clue: locked out", SPECS.closed, "p-scarlet"),
  player("answering-you", "Clue: you're up", SPECS.answering, ME),
  player("answering-other", "Clue: someone else answering", SPECS.answering, "p-ivvy"),
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
  host("round-intro", "Round intro", "roundIntro"),
  host("board", "Board (wager cell marked)", "board"),
  host("reading", "Clue: reading", "reading"),
  host("open", "Clue: buzzers open", "open"),
  host("answering", "Clue: judge the answer", "answering"),
  host("closed", "Clue: closed after a miss", "closed"),
  host("judged", "Clue: judged correct", "judgedCorrect"),
  host("revealed", "Clue: revealed", "revealed"),
  host("wager", "Wager clue: enter wager", "wager"),
  host("wager-answering", "Wager clue: judge", "wagerAnswering"),
  host("long", "Long name + 300-character prompt", "longClue"),
  host("final-wagers", "Final: wagers", "finalWagers"),
  host("final-answering", "Final: answering", "finalAnswering"),
  host("final-judging", "Final: reveal + judge", "finalJudging"),
  host("final-done", "Final: done", "finalDone"),
  host("results", "Results", "results"),
  host("paused", "Paused", "paused"),
  host("restored", "Restored after restart", "restored"),
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
