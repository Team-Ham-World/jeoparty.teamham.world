"use client";

import type { TimerKind, TimerView } from "@/features/engine/contract";
import { useRemaining } from "./clock";
import { plural } from "./format";

const LABELS: Record<TimerKind, string> = {
  buzz: "Buzzers close in",
  answer: "Time to answer",
  finalAnswer: "Answers lock in",
};

export function timerLabel(kind: TimerKind): string {
  return LABELS[kind];
}

/** Whole seconds left, rounded up so "0" only shows when time is really up. */
export function secondsLeft(ms: number): number {
  return Math.ceil(ms / 1000);
}

/** What the bar shows: "7s" under a minute, "2:59" from a minute up. */
export function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const rest = seconds % 60;
  return `${Math.floor(seconds / 60)}:${String(rest).padStart(2, "0")}`;
}

/** What a screen reader hears: "2 minutes 59 seconds left", "1 minute left". */
export function describeCountdown(seconds: number): string {
  if (seconds <= 0) return "Time's up";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts = [
    minutes > 0 ? plural(minutes, "minute") : "",
    rest > 0 ? plural(rest, "second") : "",
  ];
  return `${parts.filter(Boolean).join(" ")} left`;
}

/**
 * A labelled countdown bar. It only reads the timer from the view; when time
 * runs out the server, not this component, decides what happens next.
 */
export function Countdown({
  timer,
  clockOffsetMs,
  label,
  className = "",
}: {
  timer: TimerView;
  clockOffsetMs: number;
  label?: string;
  className?: string;
}) {
  const ms = useRemaining(timer, clockOffsetMs) ?? timer.remainingMs;
  const fraction = timer.durationMs > 0 ? Math.min(1, ms / timer.durationMs) : 0;
  const seconds = secondsLeft(ms);
  const low = seconds <= 3;
  const paused = timer.endsAt === null;
  return (
    <div className={`countdown ${low ? "countdown--low" : ""} ${className}`}>
      <div className="countdown__label">
        <span>{label ?? LABELS[timer.kind]}</span>
        <span>
          {seconds === 0 ? "Time's up" : `${paused ? "Paused · " : ""}${formatCountdown(seconds)}`}
        </span>
      </div>
      <div
        className="countdown__track"
        role="progressbar"
        aria-label={label ?? LABELS[timer.kind]}
        aria-valuemin={0}
        aria-valuemax={Math.round(timer.durationMs / 1000)}
        aria-valuenow={seconds}
        aria-valuetext={`${paused && seconds > 0 ? "Paused, " : ""}${describeCountdown(seconds)}`}
      >
        <div className="countdown__fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
    </div>
  );
}
