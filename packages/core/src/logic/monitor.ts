import type { Estado, MonitorSeries } from "../types";

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
