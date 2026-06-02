import type { SessionLog, SessionStatus } from "@holy-oly/core";

/** Status of one planned session (week, idx), or undefined when the coach hasn't marked it. */
export function markFor(log: SessionLog, week: number, idx: number): SessionStatus | undefined {
  return log.find((m) => m.week === week && m.idx === idx)?.status;
}

/** Tap cycle: pending → done → missed → pending. */
export function nextStatus(s: SessionStatus | undefined): SessionStatus | undefined {
  return s === undefined ? "done" : s === "done" ? "missed" : undefined;
}

/** Toggle one session, returning a new sparse log (adds, replaces, or removes the mark). */
export function applyToggle(log: SessionLog, week: number, idx: number): SessionLog {
  const next = nextStatus(markFor(log, week, idx));
  const rest = log.filter((m) => !(m.week === week && m.idx === idx));
  return next ? [...rest, { week, idx, status: next }] : rest;
}

/** How many sessions in a week are marked done. */
export function weekDone(log: SessionLog, week: number): number {
  return log.filter((m) => m.week === week && m.status === "done").length;
}
