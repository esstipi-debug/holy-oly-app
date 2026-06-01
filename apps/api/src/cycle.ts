import type { CycleShare, CycleState, CycleContext } from "@holy-oly/core";

/**
 * Server-side redaction of an athlete's cycle consent into the coach-facing `CycleContext`.
 * Mirrors the prototype's LocalRepository.getCycleContext: never exposes raw share/state/phase.
 * `inLutealNow` stays a placeholder (false for "full", null otherwise) until the cycle-slice
 * computation exists. The coach API must ONLY ever return this projection — never the raw row.
 */
export function redactCycle(share: CycleShare, state: CycleState): CycleContext | undefined {
  if (share === "none") return undefined;
  const reliable = state === "regular";
  const health: CycleContext["health"] = state === "amenorrhea" ? "referral" : "ok";
  const inLutealNow = share === "full" ? false : null;
  return { share, inLutealNow, health, reliable };
}
