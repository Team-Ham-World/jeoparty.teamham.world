import type { QuestionPack } from "@/features/content";
import type {
  AttemptView,
  BoardView,
  HostBoardCellView,
  ClueView,
  FinalResponseView,
  GameEvent,
  GameSettings,
  PauseView,
  Phase,
  PublicPlayer,
  ScoreLogEntry,
  TimerView,
} from "./contract";

export interface FinalState {
  stage: "wagers" | "answering" | "judging" | "done";
  categoryTitle: string;
  prompt: string;
  answer: string;
  eligiblePlayerIds: string[];
  startingScores: Record<string, number>;
  wagers: Record<string, number>;
  answers: Record<string, string>;
  responses: FinalResponseView[];
}

/** Internal, persisted data. Only role-specific views may leave the server. */
export interface GameState {
  readonly schema: "ham-quiz/game@1";
  readonly revision: number;
  readonly roomCode: string;
  rng: number;
  phase: Phase;
  pack: QuestionPack | null;
  settings: GameSettings;
  players: PublicPlayer[];
  waitingPlayers: PublicPlayer[];
  departedPlayerIds: string[];
  hostConnected: boolean;
  paused: PauseView | null;
  timer: TimerView | null;
  controllerId: string | null;
  roundIndex: number;
  boards: BoardView<HostBoardCellView>[];
  clue:
    | (Omit<ClueView, "prompt" | "answer"> & {
        prompt: string;
        answer: string;
        attempts: AttemptView[];
        ended: boolean;
        /** Private candidates, never spread into views. Order is socket arrival order. */
        collection: {
          id: string;
          decidesAt: number;
          candidates: { playerId: string; effectiveMs: number; arrivalMs: number }[];
        } | null;
      })
    | null;
  final: FinalState | null;
  scoreLog: ScoreLogEntry[];
  lastEvent: { revision: number; event: GameEvent } | null;
  /** Clock of the latest accepted command, used to preserve remaining time on recovery. */
  updatedAt: number;
}
