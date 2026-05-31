import type { Estado, Macrocycle, MonitorSeries } from "../types";
import { phaseForWeek } from "../data/macrocycles";

/** Estado plus the render-only "no data" boundary state. */
export type CellState = Estado | "none";

export function acwrState(v: number): Estado {
  return v > 1.5 ? "alert" : v > 1.3 || v < 0.8 ? "warn" : "ok";
}

/** Media móvil de 4 semanas (incluye la semana actual). */
export function chronic(acute: number[]): number[] {
  return acute.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) { sum += acute[j]!; n++; }
    return sum / n;
  });
}

export function acwr(acute: number[]): number[] {
  const ch = chronic(acute);
  return acute.map((a, i) => a / ch[i]!);
}

/** El IMR está fuera de la banda esperada de la fase (margen ±2). */
export function imrBandState(imr: number, band: [number, number]): Estado {
  return imr > band[1] + 2 || imr < band[0] - 2 ? "warn" : "ok";
}

/**
 * Recovery 0..100 (the quadrant y-axis). PLACEHOLDER formula: HRV above base is
 * good, RHR above base is bad, wellness/100 blends in. The real clinical/coaching
 * formula is a product call; this is the single swappable derivation (seeds store
 * the result). NOT calibrated to the mockup's hand-set rec values.
 */
export function recoveryScore(
  hrv: number, hrvBase: number,
  rhr: number, rhrBase: number,
  wellness: number,
): number {
  // Degenerate input (missing/zero base or non-finite physio input) → NaN, never a
  // false "healthy" 100. NaN propagates to recoveryState → "none" (the no-data discipline).
  if (!Number.isFinite(hrv) || !Number.isFinite(rhr) || hrvBase === 0 || rhrBase === 0 || rhr === 0) {
    return NaN;
  }
  const hrvRatio = hrv / hrvBase;          // >1 good
  const rhrRatio = rhrBase / rhr;          // >1 good (lower RHR is better)
  const physio = 50 * hrvRatio + 30 * rhrRatio; // ~80 at baseline
  const v = 0.7 * physio + 0.3 * wellness;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Per-week recovery for a series (parallel to weeks). */
export function recoverySeries(s: MonitorSeries): number[] {
  // Precondition: s.rhr and s.wellness are parallel to s.hrv (length === s.weeks).
  // A shorter array yields undefined → NaN → recoveryState "none" (no false green).
  return s.hrv.map((h, i) =>
    recoveryScore(h, s.hrvBase, s.rhr[i]!, s.rhrBase, s.wellness[i]!),
  );
}

/**
 * Recovery traffic light. Cutoff at 70 matches the mockup risk-zone (rec<70):
 * v<70 alert, v<80 warn, else ok. NON-FINITE INPUT (NaN/Infinity from a missing
 * or short recovery week) → "none", never "ok" (the recovery twin of acwrStateSafe).
 */
export function recoveryState(v: number): CellState {
  if (!Number.isFinite(v)) return "none";
  return v < 70 ? "alert" : v < 80 ? "warn" : "ok";
}

/** Guarded acwrState: a non-finite ratio (no/zero data) is "none", never "ok". */
export function acwrStateSafe(v: number): CellState {
  return Number.isFinite(v) ? acwrState(v) : "none";
}

/** Worse-of two CellStates via an explicit rank so "none" can never out-rank a real state. */
const RANK: Record<CellState, number> = { none: -1, ok: 0, warn: 1, alert: 2 };
function worseOf(a: CellState, b: CellState): CellState {
  // If EITHER axis is "none" (missing data), the cell is "none" — never silently green.
  if (a === "none" || b === "none") return "none";
  return RANK[a] >= RANK[b] ? a : b;
}

/** Per-cell state: "none" when missing/out-of-range/recovery-hole, else worse-of(acwr, recovery). */
export function seriesState(s: MonitorSeries | undefined, week: number): CellState {
  if (!s) return "none";
  const i = week - 1;
  if (i < 0 || i >= s.weeks) return "none";
  const load = acwrStateSafe(acwr(s.acute)[i] ?? NaN);   // NaN → none
  const rec = recoveryState(s.recovery[i] ?? NaN);       // missing recovery week → none
  return worseOf(load, rec);
}

/** Roster cell = the LAST week's seriesState (worse-of), or "none" when there is no series.
 *  Single rule shared by the buckets, the quadrant dot, and the heatmap's current column. */
export function rosterStatus(s: MonitorSeries | undefined): CellState {
  if (!s || s.weeks === 0 || s.acute.length === 0) return "none";
  return seriesState(s, s.weeks);
}

/** The IMR band the program expects for `week` (falls back to the last phase). */
export function imrBandForWeek(macro: Macrocycle, week: number): [number, number] {
  return phaseForWeek(macro, week)!.imrPct;
}

/** Estado of `imr` vs the phase band for `week`. Always Estado (non-empty macro). */
export function imrStateForWeek(imr: number, macro: Macrocycle, week: number): Estado {
  return imrBandState(imr, imrBandForWeek(macro, week));
}
