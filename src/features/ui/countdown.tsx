"use client";

import type { TimerKind, TimerView } from "@/features/engine/contract";
import { useRemaining } from "./clock";

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
        <span>{seconds === 0 ? "Time's up" : `${paused ? "Paused · " : ""}${seconds}s`}</span>
      </div>
      <div
        className="countdown__track"
        role="progressbar"
        aria-label={label ?? LABELS[timer.kind]}
        aria-valuemin={0}
        aria-valuemax={Math.round(timer.durationMs / 1000)}
        aria-valuenow={seconds}
        aria-valuetext={`${seconds} seconds left`}
      >
        <div className="countdown__fill" style={{ transform: `scaleX(${fraction})` }} />
      </div>
    </div>
  );
}
