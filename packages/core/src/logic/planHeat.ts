import type { PrescriptionRow, WeekHeat } from "../types";

/** Heat input: a prescription row's location + dose (movement/kg are irrelevant here). */
export type HeatRow = Pick<PrescriptionRow, "week" | "sessionIdx" | "sets" | "reps" | "pct">;

const DAYS = 7;

/**
 * Per-day intensity/volume aggregate of a plan, for the calendar heat map. Day i = session i
 * (Monday-first) — the model doesn't assign weekdays to sessions yet, so this mapping is the
 * documented v1 assumption. Always returns `totalWeeks` rows × 7 slots; `null` = rest day.
 * `topPct` is absent when no row of the day carries a pct (honest no-data, never an invented 0).
 * Athlete-safe payload: percentages + lift counts only — no raw RM, no RPE.
 */
export function planHeat(rows: readonly HeatRow[], totalWeeks: number): WeekHeat[] {
  const weeks: WeekHeat[] = Array.from({ length: Math.max(0, totalWeeks) }, (_, i) => ({
    week: i + 1,
    days: Array.from({ length: DAYS }, () => null),
  }));
  for (const r of rows) {
    if (r.week < 1 || r.week > totalWeeks || r.sessionIdx < 0 || r.sessionIdx >= DAYS) continue;
    const days = weeks[r.week - 1]!.days;
    const cur = days[r.sessionIdx];
    const lifts = (cur?.lifts ?? 0) + r.sets * r.reps;
    const prevTop = cur?.topPct;
    const topPct = r.pct == null ? prevTop : prevTop == null ? r.pct : Math.max(prevTop, r.pct);
    days[r.sessionIdx] = topPct == null ? { lifts } : { lifts, topPct };
  }
  return weeks;
}

/** Largest day volume across the plan — normalizes the heat map's alpha. 0 when empty. */
export function maxLifts(heat: readonly WeekHeat[]): number {
  let max = 0;
  for (const w of heat) for (const d of w.days) if (d && d.lifts > max) max = d.lifts;
  return max;
}
